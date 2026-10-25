import { Database } from '../db';
import { hashPassword, verifyPassword, generateRandomString } from '../services/crypto';
import { UserRecord, SessionRecord, SubscriptionRecord } from '../types';

export function jsonResponse(data: unknown, status: number = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export async function handleAuthRoutes(
  request: Request,
  url: URL,
  db: Database,
  env: { BOOTSTRAP_SECRET?: string }
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  // 1. POST /api/auth/register
  if (path === '/api/auth/register' && method === 'POST') {
    try {
      const body = await request.json<{ email?: string; password?: string; name?: string }>();
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';
      const name = (body.name || '').trim();

      if (!email || !email.includes('@') || email.length < 5) {
        return jsonResponse({ error: 'Valid email address is required' }, 400);
      }
      if (!password || password.length < 6) {
        return jsonResponse({ error: 'Password must be at least 6 characters long' }, 400);
      }
      if (!name) {
        return jsonResponse({ error: 'Name is required' }, 400);
      }

      // Check existing user
      const existing = await db.getUserByEmail(email);
      if (existing) {
        return jsonResponse({ error: 'An account with this email already exists' }, 409);
      }

      const { hash, salt } = await hashPassword(password);
      const userId = 'usr_' + generateRandomString(10);
      const now = Date.now();

      const newUser: Omit<UserRecord, 'updated_at'> = {
        id: userId,
        email,
        password_hash: hash,
        salt,
        name,
        role: 'user', // NEVER allow public registration to set admin
        status: 'active',
        created_at: now,
      };

      await db.createUser(newUser);

      // Auto-assign default Starter package (30 days, 50 links)
      const packages = await db.getPackages();
      const starterPkg = packages.find(p => p.id === 'pkg_starter') || packages[0];
      if (starterPkg) {
        const subId = 'sub_' + generateRandomString(10);
        const subRecord: SubscriptionRecord = {
          id: subId,
          user_id: userId,
          package_id: starterPkg.id,
          links_used: 0,
          starts_at: now,
          expires_at: now + starterPkg.duration_days * 86400000,
          status: 'active',
          created_at: now,
        };
        await db.createSubscription(subRecord);
      }

      // Create session
      const sessionToken = generateRandomString(32);
      const session: SessionRecord = {
        id: 'ses_' + generateRandomString(12),
        user_id: userId,
        token: sessionToken,
        expires_at: now + 30 * 86400000, // 30 days
        created_at: now,
      };
      await db.createSession(session);

      return jsonResponse({
        success: true,
        token: sessionToken,
        user: {
          id: userId,
          email,
          name,
          role: 'user',
          status: 'active',
        },
      }, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      return jsonResponse({ error: msg }, 500);
    }
  }

  // 2. POST /api/auth/login
  if (path === '/api/auth/login' && method === 'POST') {
    try {
      const body = await request.json<{ email?: string; password?: string }>();
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      if (!email || !password) {
        return jsonResponse({ error: 'Email and password are required' }, 400);
      }

      const user = await db.getUserByEmail(email);
      if (!user) {
        return jsonResponse({ error: 'Invalid email or password' }, 401);
      }

      if (user.status === 'suspended') {
        return jsonResponse({ error: 'This account has been suspended. Please contact administrator.' }, 403);
      }

      const isValid = await verifyPassword(password, user.password_hash, user.salt);
      if (!isValid) {
        return jsonResponse({ error: 'Invalid email or password' }, 401);
      }

      const now = Date.now();
      const sessionToken = generateRandomString(32);
      const session: SessionRecord = {
        id: 'ses_' + generateRandomString(12),
        user_id: user.id,
        token: sessionToken,
        expires_at: now + 30 * 86400000,
        created_at: now,
      };
      await db.createSession(session);

      return jsonResponse({
        success: true,
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      return jsonResponse({ error: msg }, 500);
    }
  }

  // 3. POST /api/auth/logout
  if (path === '/api/auth/logout' && method === 'POST') {
    const token = getBearerToken(request);
    if (token) {
      await db.deleteSession(token);
    }
    return jsonResponse({ success: true, message: 'Logged out successfully' });
  }

  // 4. GET /api/auth/me
  if (path === '/api/auth/me' && method === 'GET') {
    const auth = await authenticateUser(request, db);
    if (!auth) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const subscription = await db.getUserActiveSubscription(auth.user.id);

    return jsonResponse({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        role: auth.user.role,
        status: auth.user.status,
        created_at: auth.user.created_at,
      },
      subscription,
    });
  }

  // 5. POST /api/auth/password
  if (path === '/api/auth/password' && method === 'POST') {
    const auth = await authenticateUser(request, db);
    if (!auth) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json<{ current_password?: string; new_password?: string }>();
    const current = body.current_password || '';
    const next = body.new_password || '';

    if (!current || !next || next.length < 6) {
      return jsonResponse({ error: 'New password must be at least 6 characters' }, 400);
    }

    const isValid = await verifyPassword(current, auth.user.password_hash, auth.user.salt);
    if (!isValid) {
      return jsonResponse({ error: 'Incorrect current password' }, 400);
    }

    const { hash, salt } = await hashPassword(next);
    await db.updateUserPassword(auth.user.id, hash, salt);

    return jsonResponse({ success: true, message: 'Password updated successfully' });
  }

  // 6. POST /api/auth/bootstrap (Protected by BOOTSTRAP_SECRET)
  if (path === '/api/auth/bootstrap' && method === 'POST') {
    const body = await request.json<{ bootstrap_secret?: string; email?: string; password?: string; name?: string }>();
    const secret = body.bootstrap_secret || '';
    const configuredSecret = env.BOOTSTRAP_SECRET || 'boss-bootstrap-secret-2026';

    if (!secret || secret !== configuredSecret) {
      return jsonResponse({ error: 'Forbidden: Invalid bootstrap secret' }, 403);
    }

    const email = (body.email || 'admin@nasirdigitalhub.com').trim().toLowerCase();
    const password = body.password || 'BossAdmin@2026';
    const name = body.name || 'Boss Super Admin';

    let user = await db.getUserByEmail(email);
    const { hash, salt } = await hashPassword(password);
    const now = Date.now();

    if (!user) {
      const userId = 'usr_admin_' + generateRandomString(6);
      await db.createUser({
        id: userId,
        email,
        password_hash: hash,
        salt,
        name,
        role: 'admin',
        status: 'active',
        created_at: now,
      });
      user = await db.getUserById(userId);
    } else {
      await db.updateUserPassword(user.id, hash, salt);
      // Promote to admin if not already
      await db.updateUserStatus(user.id, 'active');
    }

    return jsonResponse({
      success: true,
      message: 'Admin bootstrapped successfully',
      email,
      role: 'admin',
    });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  // Also check cookie
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/boss_session=([^;]+)/);
  if (match) {
    return match[1];
  }
  return null;
}

export async function authenticateUser(request: Request, db: Database): Promise<{ session: SessionRecord; user: UserRecord } | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const result = await db.getSessionWithUser(token);
  if (!result || result.user.status === 'suspended') {
    return null;
  }
  return result;
}
