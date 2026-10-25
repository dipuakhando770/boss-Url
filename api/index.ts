/**
 * Boss URL Shortener — Vercel Node.js Serverless Handler
 *
 * RUNTIME: Node.js (runtime: 'nodejs')
 * This adapter bridges Vercel's Node.js (req, res) signature to the Web Standard
 * Request/Response API used by the internal route handlers.
 *
 * WHY NODE.JS:
 *   - Vercel Edge / WinterCG runtimes block outbound fetch() to raw IPv4 addresses
 *     (e.g. http://107.174.37.180/), returning:
 *     "Direct IP access is not allowed in Vercel's Edge environment"
 *   - Vercel Node.js serverless functions use plain Node.js networking (net.Socket)
 *     and CAN reach the VPS over HTTP on port 80 with no restriction.
 *   - The /api/proxy/stage2 endpoint in this file acts as the HTTP bridge that the
 *     Cloudflare Worker calls when it cannot reach the VPS directly.
 *
 * FINAL SHORT-LINK DOMAIN: http://107.174.37.180/
 * The returned final_url is ALWAYS the exact URL returned by the VPS — never fabricated.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Database } from '../worker/db';
import { globalMemoryDb } from '../worker/db/memory-d1';
import { handleAuthRoutes } from '../worker/routes/auth';
import { handleLinkRoutes } from '../worker/routes/links';
import { handleAdminRoutes } from '../worker/routes/admin';
import { Env } from '../worker/types';

/** Tell Vercel to use the Node.js Lambda runtime, not Edge */
export const config = {
  runtime: 'nodejs',
};

// ---------------------------------------------------------------------------
// Helpers to bridge Node.js IncomingMessage → Web Standard Request
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function buildWebRequest(req: IncomingMessage, bodyBuffer: Buffer): Request {
  // req.url is relative (e.g. "/api/health"). Build an absolute URL so that
  // `new URL(request.url)` works inside the route handlers.
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    req.headers.host ||
    'localhost';
  const absoluteUrl = `${proto}://${host}${req.url}`;

  const headersInit: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headersInit[key] = Array.isArray(value) ? value.join(', ') : value;
    }
  }

  return new Request(absoluteUrl, {
    method: req.method || 'GET',
    headers: headersInit,
    // GET/HEAD must not have a body
    body: req.method !== 'GET' && req.method !== 'HEAD' && bodyBuffer.length > 0
      ? bodyBuffer
      : undefined,
  });
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, x-session-id',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ---------------------------------------------------------------------------
// Build the shared Env object from process.env
// ---------------------------------------------------------------------------

function getEnv(key: string, fallback = ''): string {
  return (typeof process !== 'undefined' && process.env[key]) || fallback;
}

function buildEnv(): Env {
  return {
    DB: (globalThis as any).DB || globalMemoryDb,
    APP_NAME: 'Boss URL Shortener SaaS',
    STAGE1_DOMAIN: getEnv('STAGE1_DOMAIN', 'https://urlshort.nasirdigitalhub.com'),
    // For the Vercel Node.js runtime, Stage 2 calls the VPS directly (no IP restriction).
    // Keep STAGE2_API_URL as the raw VPS endpoint so the Node.js function bypasses the proxy.
    STAGE2_API_URL: getEnv('STAGE2_API_URL', 'http://107.174.37.180/api/links/stage1'),
    // PROXY_GATEWAY_URL is not needed on the Vercel Node.js side (it IS the proxy).
    // Set it to empty so shortener.ts does not try to call itself recursively.
    PROXY_GATEWAY_URL: '',
    ADMIN_PATH: '/nachid/admin',
    BOOTSTRAP_SECRET: getEnv('BOOTSTRAP_SECRET', 'boss-bootstrap-secret-2026'),
    JWT_SECRET: getEnv('JWT_SECRET', 'boss-jwt-secret-2026'),
  };
}

// ---------------------------------------------------------------------------
// Core handler — takes a Web Standard Request, returns a Web Standard Response
// ---------------------------------------------------------------------------

async function routeRequest(webRequest: Request): Promise<Response> {
  let url: URL;
  try {
    url = new URL(webRequest.url);
  } catch {
    return new Response(JSON.stringify({ error: 'Malformed request URL', success: false }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const env = buildEnv();
  const db = new Database(env.DB);
  const path = url.pathname;

  // 1. Auth routes
  if (path.startsWith('/api/auth')) {
    return handleAuthRoutes(webRequest, url, db, {
      BOOTSTRAP_SECRET: env.BOOTSTRAP_SECRET,
    });
  }

  // 2. Link routes (includes /api/links/shorten which calls the VPS)
  if (path.startsWith('/api/links')) {
    return handleLinkRoutes(webRequest, url, db, env);
  }

  // 3. Admin routes
  if (path.startsWith('/api/admin')) {
    return handleAdminRoutes(webRequest, url, db);
  }

  // 4. Health check
  if (path === '/api/health' || path === '/api') {
    return new Response(
      JSON.stringify({
        status: 'UP',
        app: 'Boss URL Shortener SaaS (Vercel Node.js Serverless)',
        runtime: 'nodejs',
        timestamp: new Date().toISOString(),
        vpsEndpoint: 'http://107.174.37.180/api/links/stage1',
        note: 'Node.js runtime can reach the VPS IP directly over HTTP.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 5. /api/proxy/stage2  — HTTPS gateway so the Cloudflare Worker can reach the VPS.
  //    The Cloudflare Worker (which cannot fetch raw IPs) POSTs to this endpoint.
  //    This Node.js function then forwards to http://107.174.37.180/api/links/stage1.
  //    The final VPS URL in the response (http://107.174.37.180/s1_...) is returned as-is.
  if (path === '/api/proxy/stage2' && webRequest.method === 'POST') {
    let payload: string;
    try {
      payload = await webRequest.text();
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to read request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const VPS_API_URL = 'http://107.174.37.180/api/links/stage1';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      const vpsRes = await fetch(VPS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Boss-URL-Shortener-Proxy/1.0',
          // Send no Host override — VPS Nginx accepts any Host header
        },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const vpsBody = await vpsRes.text();
      // Pass the exact VPS response status and body back to the caller.
      // The caller (shortener.ts) reads stage1_url which is http://107.174.37.180/s1_...
      return new Response(vpsBody, {
        status: vpsRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? (err.name === 'AbortError' ? 'VPS request timed out (12s)' : err.message)
        : 'VPS connection failed';
      console.error('[proxy/stage2] VPS fetch error:', msg);
      return new Response(JSON.stringify({ error: msg, stage1_url: null }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (path === '/api/proxy/stage2' && webRequest.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found', success: false }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Vercel Node.js entry point — (req: IncomingMessage, res: ServerResponse)
// ---------------------------------------------------------------------------

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const origin = (req.headers['origin'] as string) || '*';
  const corsHeaders = buildCorsHeaders(origin);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  let webResponse: Response;
  try {
    const bodyBuffer = await readBody(req);
    const webRequest = buildWebRequest(req, bodyBuffer);
    webResponse = await routeRequest(webRequest);
  } catch (err: unknown) {
    console.error('[Vercel API] Unhandled error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal Server Error',
        success: false,
      })
    );
    return;
  }

  // Bridge Web Standard Response → Node.js ServerResponse
  const responseHeaders: Record<string, string> = { ...corsHeaders };
  webResponse.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  res.writeHead(webResponse.status, responseHeaders);

  const bodyText = await webResponse.text();
  res.end(bodyText);
}
