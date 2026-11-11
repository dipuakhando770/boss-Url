if (destinationUrl.protocol !== 'http:' && destinationUrl.protocol !== 'https:') {
      throw new Error('Unsupported destination protocol');
    }
  } catch {
    return htmlPage(
      'Invalid Destination',
      `<h1>Invalid Destination</h1>
       <p>The destination URL for this short link is invalid. Please contact the site administrator.</p>`,
      400
    );
  }

  // Collect request analytics.
  const cf = (request as Request & {
    cf?: { country?: string; city?: string };
  }).cf || {};

  const country =
    cf.country || request.headers.get('cf-ipcountry') || 'Unknown';
  const city = cf.city || null;

  // Cloudflare's connecting IP header is preferred. Avoid trusting arbitrary
  // X-Forwarded-For values when the request is not behind a trusted proxy.
  const rawIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'unknown';

  const ipHash = await hashIp(rawIp);
  const userAgent = request.headers.get('user-agent') || '';
  const referrer =
    request.headers.get('referer') ||
    request.headers.get('referrer') ||
    'Direct';

  // Device detection: check tablet before mobile because some tablets
  // include "mobile" in their user-agent.
  let deviceType = 'Desktop';

  if (/ipad|tablet|playbook|silk/i.test(userAgent)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android/i.test(userAgent)) {
    deviceType = 'Mobile';
  }

  // Browser detection.
  let browser = 'Other';

  if (/edg/i.test(userAgent)) {
    browser = 'Edge';
  } else if (/firefox|fxios/i.test(userAgent)) {
    browser = 'Firefox';
  } else if (/opr|opera/i.test(userAgent)) {
    browser = 'Opera';
  } else if (/chrome|crios/i.test(userAgent)) {
    browser = 'Chrome';
  } else if (/safari/i.test(userAgent)) {
    browser = 'Safari';
  }

  // Record the visit to the intermediate page as a click.
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

  // Analytics failure must not prevent the user from reaching the Continue page.
  try {
    await db.recordClick(clickRecord);
    await db.incrementLinkClicks(link.id);
  } catch (err) {
    console.error('Failed to log click analytics:', err);
  }

  // Show the intermediate page. There is deliberately NO countdown or
  // automatic redirect: the visitor must press Continue.
  const safeDestination = escapeHtml(destinationUrl.toString());

  return htmlPage(
    'Continue',
    `<h1>Great!</h1>
     <p class="description">
       Thanks for visiting.
       <br>You are just a few steps away from your destination.
     </p>
     <a
       class="continue"
       href="${safeDestination}"
       rel="nofollow noopener noreferrer"
     >Continue</a>
     <p class="muted">Click Continue to open the destination.</p>`,
    200
  );
}
