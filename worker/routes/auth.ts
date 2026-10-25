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

export function secureSecretCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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
      const body = await request.json<{ email?: string; password?: string; name?: string }>().catch(() => ({} as { email?: string; password?: string; name?: string }));
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';
      const name = (body.name || '').trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email) || email.length < 5) {
        return jsonResponse({
          error: 'Valid email address is required',
          errorCode: 'INVALID_EMAIL',
          banglaMessage: 'অনুগ্রহ করে একটি সঠিক ইমেইল এড্রেস প্রদান করুন।',
        }, 400);
      }
      if (!password || password.length < 6) {
        return jsonResponse({
          error: 'Password must be at least 6 characters long',
          errorCode: 'INVALID_PASSWORD',
          banglaMessage: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
        }, 400);
      }
      if (!name) {
        return jsonResponse({
          error: 'Full name is required',
          errorCode: 'INVALID_NAME',
          banglaMessage: 'অনুগ্রহ করে আপনার পুরো নাম প্রদান করুন।',
        }, 400);
      }

      // Check existing user for email uniqueness
      const existing = await db.getUserByEmail(email);
      if (existing) {
        return jsonResponse({
          error: 'An account with this email already exists',
          errorCode: 'EMAIL_ALREADY_EXISTS',
          banglaMessage: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি করা হয়েছে। অনুগ্রহ করে লগইন করুন।',
        }, 409);
      }

      const { hash, salt } = await hashPassword(password);
      const userId = 'usr_' + generateRandomString(10);
      const now = Date.now();

      // Ensure user role is always 'user' (never admin)
      const newUser: Omit<UserRecord, 'updated_at'> = {
        id: userId,
        email,
        password_hash: hash,
        salt,
        name,
        role: 'user',
        status: 'active',
        created_at: now,
      };

      await db.createUser(newUser);

      // Requirement 6: Ensure Free Starter Plan (30 days, 50 links quota) is reliably created
      const packages = await db.getPackages();
      let starterPkg = packages.find(p => p.id === 'pkg_starter');
      if (!starterPkg) {
        starterPkg = {
          id: 'pkg_starter',
          name: 'Starter Free',
          duration_days: 30,
          link_quota: 50,
          price: 0.00,
          is_active: 1,
          created_at: now,
        };
        try {
          await db.createPackage(starterPkg);
        } catch {
          // If already created concurrently, retrieve again
          const refreshed = await db.getPackages();
          starterPkg = refreshed.find(p => p.id === 'pkg_starter') || starterPkg;
        }
      }

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

      // Create session token
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
          created_at: now,
        },
        subscription: {
          ...subRecord,
          package_name: starterPkg.name,
          link_quota: starterPkg.link_quota,
        },
      }, 201);
    } catch (err: unknown) {
      console.error('Registration failure:', err);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('no such table')) {
        return jsonResponse({
          error: 'Database schema is not initialized. Please apply database migrations in Cloudflare D1.',
          errorCode: 'DATABASE_SCHEMA_MISSING',
          banglaMessage: 'ক্লাউডফ্লেয়ার D1 ডাটাবেস টেবিলগুলো তৈরি করা নেই। দয়া করে D1 মাইগ্রেশন রান করুন।',
        }, 503);
      }
      return jsonResponse({
        error: 'Registration failed due to a database error. Please try again.',
        errorCode: 'DATABASE_ERROR',
        banglaMessage: 'ডাটাবেস ত্রুটির কারণে রেজিস্ট্রেশন সম্পন্ন করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      }, 500);
    }
  }

  // 2. POST /api/auth/login
  if (path === '/api/auth/login' && method === 'POST') {
    try {
      const body = await request.json<{ email?: string; password?: string }>().catch(() => ({} as { email?: string; password?: string }));
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      if (!email || !password) {
        return jsonResponse({
          error: 'Email and password are required',
          errorCode: 'INVALID_CREDENTIALS',
          banglaMessage: 'ইমেইল এবং পাসওয়ার্ড প্রদান করা আবশ্যক।',
        }, 400);
      }

      const user = await db.getUserByEmail(email);
      if (!user) {
        return jsonResponse({
          error: 'Invalid email or password',
          errorCode: 'INVALID_CREDENTIALS',
          banglaMessage: 'ভুল ইমেইল বা পাসওয়ার্ড প্রদান করা হয়েছে।',
        }, 401);
      }

      if (user.status === 'suspended') {
        return jsonResponse({
          error: 'This account has been suspended. Please contact administrator.',
          errorCode: 'ACCOUNT_SUSPENDED',
          banglaMessage: 'আপনার অ্যাকাউন্টটি স্থগিত করা হয়েছে। অনুগ্রহ করে অ্যাডমিনের সঙ্গে যোগাযোগ করুন।',
        }, 403);
      }

      const isValid = await verifyPassword(password, user.password_hash, user.salt);
      if (!isValid) {
        return jsonResponse({
          error: 'Invalid email or password',
          errorCode: 'INVALID_CREDENTIALS',
          banglaMessage: 'ভুল ইমেইল বা পাসওয়ার্ড প্রদান করা হয়েছে।',
        }, 401);
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
      console.error('Login failure:', err);
      return jsonResponse({
        error: 'Login failed due to a server error',
        errorCode: 'SERVER_ERROR',
        banglaMessage: 'লগইন ব্যর্থ হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
      }, 500);
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
    try {
      const configuredSecret = (env.BOOTSTRAP_SECRET || '').trim();

      // 1. Verify BOOTSTRAP_SECRET is configured as a real Cloudflare Worker secret
      if (!configuredSecret || configuredSecret === 'replace-with-secure-wrangler-secret-in-production') {
        return jsonResponse(
          {
            error: 'Server configuration error: BOOTSTRAP_SECRET is not configured as a Cloudflare Worker secret. Please set it using "wrangler secret put BOOTSTRAP_SECRET".',
            errorCode: 'BOOTSTRAP_SECRET_NOT_CONFIGURED',
            banglaMessage: 'সার্ভারে বুটস্ট্র্যাপ সিক্রেট কনফিগার করা নেই। ক্লাউডফ্লেয়ার সিক্রেট হিসেবে BOOTSTRAP_SECRET সেট করুন।',
          },
          500
        );
      }

      const body = await request.json<{
        bootstrap_secret?: string;
        email?: string;
        password?: string;
        name?: string;
      }>().catch(() => ({} as any));

      const providedSecret = (body.bootstrap_secret || '').trim();
      if (!providedSecret) {
        return jsonResponse(
          {
            error: 'Bootstrap secret is required',
            errorCode: 'BOOTSTRAP_SECRET_REQUIRED',
            banglaMessage: 'বুটস্ট্র্যাপ সিক্রেট প্রদান করা আবশ্যক।',
          },
          400
        );
      }

      // 2. Validate bootstrap secret securely with constant-time comparison without logging
      if (!secureSecretCompare(providedSecret, configuredSecret)) {
        return jsonResponse(
          {
            error: 'Forbidden: Invalid bootstrap secret',
            errorCode: 'INVALID_BOOTSTRAP_SECRET',
            banglaMessage: 'ভুল বুটস্ট্র্যাপ সিক্রেট প্রদান করা হয়েছে।',
          },
          403
        );
      }

      // 3. Concurrency-safe check: only allow when no administrator already exists
      let adminCount = 0;
      try {
        adminCount = await db.countAdmins();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('no such table')) {
          await db.ensureSchema();
          adminCount = await db.countAdmins();
        } else {
          throw err;
        }
      }

      if (adminCount > 0) {
        return jsonResponse(
          {
            error: 'Administrator setup is closed. An administrator already exists. Please log in directly.',
            errorCode: 'ADMIN_ALREADY_EXISTS',
            banglaMessage: 'অ্যাডমিনিস্ট্রেটর অ্যাকাউন্ট ইতিমধ্যে তৈরি করা আছে। নতুন করে সেটআপ করা সম্ভব নয়। অনুগ্রহ করে লগইন করুন।',
          },
          403
        );
      }

      const email = (body.email || 'admin@nasirdigitalhub.com').trim().toLowerCase();
      const password = body.password || '';
      const name = (body.name || 'Boss Super Admin').trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return jsonResponse(
          {
            error: 'A valid email address is required for administrator setup',
            errorCode: 'INVALID_EMAIL',
            banglaMessage: 'সঠিক এডমিন ইমেইল এড্রেস প্রদান করুন।',
          },
          400
        );
      }

      if (!password || password.length < 8) {
        return jsonResponse(
          {
            error: 'Administrator password must be at least 8 characters long',
            errorCode: 'WEAK_PASSWORD',
            banglaMessage: 'এডমিন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।',
          },
          400
        );
      }

      // Check if user with this email already exists
      const existingUser = await db.getUserByEmail(email);
      if (existingUser) {
        return jsonResponse(
          {
            error: 'A user with this email already exists',
            errorCode: 'EMAIL_ALREADY_EXISTS',
            banglaMessage: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি করা হয়েছে।',
          },
          409
        );
      }

      // Hash password securely with PBKDF2 WebCrypto
      const { hash, salt } = await hashPassword(password);
      const userId = 'usr_admin_' + generateRandomString(8);
      const now = Date.now();

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

      // Audit log (best-effort)
      try {
        await db.recordAudit({
          id: 'log_' + generateRandomString(10),
          admin_id: userId,
          action: 'admin_bootstrapped',
          target_type: 'user',
          target_id: userId,
          details: JSON.stringify({ email, name, role: 'admin' }),
          created_at: now,
        });
      } catch {
        // non-blocking
      }

      return jsonResponse(
        {
          success: true,
          message: 'First administrator created successfully. You can now log in.',
          email,
          role: 'admin',
        },
        201
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('no such table')) {
        return jsonResponse(
          {
            error: 'Database schema is not initialized. Please apply database migrations.',
            errorCode: 'DATABASE_SCHEMA_MISSING',
            banglaMessage: 'ক্লাউডফ্লেয়ার D1 ডাটাবেস টেবিলগুলো তৈরি করা হয়নি। দয়া করে মাইগ্রেশন রান করুন।',
          },
          503
        );
      }
      console.error('Bootstrap failure:', err);
      return jsonResponse(
        {
          error: 'Failed to bootstrap administrator due to a database error.',
          errorCode: 'DATABASE_ERROR',
          banglaMessage: 'ডাটাবেস ত্রুটির কারণে এডমিন অ্যাকাউন্ট তৈরি করা সম্ভব হয়নি।',
        },
        500
      );
    }
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
