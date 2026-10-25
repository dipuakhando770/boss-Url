/**
 * Boss URL Shortener — Vercel Node.js Proxy: /api/proxy/stage2
 *
 * This is a STANDALONE file with ZERO imports from the worker or shared code.
 * It exists solely to forward POST requests from the Cloudflare Worker
 * (which cannot reach raw IPs due to CF Error 1003) to the VPS backend.
 *
 * Runtime: Node.js serverless (Vercel)
 * Target:  POST http://107.174.37.180/api/links/stage1
 *
 * The VPS returns the final short-link URL in the "stage1_url" field, e.g.:
 *   { "stage1_url": "http://107.174.37.180/s1_neCUtd", ... }
 *
 * This proxy passes the exact VPS response body and status back to the caller.
 * The final short-link domain remains http://107.174.37.180/ at all times.
 */

const VPS_API_URL = 'http://107.174.37.180/api/links/stage1';
const TIMEOUT_MS = 15000;

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // GET — diagnostic ping
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(
      JSON.stringify({
        status: 'UP',
        proxy: '/api/proxy/stage2',
        target: VPS_API_URL,
        description: 'Vercel Node.js gateway → VPS Stage 2 API (HTTP raw IP)',
        method: 'POST',
      })
    );
    return;
  }

  // Only allow POST beyond this point
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    return;
  }

  // Read body
  let body = '';
  try {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: 'Failed to read request body' }));
    return;
  }

  // Validate JSON body
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: 'Request body must be valid JSON' }));
    return;
  }

  if (!parsed.url || typeof parsed.url !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: 'Missing required field: url' }));
    return;
  }

  // Forward to VPS using Node.js http module (can reach raw IPs over HTTP)
  const { request: httpRequest } = await import('http');

  const vpsPayload = JSON.stringify({ url: parsed.url });

  try {
    const vpsResponse = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        req_handle.destroy(new Error('VPS request timed out'));
      }, TIMEOUT_MS);

      const req_handle = httpRequest(
        {
          hostname: '107.174.37.180',
          port: 80,
          path: '/api/links/stage1',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(vpsPayload),
            'User-Agent': 'Boss-URL-Shortener-Proxy/2.0',
          },
        },
        (vpsRes) => {
          clearTimeout(timer);
          const chunks = [];
          vpsRes.on('data', (c) => chunks.push(c));
          vpsRes.on('end', () => {
            resolve({
              status: vpsRes.statusCode || 502,
              body: Buffer.concat(chunks).toString('utf-8'),
            });
          });
          vpsRes.on('error', reject);
        }
      );

      req_handle.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      req_handle.write(vpsPayload);
      req_handle.end();
    });

    res.writeHead(vpsResponse.status, {
      'Content-Type': 'application/json',
      ...corsHeaders,
    });
    res.end(vpsResponse.body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'VPS connection failed';
    console.error('[proxy/stage2] VPS http error:', msg);
    res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: msg, stage1_url: null }));
  }
}
