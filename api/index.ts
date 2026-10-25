import { Database } from '../worker/db';
import { globalMemoryDb } from '../worker/db/memory-d1';
import { handleAuthRoutes } from '../worker/routes/auth';
import { handleLinkRoutes } from '../worker/routes/links';
import { handleAdminRoutes } from '../worker/routes/admin';
import { Env } from '../worker/types';

export const config = {
  runtime: 'edge',
};

function handleCors(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get('Origin') || '*';
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-session-id');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const corsHeaders = handleCors(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const getEnv = (key: string, fallback: string = ''): string => {
    try {
      return (typeof process !== 'undefined' && process.env && process.env[key]) || fallback;
    } catch {
      return fallback;
    }
  };

  // Use Cloudflare D1 if available in env, or the memory D1 fallback for Vercel
  const env: Env = {
    DB: (globalThis as any).DB || globalMemoryDb,
    APP_NAME: 'Boss URL Shortener SaaS',
    STAGE1_DOMAIN: getEnv('STAGE1_DOMAIN', 'https://urlshort.nasirdigitalhub.com'),
    STAGE2_API_URL: getEnv('STAGE2_API_URL', 'http://107.174.37.180/api/links/stage1'),
    ADMIN_PATH: '/nachid/admin',
    BOOTSTRAP_SECRET: getEnv('BOOTSTRAP_SECRET', 'boss-bootstrap-secret-2026'),
    JWT_SECRET: getEnv('JWT_SECRET', 'boss-jwt-secret-2026'),
  };

  const db = new Database(env.DB);

  try {
    // 1. Auth routes
    if (url.pathname.startsWith('/api/auth')) {
      const res = await handleAuthRoutes(request, url, db, {
        BOOTSTRAP_SECRET: env.BOOTSTRAP_SECRET,
      });
      corsHeaders.forEach((val, key) => res.headers.set(key, val));
      return res;
    }

    // 2. Links routes
    if (url.pathname.startsWith('/api/links')) {
      const res = await handleLinkRoutes(request, url, db, env);
      corsHeaders.forEach((val, key) => res.headers.set(key, val));
      return res;
    }

    // 3. Admin routes
    if (url.pathname.startsWith('/api/admin')) {
      const res = await handleAdminRoutes(request, url, db);
      corsHeaders.forEach((val, key) => res.headers.set(key, val));
      return res;
    }

    // 4. Health
    if (url.pathname === '/api/health' || url.pathname === '/api') {
      const res = new Response(JSON.stringify({
        status: 'UP',
        app: 'Boss URL Shortener SaaS (Vercel Serverless & Cloudflare Ready)',
        runtime: 'edge',
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(corsHeaders.entries()),
        },
      });
      return res;
    }

    // 5. VPS Stage 2 HTTPS Gateway Proxy (resolves Cloudflare Worker Error 1003 Direct IP restriction)
    if (url.pathname === '/api/proxy/stage2') {
      if (request.method === 'POST') {
        const payload = await request.text();
        const vpsRes = await fetch('http://107.174.37.180/api/links/stage1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Boss-URL-Shortener/1.0',
          },
          body: payload,
        });
        const vpsData = await vpsRes.text();
        return new Response(vpsData, {
          status: vpsRes.status,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(corsHeaders.entries()),
          },
        });
      }
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found', success: false }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(corsHeaders.entries()),
      },
    });
  } catch (err: unknown) {
    console.error('Vercel API Handler Error:', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Internal Server Error',
      success: false,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(corsHeaders.entries()),
      },
    });
  }
}
