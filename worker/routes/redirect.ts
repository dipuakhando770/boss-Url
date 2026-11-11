
import { Database } from '../db';
import { generateRandomString, hashIp } from '../services/crypto';
import { ClickRecord } from '../types';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char];
  });
}

function renderHtml(title: string, body: string, status = 200): Response {
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex,nofollow">',
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    '<title>' + escapeHtml(title) + ' | Boss URL Shortener</title>',
    '<style>',
    '* { box-sizing: border-box; }',
    ':root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }',
    'body { min-height: 100vh; margin: 0; padding: 24px; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; }',
    '.card { width: 100%; max-width: 620px; padding: 40px; background: #1e293b; border: 1px solid #334155; border-radius: 18px; box-shadow: 0 20px 50px rgba(0,0,0,.28); }',
    '.status-icon { width: 54px; height: 54px; display: grid; place-items: center; margin-bottom: 22px; border-radius: 16px; background: rgba(34,197,94,.13); color: #4ade80; font-size: 28px; font-weight: 800; }',
    'h1 { margin: 0 0 12px; font-size: clamp(26px,5vw,34px); line-height: 1.2; }',
    'p { margin: 0 0 24px; color: #cbd5e1; font-size: 16px; line-height: 1.7; }',
    '.actions { display: grid; gap: 12px; }',
    '.button { display: flex; min-height: 50px; align-items: center; justify-content: center; padding: 14px 20px; border: 0; border-radius: 9px; background: #16a34a; color: #fff; font-size: 16px; font-weight: 700; text-align: center; text-decoration: none; cursor: pointer; transition: background .2s ease, transform .2s ease; }',
    '.button:hover { background: #15803d; transform: translateY(-1px); }',
    '.button-secondary { background: #334155; color: #e2e8f0; }',
    '.button-secondary:hover { background: #475569; }',
    '.note { margin: 20px 0 0; color: #94a3b8; font-size: 13px; text-align: center; }',
    '@media (max-width: 480px) { body { padding: 16px; } .card { padding: 28px 22px; } }',
    '</style>',
    '</head>',
    '<body>',
    '<main class="card">',
    body,
    '</main>',
    '</body>',
    '</html>',
  ].join('\n');

  return new Response(html, {
    status: status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    },
  });
}

function renderError(
  heading: string,
  message: string,
  status: number
): Response {
  const body =
    '<div class="status-icon" aria-hidden="true">!</div>' +
    '<h1>' + escapeHtml(heading) + '</h1>' +
    '<p>' + escapeHtml(message) + '</p>' +
    '<a class="button button-secondary" href="/">Go to Homepage</a>';

  return renderHtml(heading, body, status);
}

/**
 * YouTube Custom URI Redirect
 * Destination is fetched from database and encoded once in q.
 */
function createYouTubeRedirectUrl(destination: URL): string {
  const params = new URLSearchParams();

  params.set('event', 'comments');

  params.set(
    'redir_token',
    'QUlxb01IWV9meHRYVXo0akE0T1M5QzVNaS1XWXxBQnJ0NjltbHFBRmFqbXZXRDcxVEZsSmhILThkQWJWYlBmX25seWI1NXRzZEw5MVNxUkM3TUREeGcyZWdDakRIYTZuUkZKOXdJSjFBU1JJZ2pILW5vSGlIVmIycUc0OWthcmNJ'
  );

  params.set('q', destination.toString());
  params.set('html_redirect', '1');

  return 'vnd.youtube://youtube.com/redirect?' + params.toString();
}

export async function handleRedirectRoute(
  request: Request,
  code: string,
  db: Database
): Promise<Response> {

  // 1. Validate short code
  const shortCode = code.trim();

  if (!shortCode) {
    return renderError(
      'Invalid Short Link',
      'The short link code is missing or invalid.',
      400
    );
  }

  // 2. Database lookup
  let link: Awaited<ReturnType<Database['getLinkByStage1Code']>>;

  try {
    link = await db.getLinkByStage1Code(shortCode);
  } catch (error) {
    console.error('Redirect database lookup failed:', error);

    return renderError(
      'Service Temporarily Unavailable',
      'We could not look up this short link right now. Please try again shortly.',
      503
    );
  }

  // 3. Link not found
  if (!link) {
    return renderError(
      '404 - Link Not Found',
      'This short link does not exist, has expired, or is no longer available.',
      404
    );
  }

  // 4. Disabled link
  if (link.status === 'disabled') {
    return renderError(
      'Link Suspended',
      'This link has been suspended. Please contact the site administrator.',
      403
    );
  }

  // 5. Validate original URL
  let destinationUrl: URL;

  try {
    destinationUrl = new URL(link.original_url);

    if (
      destinationUrl.protocol !== 'https:' &&
      destinationUrl.protocol !== 'http:'
    ) {
      throw new Error('Invalid destination protocol');
    }

    if (destinationUrl.username || destinationUrl.password) {
      throw new Error('URL credentials are not allowed');
    }
  } catch {
    return renderError(
      'Invalid Destination',
      'The destination URL saved for this short link is invalid.',
      400
    );
  }

  // 6. Cloudflare analytics
  const cloudflare = (request as Request & {
    cf?: {
      country?: string;
      city?: string;
    };
  }).cf;

  const country =
    cloudflare?.country ||
    request.headers.get('cf-ipcountry') ||
    'Unknown';

  const city = cloudflare?.city || null;

  const rawIp =
    request.headers.get('cf-connecting-ip') || 'unknown';

  const userAgent =
    request.headers.get('user-agent') || '';

  const referrer = (
    request.headers.get('referer') ||
    request.headers.get('referrer') ||
    'Direct'
  ).slice(0, 1000);

  // 7. Device detection
  let deviceType = 'Desktop';

  if (/ipad|tablet|playbook|silk/i.test(userAgent)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android/i.test(userAgent)) {
    deviceType = 'Mobile';
  }

  // 8. Browser detection
  let browser = 'Other';

  if (/edg/i.test(userAgent)) {
    browser = 'Edge';
  } else if (/opr|opera/i.test(userAgent)) {
    browser = 'Opera';
  } else if (/firefox|fxios/i.test(userAgent)) {
    browser = 'Firefox';
  } else if (/chrome|crios/i.test(userAgent)) {
    browser = 'Chrome';
  } else if (/safari/i.test(userAgent)) {
    browser = 'Safari';
  }

  // 9. Save click analytics
  try {
    let ipHash = 'unknown';

    try {
      ipHash = await hashIp(rawIp);
    } catch (error) {
      console.error('IP hashing failed:', error);
    }

    const clickRecord: ClickRecord = {
      id: 'clk_' + generateRandomString(12),
      link_id: link.id,
      ip_hash: ipHash,
      country: country,
      city: city,
      referrer: referrer,
      user_agent: userAgent.slice(0, 255),
      device_type: deviceType,
      browser: browser,
      created_at: Date.now(),
    };

    const analyticsResults = await Promise.allSettled([
      db.recordClick(clickRecord),
      db.incrementLinkClicks(link.id),
    ]);

    for (const result of analyticsResults) {
      if (result.status === 'rejected') {
        console.error(
          'Click analytics operation failed:',
          result.reason
        );
      }
    }

  } catch (error) {
    console.error('Failed to prepare click analytics:', error);
  }

  // 10. Generate YouTube redirect URI
  const youtubeUrl =
    createYouTubeRedirectUrl(destinationUrl);

  const safeYouTubeUrl =
    escapeHtml(youtubeUrl);

  const safeBrowserUrl =
    escapeHtml(destinationUrl.toString());

  // 11. Intermediate redirect page
  // No countdown and no automatic redirect.
  const pageBody =
    '<div class="status-icon" aria-hidden="true">✓</div>' +
    '<h1>Great!</h1>' +
    '<p class="description">' +
    'Thanks for visiting.<br>' +
    'You are just one step away from your destination.' +
    '</p>' +
    '<div class="actions">' +
    '<a class="button" href="' +
    safeYouTubeUrl +
    '" rel="nofollow noopener noreferrer">Continue</a>' +
    '<a class="button button-secondary" href="' +
    safeBrowserUrl +
    '" rel="nofollow noopener noreferrer">Open in Browser</a>' +
    '</div>' +
    '<p class="note">' +
    'If the YouTube app does not open, use "Open in Browser".' +
    '</p>';

  return renderHtml(
    'Continue',
    pageBody,
    200
  );
}
