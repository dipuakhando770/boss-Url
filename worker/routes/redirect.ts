import { Database } from '../db';
import { generateRandomString, hashIp } from '../services/crypto';
import { ClickRecord } from '../types';

export async function handleRedirectRoute(request: Request, code: string, db: Database): Promise<Response> {
  // Query link by stage1_code
  const link = await db.getLinkByStage1Code(code);
  if (!link) {
    return new Response(
      `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 - Link Not Found | Boss URL Shortener</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { text-align: center; max-width: 480px; padding: 2.5rem; background: #1e293b; border-radius: 1rem; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
          h1 { color: #38bdf8; font-size: 2.5rem; margin-bottom: 0.5rem; }
          p { color: #94a3b8; font-size: 1.1rem; line-height: 1.6; margin-bottom: 1.5rem; }
          a { display: inline-block; background: #0284c7; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; }
          a:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>404</h1>
          <h2>Link Not Found</h2>
          <p>The short link you followed does not exist, has expired, or was disabled by its owner.</p>
          <a href="/">Go to Boss URL Shortener</a>
        </div>
      </body>
      </html>`,
      {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }

  // Check if link is disabled
  if (link.status === 'disabled') {
    return new Response(
      `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Link Suspended</title>
        <style>
          body { font-family: sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { text-align: center; padding: 2rem; background: #1e293b; border-radius: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>This link has been suspended</h2>
          <p>Please contact the site administrator if you believe this is a mistake.</p>
        </div>
      </body>
      </html>`,
      {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  // Extract analytics from request headers
  const cf = (request as unknown as { cf?: { country?: string; city?: string } }).cf || {};
  const country = cf.country || request.headers.get('cf-ipcountry') || 'Unknown';
  const city = cf.city || null;
  const rawIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const ipHash = await hashIp(rawIp);
  const userAgent = request.headers.get('user-agent') || '';
  const referrer = request.headers.get('referer') || request.headers.get('referrer') || 'Direct';

  // Device detection
  let deviceType = 'Desktop';
  if (/mobile/i.test(userAgent)) deviceType = 'Mobile';
  else if (/tablet|ipad/i.test(userAgent)) deviceType = 'Tablet';

  // Browser detection
  let browser = 'Other';
  if (/chrome|crios/i.test(userAgent) && !/edg/i.test(userAgent)) browser = 'Chrome';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
  else if (/edg/i.test(userAgent)) browser = 'Edge';

  // Record click and increment counter asynchronously
  const clickRecord: ClickRecord = {
    id: 'clk_' + generateRandomString(12),
    link_id: link.id,
    ip_hash: ipHash,
    country,
    city,
    referrer,
    user_agent: userAgent.substring(0, 255),
    device_type: deviceType,
    browser,
    created_at: Date.now(),
  };

  // Wait for click logging and counter increment
  try {
    await db.recordClick(clickRecord);
    await db.incrementLinkClicks(link.id);
  } catch (err) {
    console.error('Failed to log click analytics:', err);
  }

  // Return HTTP 302 redirect to original destination URL
  return new Response(null, {
    status: 302,
    headers: {
      'Location': link.original_url,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
