}

  const cloudflare = (request as Request & {
    cf?: { country?: string; city?: string };
  }).cf;

  const country =
    cloudflare?.country || request.headers.get('cf-ipcountry') || 'Unknown';
  const city = cloudflare?.city || null;
  const rawIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || '';
  const referrer = (
    request.headers.get('referer') ||
    request.headers.get('referrer') ||
    'Direct'
  ).slice(0, 1000);

  let deviceType = 'Desktop';
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android/i.test(userAgent)) {
    deviceType = 'Mobile';
  }

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
        console.error('Click analytics operation failed:', result.reason);
      }
    }
  } catch (error) {
    console.error('Failed to prepare click analytics:', error);
  }

  const youtubeUrl = createYouTubeRedirectUrl(destinationUrl);

  // JSON encoding keeps URLs safe inside the inline JavaScript string.
  // Escape '<' as well so a URL cannot terminate the script element.
  const youtubeUrlForScript = JSON.stringify(youtubeUrl).replace(/</g, '\\u003c');
  const browserUrlForScript = JSON.stringify(destinationUrl.toString()).replace(/</g, '\\u003c');
  const safeBrowserUrl = escapeHtml(destinationUrl.toString());

  // Automatically try the YouTube URI. If the browser cannot hand off to
  // the app, fall back to the original HTTP(S) URL from the database.
  // This is not a visible countdown and no user click is required.
  const pageBody =
    '<div class="status-icon" aria-hidden="true">✓</div>' +
    '<h1>Great!</h1>' +
    '<p class="description">Please wait while we redirect you to your destination.</p>' +
    '<p class="note">Redirecting automatically...</p>' +
    '<noscript><meta http-equiv="refresh" content="0;url=' + safeBrowserUrl + '"></noscript>' +
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
    '    if (document.visibilityState === "hidden") cancelFallback();' +
    '  });' +
    '  window.location.href = youtubeUrl;' +
    '})();' +
    '</script>';

  return renderHtml('Redirecting', pageBody, 200);
}
