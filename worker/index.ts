import { Env } from './types';
import { Database } from './db';
import { handleAuthRoutes, jsonResponse } from './routes/auth';
import { handleLinkRoutes } from './routes/links';
import { handleAdminRoutes } from './routes/admin';
import { handleRedirectRoute } from './routes/redirect';

function handleCors(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get('Origin') || '*';
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = handleCors(request);

    // Handle OPTIONS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const db = new Database(env.DB);

    try {
      // 1. API Route: Authentication
      if (url.pathname.startsWith('/api/auth')) {
        const response = await handleAuthRoutes(request, url, db, {
          BOOTSTRAP_SECRET: env.BOOTSTRAP_SECRET,
        });
        // Merge CORS headers
        corsHeaders.forEach((val, key) => response.headers.set(key, val));
        return response;
      }

      // 2. API Route: Links & Shortener
      if (url.pathname.startsWith('/api/links')) {
        const response = await handleLinkRoutes(request, url, db, env);
        corsHeaders.forEach((val, key) => response.headers.set(key, val));
        return response;
      }

      // 3. API Route: Admin Management
      if (url.pathname.startsWith('/api/admin')) {
        const response = await handleAdminRoutes(request, url, db);
        corsHeaders.forEach((val, key) => response.headers.set(key, val));
        return response;
      }

      // 4. API Route: Health & Diagnostics
      if (url.pathname === '/api/health') {
        return jsonResponse({
          status: 'ok',
          app: env.APP_NAME || 'Boss URL Shortener SaaS',
          environment: env.ENVIRONMENT || 'production',
          stage1_domain: env.STAGE1_DOMAIN || 'https://urlshort.nasirdigitalhub.com',
          stage2_api_url: env.STAGE2_API_URL || 'http://107.174.37.180/api/links/stage1',
          timestamp: new Date().toISOString(),
        }, 200, corsHeaders);
      }

      // 5. Short Code Redirect Route (/:code)
      // Matches single path parameter like /s1_XYZ or /ABC123
      const pathSegment = url.pathname.slice(1);
      const isReservedPath = 
        !pathSegment ||
        pathSegment.includes('/') ||
        pathSegment === 'login' ||
        pathSegment === 'register' ||
        pathSegment === 'dashboard' ||
        pathSegment === 'nachid' ||
        pathSegment === 'admin' ||
        pathSegment === 'api' ||
        pathSegment.startsWith('assets') ||
        pathSegment === 'favicon.ico' ||
        pathSegment === 'robots.txt' ||
        pathSegment === 'sitemap.xml';

      if (!isReservedPath && request.method === 'GET') {
        const redirectRes = await handleRedirectRoute(request, pathSegment, db);
        return redirectRes;
      }

      // 6. Static Assets (React SPA) via Cloudflare Assets binding
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }

      return new Response('Boss URL Shortener Worker is running.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch (err: unknown) {
      console.error('Unhandled Worker error:', err);
      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      return jsonResponse({ error: msg }, 500, corsHeaders);
    }
  },
};
