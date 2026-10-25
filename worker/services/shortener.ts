import { Database } from '../db';
import { extractAndValidateHostname, isDomainApproved } from './domain';
import { generateShortCode } from './crypto';
import { LinkRecord, Stage2ApiResponse, UserRecord } from '../types';

export interface ShortenOptions {
  originalUrl: string;
  customCode?: string;
  title?: string;
  user: UserRecord;
  stage1Domain: string;
  stage2ApiUrl: string;
  /**
   * Optional HTTPS proxy gateway for runtimes that block raw-IP HTTP requests
   * (Cloudflare Workers, Vercel Edge). When provided and the primary stage2ApiUrl
   * fails with an IP-restriction error, the shortener retries via this gateway.
   * Example: https://boss-url.vercel.app/api/proxy/stage2
   * The gateway is a Vercel Node.js function that forwards to the VPS over HTTP.
   * The final returned URL is still http://107.174.37.180/s1_... — never changed.
   */
  proxyGatewayUrl?: string;
}

export interface ShortenResult {
  success: boolean;
  link?: LinkRecord;
  finalUrl?: string;
  error?: string;
  errorCode?: string;
  banglaMessage?: string;
  status: number;
}

export async function processTwoStageShortening(
  db: Database,
  options: ShortenOptions
): Promise<ShortenResult> {
  const { originalUrl, customCode, title, user, stage1Domain, stage2ApiUrl, proxyGatewayUrl } = options;

  // 1. Validate destination URL and extract hostname
  let hostname: string;
  let sanitizedUrl: string;
  try {
    const validated = extractAndValidateHostname(originalUrl);
    hostname = validated.hostname;
    sanitizedUrl = validated.sanitizedUrl;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid destination URL';
    return {
      success: false,
      error: msg,
      errorCode: 'INVALID_URL',
      status: 400,
    };
  }

  // 2. Check domain approval
  const approvedList = await db.getApprovedDomains();
  if (!isDomainApproved(hostname, approvedList)) {
    return {
      success: false,
      error: `The destination domain "${hostname}" is not approved.`,
      errorCode: 'DOMAIN_NOT_REGISTERED',
      banglaMessage: 'এই ডোমেইনটি এখনো অনুমোদিত নয়। অনুমোদনের জন্য অ্যাডমিনের সঙ্গে যোগাযোগ করুন।',
      status: 403,
    };
  }

  // 3. Check User Subscription & Quota
  const subscription = await db.getUserActiveSubscription(user.id);
  if (!subscription) {
    return {
      success: false,
      error: 'You do not have an active subscription package. Please subscribe to shorten links.',
      errorCode: 'NO_ACTIVE_SUBSCRIPTION',
      status: 402,
    };
  }

  const quota = subscription.link_quota || 0;
  if (subscription.links_used >= quota) {
    return {
      success: false,
      error: `Subscription link quota reached (${subscription.links_used}/${quota}). Please upgrade your package.`,
      errorCode: 'QUOTA_EXCEEDED',
      status: 403,
    };
  }

  // 4. Generate or validate Stage 1 code
  let stage1Code = (customCode || '').trim();
  if (stage1Code) {
    // Validate custom code format (alphanumeric, dashes, underscores, length 3-30)
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(stage1Code)) {
      return {
        success: false,
        error: 'Custom short code must be 3-30 characters alphanumeric, dashes or underscores.',
        errorCode: 'INVALID_CUSTOM_CODE',
        status: 400,
      };
    }
    // Check collision
    const existing = await db.getLinkByStage1Code(stage1Code);
    if (existing) {
      return {
        success: false,
        error: 'This short code is already taken. Please choose another.',
        errorCode: 'CODE_ALREADY_EXISTS',
        status: 409,
      };
    }
  } else {
    // Generate unique random code
    let attempts = 0;
    while (attempts < 5) {
      const candidate = generateShortCode(6);
      const existing = await db.getLinkByStage1Code(candidate);
      if (!existing) {
        stage1Code = candidate;
        break;
      }
      attempts++;
    }
    if (!stage1Code) {
      return {
        success: false,
        error: 'Failed to generate a unique short code. Please try again.',
        errorCode: 'CODE_GENERATION_FAILED',
        status: 500,
      };
    }
  }

  // 5. Construct real Stage 1 Boss URL
  const cleanBaseDomain = stage1Domain.replace(/\/+$/, '');
  const stage1Url = `${cleanBaseDomain}/${stage1Code}`;
  const linkId = 'lnk_' + generateShortCode(12);
  const now = Date.now();

  // 6. Persist Stage 1 in D1
  const stage1Record: Omit<LinkRecord, 'updated_at' | 'clicks_count'> = {
    id: linkId,
    user_id: user.id,
    original_url: sanitizedUrl,
    destination_domain: hostname,
    stage1_code: stage1Code,
    stage1_url: stage1Url,
    stage2_code: null,
    stage2_id: null,
    final_url: null,
    title: title || hostname,
    status: 'pending',
    error_message: null,
    created_at: now,
  };

  try {
    await db.createStage1Link(stage1Record);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error while saving Stage 1 link';
    return {
      success: false,
      error: msg,
      errorCode: 'DATABASE_ERROR',
      status: 500,
    };
  }

  // 7. Dispatch to Stage 2 VPS API with exact contract
  let stage2ResponseData: Stage2ApiResponse | null = null;
  let vpsErrorDetail = '';

  const callVpsEndpoint = async (targetEndpoint: string): Promise<{ data: Stage2ApiResponse | null; error: string }> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Boss-URL-Shortener/1.0',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ url: stage1Url }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        return { data: null, error: `VPS API HTTP ${res.status}: ${errText.substring(0, 200)}` };
      }
      const data = await res.json<Stage2ApiResponse>();
      return { data, error: '' };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { data: null, error: 'VPS API request timed out after 10000ms' };
      }
      return { data: null, error: err instanceof Error ? err.message : 'Network connection to VPS failed' };
    }
  };

  // --- Stage 2 Strategy ---
  // Primary: call the configured VPS endpoint directly (works in Node.js; blocked in CF/Edge).
  // Fallback: if the runtime blocks direct IP access (CF Error 1003 / Vercel Edge restriction),
  //   retry via the configured HTTPS proxy gateway (Vercel Node.js function).
  //   The gateway forwards to the VPS and returns the exact VPS response unchanged.
  //   The final_url in the response is ALWAYS http://107.174.37.180/s1_... — never rewritten.

  const primaryResult = await callVpsEndpoint(stage2ApiUrl);
  if (primaryResult.data && !primaryResult.data.error && primaryResult.data.stage1_url) {
    stage2ResponseData = primaryResult.data;
  } else {
    vpsErrorDetail = primaryResult.error || '';

    // Detect runtime-level direct-IP blocking (Cloudflare Error 1003 / Vercel Edge)
    const isDirectIpBlocked =
      vpsErrorDetail.includes('1003') ||
      vpsErrorDetail.includes('Direct IP') ||
      vpsErrorDetail.includes('direct IP');

    // Use gateway if: IP was blocked AND a gateway URL is configured AND primary != gateway
    const gateway = proxyGatewayUrl || '';
    const shouldUseGateway = isDirectIpBlocked && gateway && stage2ApiUrl !== gateway;

    if (shouldUseGateway) {
      console.warn(
        `[shortener] Direct IP blocked (${vpsErrorDetail.substring(0, 120)}). ` +
        `Retrying via HTTPS gateway: ${gateway}`
      );
      const fallbackResult = await callVpsEndpoint(gateway);
      if (fallbackResult.data && !fallbackResult.data.error && fallbackResult.data.stage1_url) {
        stage2ResponseData = fallbackResult.data;
        vpsErrorDetail = '';
      } else {
        vpsErrorDetail +=
          ` | Gateway fallback also failed: ${fallbackResult.error || 'unknown error'}`;
      }
    }
  }

  // 8. Validate Stage 2 VPS Response
  if (!stage2ResponseData || stage2ResponseData.error || !stage2ResponseData.stage1_url) {
    const finalErr = vpsErrorDetail || stage2ResponseData?.message || 'VPS failed to produce a valid Stage 2 URL';
    // Strict requirement: Update record to 'failed', do NOT fabricate success
    await db.updateStage2Failed(linkId, finalErr);

    return {
      success: false,
      error: `Stage 2 VPS API failed: ${finalErr}`,
      errorCode: 'STAGE2_VPS_FAILED',
      status: 502,
    };
  }

  // 9. Stage 2 Succeeded: Final URL extracted from VPS response (e.g. "http://107.174.37.180/s1_neCUtd")
  const finalShortUrl = stage2ResponseData.stage1_url;
  const stage2Code = stage2ResponseData.stage1_code || '';
  const stage2Id = stage2ResponseData.stage1_id || null;

  await db.updateStage2Completed(linkId, stage2Code, stage2Id || 0, finalShortUrl);
  // Increment user subscription quota usage
  await db.incrementSubscriptionUsage(subscription.id);

  const completedLink = await db.getLinkById(linkId);

  return {
    success: true,
    link: completedLink || undefined,
    finalUrl: finalShortUrl,
    status: 201,
  };
}
