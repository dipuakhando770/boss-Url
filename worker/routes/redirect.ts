import { Database } from '../db';
import { generateRandomString, hashIp } from '../services/crypto';
import { ClickRecord } from '../types';

type CloudflareRequest = Request & {
  cf?: {
    country?: string;
    city?: string;
  };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml(
  title: string,
  body: string,
  status: number = 200,
  headExtra: string = ''
): Response {
  const html =
    '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>' + escapeHtml(title) + '</title>' +
    headExtra +
    '<style>' +
    '*{box-sizing:border-box}' +
    'html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif}' +
    'body{min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'padding:24px;background:#0b1020;color:#f8fafc}' +
    '.container{width:100%;max-width:440px;text-align:center;padding:38px 28px;' +
    'border:1px solid #27334d;border-radius:22px;background:#121a2d;' +
    'box-shadow:0 20px 60px rgba(0,0,0,.35)}' +
    '.status-icon{width:64px;height:64px;margin:0 auto 22px;border-radius:50%;' +
    'display:flex;align-items:center;justify-content:center;background:#123c32;' +
    'color:#4ade80;font-size:30px}' +
    'h1{font-size:27px;margin:0 0 12px;font-weight:700}' +
    '.description{font-size:15px;line-height:1.7;color:#b8c3d8;margin:0}' +
    '.note{font-size:13px;color:#8291aa;margin-top:20px}' +
    '@media(max-width:480px){.container{padding:32px 22px}}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<main class="container">' + body + '</main>' +
    '</body>' +
    '</html>';

  return new Response(html, {
    status: status,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY'
    }
  });
}

function renderError(
  title: string,
  message: string,
  status: number
): Response {
  const body =
    '<div class="status-icon" aria-hidden="true">!</div>' +
    '<h1>' + escapeHtml(title) + '</h1>' +
    '<p class="description">' + escapeHtml(message) + '</p>';

  return renderHtml(title, body, status);
}

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

function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (/ipad|tablet/.test(ua)) {
    return 'tablet';
  }

  if (/mobile|android|iphone|ipod/.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

function detectBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.indexOf('edg/') !== -1) {
    return 'Edge';
  }

  if (ua.indexOf('opr/') !== -1 || ua.indexOf('opera') !== -1) {
    return 'Opera';
  }

  if (ua.indexOf('firefox/') !== -1) {
    return 'Firefox';
  }

  if (ua.indexOf('chrome/') !== -1 && ua.indexOf('edg/') === -1) {
    return 'Chrome';
  }

  if (ua.indexOf('safari/') !== -1 && ua.indexOf('chrome/') === -1) {
    return 'Safari';
  }

  return 'Other';
}

export async function handleRedirectRoute(
  request: Request,
  code: string,
  db: Database
): Promise<Response> {
  // 1. Validate short code
  if (!code || typeof code !== 'string') {
    return renderError(
      'Invalid Link',
      'The short link is invalid.',
      400
    );
  }

  // 2. Get link from database
  let link: Awaited<ReturnType<Database['getLinkByStage1Code']>>;

  try {
    link = await db.getLinkByStage1Code(code);
  } catch (error) {
    console.error('Redirect database lookup failed:', error);

    return renderError(
      'Service Unavailable',
      'Please try again later.',
      503
    );
  }

  // 3. Link not found
  if (!link) {
    return renderError(
      'Link Not Found',
      'This short link does not exist or may have expired.',
      404
    );
  }

  // 4. Check link status
  if (link.status === 'disabled') {
    return renderError(
      'Link Disabled',
      'This short link is currently disabled.',
      403
    );
  }

  // 5. Validate original destination URL
  let destinationUrl: URL;

  try {
    destinationUrl = new URL(link.original_url);

    if (
      destinationUrl.protocol !== 'http:' &&
      destinationUrl.protocol !== 'https:'
    ) {
      throw new Error('Unsupported URL protocol');
    }

    if (destinationUrl.username || destinationUrl.password) {
      throw new Error('URL credentials are not allowed');
    }
  } catch (error) {
    console.error('Invalid destination URL:', error);

    return renderError(
      'Invalid Destination',
      'The destination URL is invalid.',
      400
    );
  }

  // 6. Collect click analytics
  const cfRequest = request as CloudflareRequest;
  const country =
    cfRequest.cf?.country ||
    request.headers.get('cf-ipcountry') ||
    'Unknown';

  const city = cfRequest.cf?.city || 'Unknown';
  const ipAddress =
    request.headers.get('cf-connecting-ip') || 'Unknown';

  const userAgent =
    request.headers.get('user-agent') || 'Unknown';

  const referrer =
    request.headers.get('referer') || 'Direct';

  const deviceType = detectDevice(userAgent);
  const browser = detectBrowser(userAgent);

  // 7. Hash visitor IP
  let ipHash = 'unknown';

  try {
    ipHash = await hashIp(ipAddress);
  } catch (error) {
    console.error('IP hashing failed:', error);
  }

  // 8. Create click record
  const clickRecord: ClickRecord = {
    id: 'clk_' + generateRandomString(12),
    link_id: link.id,
    ip_hash: ipHash,
    country: country,
    city: city,
    referrer: referrer,
    user_agent: userAgent.substring(0, 255),
    device_type: deviceType,
    browser: browser,
    created_at: Date.now()
  };

  // 9. Save analytics without blocking redirect
  const analyticsResults = await Promise.allSettled([
    db.recordClick(clickRecord),
    db.incrementLinkClicks(link.id)
  ]);

  analyticsResults.forEach(function (result) {
    if (result.status === 'rejected') {
      console.error('Click analytics failed:', result.reason);
    }
  });

  // 10. Create YouTube app URI and browser fallback
  const youtubeUrl = createYouTubeRedirectUrl(destinationUrl);

  const youtubeUrlForScript = JSON.stringify(youtubeUrl)
    .replace(/</g, '\\u003c');

  const browserUrlForScript = JSON.stringify(destinationUrl.toString())
    .replace(/</g, '\\u003c');

  const safeBrowserUrl = escapeHtml(destinationUrl.toString());

  // 11. Automatic redirect page
  const pageBody =
    '<div class="status-icon" aria-hidden="true">✓</div>' +
    '<h1>Great!</h1>' +
    '<p class="description">' +
    'Please wait while we redirect you to your destination.' +
    '</p>' +
    '<p class="note">Redirecting automatically...</p>' +
    '<script>' +
    '(function () {' +
    '  var youtubeUrl = ' + youtubeUrlForScript + ';' +
    '  var browserUrl = ' + browserUrlForScript + ';' +
    '  var fallbackTimer = window.setTimeout(function () {' +
    '    window.location.replace(browserUrl);' +
    '  }, 2200);' +
    '  function cancelFallback() {' +
    '    window.clearTimeout(fallbackTimer);' +
    '  }' +
    '  window.addEventListener("pagehide", cancelFallback, { once: true });' +
    '  document.addEventListener("visibilitychange", function () {' +
    '    if (document.visibilityState === "hidden") {' +
    '      cancelFallback();' +
    '    }' +
    '  });' +
    '  window.location.href = youtubeUrl;' +
    '})();' +
    '</script>';

  const headExtra =
    '<noscript>' +
    '<meta http-equiv="refresh" content="0;url=' +
    safeBrowserUrl +
    '">' +
    '</noscript>';

  return renderHtml(
    'Redirecting',
    pageBody,
    200,
    headExtra
  );
}
