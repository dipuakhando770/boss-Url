import { Database } from '../db';
import { authenticateUser, jsonResponse } from './auth';
import { processTwoStageShortening } from '../services/shortener';
import { extractAndValidateHostname, isDomainApproved } from '../services/domain';
import { Env } from '../types';

export async function handleLinkRoutes(request: Request, url: URL, db: Database, env: Env): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  // 1. POST /api/links/check-domain (Public or authenticated domain checker tool)
  if (path === '/api/links/check-domain' && method === 'POST') {
    try {
      const body = await request.json<{ url?: string }>();
      const rawUrl = body.url || '';
      if (!rawUrl) {
        return jsonResponse({ error: 'URL is required' }, 400);
      }

      let hostname: string;
      try {
        const validated = extractAndValidateHostname(rawUrl);
        hostname = validated.hostname;
      } catch (err: unknown) {
        return jsonResponse({
          isValid: false,
          error: err instanceof Error ? err.message : 'Invalid URL format',
        }, 400);
      }

      const approvedDomains = await db.getApprovedDomains();
      const approved = isDomainApproved(hostname, approvedDomains);

      return jsonResponse({
        isValid: true,
        hostname,
        isApproved: approved,
        banglaMessage: approved ? 'ডোমেইন অনুমোদিত।' : 'এই ডোমেইনটি এখনো অনুমোদিত নয়। অনুমোদনের জন্য অ্যাডমিনের সঙ্গে যোগাযোগ করুন।',
      });
    } catch {
      return jsonResponse({ error: 'Failed to check domain' }, 500);
    }
  }

  // Require authentication for all subsequent link routes
  const auth = await authenticateUser(request, db);
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized. Please login to continue.' }, 401);
  }

  // 2. POST /api/links/shorten (Two-stage shortening pipeline)
  if (path === '/api/links/shorten' && method === 'POST') {
    try {
      const body = await request.json<{ url?: string; custom_code?: string; title?: string }>();
      const destinationUrl = (body.url || '').trim();
      const customCode = (body.custom_code || '').trim();
      const title = (body.title || '').trim();

      if (!destinationUrl) {
        return jsonResponse({ error: 'Destination URL is required' }, 400);
      }

      const stage1Domain = env.STAGE1_DOMAIN || 'https://urlshort.nasirdigitalhub.com';
      const stage2ApiUrl = env.STAGE2_API_URL || 'http://107.174.37.180/api/links/stage1';
const bossVpsApiBaseUrl = env.BOSS_VPS_API_BASE_URL || 'http://107.174.37.180';

      const result = await processTwoStageShortening(db, {
        originalUrl: destinationUrl,
        customCode,
        title,
        user: auth.user,
        stage1Domain,
        stage2ApiUrl,
        bossVpsApiBaseUrl,
        proxyGatewayUrl: env.PROXY_GATEWAY_URL,
      });

      if (!result.success) {
        return jsonResponse({
          error: result.error,
          errorCode: result.errorCode,
          banglaMessage: result.banglaMessage,
        }, result.status);
      }

      return jsonResponse({
        success: true,
        final_url: result.finalUrl,
        stage1_url: result.link?.stage1_url,
        stage1_code: result.link?.stage1_code,
        link: result.link,
      }, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process URL shortening';
      return jsonResponse({ error: msg }, 500);
    }
  }

  // 3. GET /api/links (List user links)
  if (path === '/api/links' && method === 'GET') {
    const search = url.searchParams.get('q') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const offset = (page - 1) * limit;

    const data = await db.listUserLinks(auth.user.id, search, limit, offset);
    return jsonResponse({
      links: data.links,
      total: data.total,
      page,
      limit,
    });
  }

  // 4. GET /api/links/:id/stats
  const statsMatch = path.match(/^\/api\/links\/([a-zA-Z0-9_-]+)\/stats$/);
  if (statsMatch && method === 'GET') {
    const linkId = statsMatch[1];
    const link = await db.getLinkById(linkId);
    if (!link || (link.user_id !== auth.user.id && auth.user.role !== 'admin')) {
      return jsonResponse({ error: 'Link not found' }, 404);
    }

    const analytics = await db.getLinkAnalytics(linkId);
    return jsonResponse({
      link,
      analytics,
    });
  }

  // 5. DELETE /api/links/:id
  const deleteMatch = path.match(/^\/api\/links\/([a-zA-Z0-9_-]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const linkId = deleteMatch[1];
    const link = await db.getLinkById(linkId);
    if (!link || (link.user_id !== auth.user.id && auth.user.role !== 'admin')) {
      return jsonResponse({ error: 'Link not found' }, 404);
    }

    await db.deleteLink(linkId, auth.user.role === 'admin' ? undefined : auth.user.id);
    return jsonResponse({ success: true, message: 'Link deleted successfully' });
  }

  return jsonResponse({ error: 'Link endpoint not found' }, 404);
}
