request.headers.get('cf-ipcountry') ||
    'Unknown';

  const city = cloudflare?.city || null;
  const rawIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || '';

  // Do not store an unbounded referrer value.
  const referrer = (
    request.headers.get('referer') ||
    request.headers.get('referrer') ||
    'Direct'
  ).slice(0, 1000);

  // 6. Device detection.
  let deviceType = 'Desktop';

  if (/ipad|tablet|playbook|silk/i.test(userAgent)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android/i.test(userAgent)) {
    deviceType = 'Mobile';
  }

  // 7. Browser detection.
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

  // 8. Save analytics. Analytics errors must not break the redirect page.
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
      country,
      city,
      referrer,
      user_agent: userAgent.slice(0, 255),
      device_type: deviceType,
      browser,
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

  // 9. Build the YouTube URI using the database destination.
  const youtubeUrl = createYouTubeRedirectUrl(destinationUrl);

  // Escape both URLs before inserting them into HTML attributes.
  const safeYouTubeUrl = escapeHtml(youtubeUrl);
  const safeBrowserUrl = escapeHtml(destinationUrl.toString());

  // 10. Render the intermediate page. No countdown and no auto-redirect.
  return renderHtml(
    'Continue',
    `<div class="status-icon" aria-hidden="true">✓</div>
     <h1>Great!</h1>
     <p class="description">
       Thanks for visiting.
       <br>You are just one step away from your destination.
     </p>

     <div class="actions">
       <a
         class="button"
         href="${safeYouTubeUrl}"
         rel="nofollow noopener noreferrer"
       >Continue</a>

       <a
         class="button button-secondary"
         href="${safeBrowserUrl}"
         rel="nofollow noopener noreferrer"
       >Open in Browser</a>
     </div>

     <p class="note">
       If the YouTube app does not open, use “Open in Browser”.
     </p>`,
    200
  );
}
