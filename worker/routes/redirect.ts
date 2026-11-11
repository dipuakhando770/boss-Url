
import { Database } from '../db';
import { generateRandomString, hashIp } from '../services/crypto';
import { ClickRecord } from '../types';

type CFRequest = Request & {
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

function errorResponse(
  title: string,
  message: string,
  status: number
): Response {
  const html =
    '<!DOCTYPE html>' +
    '<html lang="en"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(title) + '</title>' +
    '<style>' +
    '*{box-sizing:border-box}' +
    'body{margin:0;min-height:100vh;display:grid;place-items:center;' +
    'background:#0b1020;color:#fff;font-family:Arial,sans-serif;padding:20px}' +
    '.card{max-width:430px;width:100%;padding:35px 25px;text-align:center;' +
    'background:#151e32;border:1px solid #293650;border-radius:18px}' +
    'h1{font-size:26px}p{color:#bac5d8;line-height:1.7}' +
    '</style></head><body>' +
    '<main class="card"><h1>' + escapeHtml(title) + '</h1>' +
    '<p>' + escapeHtml(message) + '</p></main></body></html>';

  return new Response(html, {
    status: status,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    }
  });
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

function isAndroid(userAgent: string): boolean {
  return /android/i.test(userAgent);
}

function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile';

  return 'desktop';
}

function detectBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.indexOf('edg/') !== -1) return 'Edge';
  if (ua.indexOf('opr/') !== -1) return 'Opera';
  if (ua.indexOf('firefox/') !== -1) return 'Firefox';

  if (
    ua.indexOf('chrome/') !== -1 &&
    ua.indexOf('edg/') === -1
  ) {
    return 'Chrome';
  }

  if (
    ua.indexOf('safari/') !== -1 &&
    ua.indexOf('chrome/') === -1
  ) {
    return 'Safari';
  }

  return 'Other';
}

function redirectPage(
  destination: URL,
  android: boolean
): Response {
  const originalUrl = destination.toString();
  const safeUrl = escapeHtml(originalUrl);

  const scriptUrl = JSON.stringify(originalUrl).replace(
    /</g,
    '\\u003c'
  );

  let script = '';

  if (android) {
    const youtubeUrl = createYouTubeRedirectUrl(destination);

    const safeYoutubeUrl = JSON.stringify(youtubeUrl).replace(
      /</g,
      '\\u003c'
    );

    script =
      '(function(){' +
      'var appUrl=' + safeYoutubeUrl + ';' +
      'var webUrl=' + scriptUrl + ';' +
      'var timer=setTimeout(function(){' +
      'window.location.replace(webUrl);' +
      '},2500);' +
      'document.addEventListener("visibilitychange",function(){' +
      'if(document.hidden){clearTimeout(timer);}' +
      '});' +
      'window.location.href=appUrl;' +
      '})();';
  } else {
    script =
      'window.location.replace(' + scriptUrl + ');';
  }

  const html =
    '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<meta http-equiv="refresh" content="5;url=' + safeUrl + '">' +
    '<title>Redirecting</title>' +
    '<style>' +
    '*{box-sizing:border-box}' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;' +
    'justify-content:center;padding:20px;background:#0b1020;color:#fff;' +
    'font-family:Arial,Helvetica,sans-serif}' +
    '.card{max-width:440px;width:100%;padding:40px 25px;text-align:center;' +
    'background:#151e32;border:1px solid #293650;border-radius:20px;' +
    'box-shadow:0 20px 60px rgba(0,0,0,.3)}' +
    '.icon{width:62px;height:62px;margin:0 auto 20px;border-radius:50%;' +
    'display:grid;place-items:center;background:#123c32;color:#4ade80;' +
    'font-size:30px}' +
    'h1{font-size:28px;margin:0 0 12px}' +
    'p{font-size:15px;color:#bac5d8;line-height:1.7;margin:0}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<main class="card">' +
    '<div class="icon">&#10003;</div>' +
    '<h1>Great!</h1>' +
    '<p>Please wait while we redirect you to your destination.</p>' +
    '</main>' +
    '<script>' + script + '</script>' +
    '</body></html>';

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY'
    }
  });
}

export async function handleRedirectRoute(
  request: Request,
  code: string,
  db: Database
): Promise<Response> {
  if (!code || typeof code !== 'string') {
    return errorResponse(
      'Invalid Link',
      'The short link is invalid.',
      400
    );
  }

  let link: any;

  try {
    link = await db.getLinkByStage1Code(code);
  } catch (error) {
    console.error('Database lookup error:', error);

    return errorResponse(
      'Service Unavailable',
      'Please try again later.',
      503
    );
  }

  if (!link) {
    return errorResponse(
      'Link Not Found',
      'This short link does not exist or has expired.',
      404
    );
  }

  if (link.status === 'disabled') {
    return errorResponse(
      'Link Disabled',
      'This short link is currently disabled.',
      403
    );
  }

  let destination: URL;

  try {
    destination = new URL(link.original_url);

    if (
      destination.protocol !== 'https:' &&
      destination.protocol !== 'http:'
    ) {
      throw new Error('Unsupported URL protocol');
    }

    if (destination.username || destination.password) {
      throw new Error('URL credentials are not allowed');
    }
  } catch (error) {
    console.error('Invalid destination:', error);

    return errorResponse(
      'Invalid Destination',
      'The destination URL is invalid.',
      400
    );
  }

  const cfRequest = request as CFRequest;

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

  let ipHash = 'unknown';

  try {
    ipHash = await hashIp(ipAddress);
  } catch (error) {
    console.error('IP hash error:', error);
  }

  const clickRecord: ClickRecord = {
    id: 'clk_' + generateRandomString(12),
    link_id: link.id,
    ip_hash: ipHash,
    country: country,
    city: city,
    referrer: referrer,
    user_agent: userAgent.substring(0, 255),
    device_type: detectDevice(userAgent),
    browser: detectBrowser(userAgent),
    created_at: Date.now()
  };

  const analytics = await Promise.allSettled([
    db.recordClick(clickRecord),
    db.incrementLinkClicks(link.id)
  ]);

  analytics.forEach(function (result) {
    if (result.status === 'rejected') {
      console.error('Analytics error:', result.reason);
    }
  });

  return redirectPage(
    destination,
    isAndroid(userAgent)
  );
}
