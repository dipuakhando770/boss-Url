import { describe, it, expect } from 'vitest';
import { Database } from '../worker/db';
import { MemoryD1Database } from '../worker/db/memory-d1';
import { handleAuthRoutes } from '../worker/routes/auth';

describe('Authentication & Registration System', () => {
  const createMockDb = () => {
    const memD1 = new MemoryD1Database() as unknown as D1Database;
    return new Database(memD1);
  };

  it('successfully registers a user, enforces user role, and auto-activates free starter plan (50 quota, 30 days)', async () => {
    const db = createMockDb();
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nasir Ahmed',
        email: 'nasir@example.com',
        password: 'securePassword123',
      }),
    });

    const res = await handleAuthRoutes(req, new URL(req.url), db, {});
    expect(res.status).toBe(201);

    const body = await res.json<{
      success: boolean;
      token: string;
      user: { id: string; email: string; name: string; role: string; status: string };
      subscription: { package_name: string; link_quota: number; links_used: number; status: string };
    }>();

    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('nasir@example.com');
    expect(body.user.role).toBe('user'); // Never admin
    expect(body.user.status).toBe('active');

    // Requirement 6: Verify subscription record with 50-link quota and active status
    expect(body.subscription).toBeDefined();
    expect(body.subscription.package_name).toBe('Starter Free');
    expect(body.subscription.link_quota).toBe(50);
    expect(body.subscription.links_used).toBe(0);
    expect(body.subscription.status).toBe('active');

    // Verify persisted in DB
    const persistedUser = await db.getUserByEmail('nasir@example.com');
    expect(persistedUser).not.toBeNull();
    expect(persistedUser?.role).toBe('user');

    const persistedSub = await db.getUserActiveSubscription(body.user.id);
    expect(persistedSub).not.toBeNull();
    expect(persistedSub?.link_quota).toBe(50);
  });

  it('rejects duplicate email registration with 409 and exact Bengali message', async () => {
    const db = createMockDb();
    const payload = {
      name: 'First User',
      email: 'duplicate@example.com',
      password: 'password123',
    };

    // First registration
    const req1 = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const res1 = await handleAuthRoutes(req1, new URL(req1.url), db, {});
    expect(res1.status).toBe(201);

    // Second registration with duplicate email
    const req2 = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, name: 'Second User' }),
    });
    const res2 = await handleAuthRoutes(req2, new URL(req2.url), db, {});
    expect(res2.status).toBe(409);

    const body2 = await res2.json<{ error: string; errorCode: string; banglaMessage: string }>();
    expect(body2.errorCode).toBe('EMAIL_ALREADY_EXISTS');
    expect(body2.banglaMessage).toContain('এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি করা হয়েছে');
  });

  it('rejects invalid email formats', async () => {
    const db = createMockDb();
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'invalid-email-without-at',
        password: 'password123',
      }),
    });

    const res = await handleAuthRoutes(req, new URL(req.url), db, {});
    expect(res.status).toBe(400);

    const body = await res.json<{ errorCode: string; banglaMessage: string }>();
    expect(body.errorCode).toBe('INVALID_EMAIL');
    expect(body.banglaMessage).toBeDefined();
  });

  it('rejects passwords shorter than 6 characters', async () => {
    const db = createMockDb();
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'shortpass@example.com',
        password: '123',
      }),
    });

    const res = await handleAuthRoutes(req, new URL(req.url), db, {});
    expect(res.status).toBe(400);

    const body = await res.json<{ errorCode: string; banglaMessage: string }>();
    expect(body.errorCode).toBe('INVALID_PASSWORD');
    expect(body.banglaMessage).toContain('৬ অক্ষর');
  });

  it('rejects registration when name is missing', async () => {
    const db = createMockDb();
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'noname@example.com',
        password: 'password123',
      }),
    });

    const res = await handleAuthRoutes(req, new URL(req.url), db, {});
    expect(res.status).toBe(400);

    const body = await res.json<{ errorCode: string }>();
    expect(body.errorCode).toBe('INVALID_NAME');
  });

  it('handles database write failure safely without crashing or exposing secrets', async () => {
    const faultyDb: any = {
      getUserByEmail: async () => null,
      createUser: async () => {
        throw new Error('D1_INTERNAL_LOCK_ERROR');
      },
    };

    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Error Tester',
        email: 'db_error@example.com',
        password: 'password123',
      }),
    });

    const res = await handleAuthRoutes(req, new URL(req.url), faultyDb, {});
    expect(res.status).toBe(500);

    const body = await res.json<{ error: string; errorCode: string; banglaMessage: string }>();
    expect(body.errorCode).toBe('DATABASE_ERROR');
    expect(body.error).not.toContain('D1_INTERNAL_LOCK_ERROR'); // Sanitized
    expect(body.banglaMessage).toBeDefined();
  });

  describe('First-Time Administrator Setup (Bootstrap)', () => {
    it('rejects bootstrap if BOOTSTRAP_SECRET is unconfigured on server', async () => {
      const db = createMockDb();
      const req = new Request('http://localhost/api/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bootstrap_secret: 'some-secret',
          email: 'admin@nasirdigitalhub.com',
          password: 'BossAdminPassword@2026',
        }),
      });

      const res = await handleAuthRoutes(req, new URL(req.url), db, {}); // No secret provided
      expect(res.status).toBe(500);
      const data = await res.json<{ errorCode: string }>();
      expect(data.errorCode).toBe('BOOTSTRAP_SECRET_NOT_CONFIGURED');
    });

    it('rejects bootstrap if provided secret does not match configured secret', async () => {
      const db = createMockDb();
      const req = new Request('http://localhost/api/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bootstrap_secret: 'wrong-secret',
          email: 'admin@nasirdigitalhub.com',
          password: 'BossAdminPassword@2026',
        }),
      });

      const res = await handleAuthRoutes(req, new URL(req.url), db, { BOOTSTRAP_SECRET: 'real-cf-secret-xyz' });
      expect(res.status).toBe(403);
      const data = await res.json<{ errorCode: string }>();
      expect(data.errorCode).toBe('INVALID_BOOTSTRAP_SECRET');
    });

    it('successfully bootstraps first administrator with valid secret', async () => {
      const db = createMockDb();
      const secret = 'prod-cf-bootstrap-secret-999';
      const req = new Request('http://localhost/api/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bootstrap_secret: secret,
          email: 'superadmin@nasirdigitalhub.com',
          password: 'SuperAdminPassword@2026',
          name: 'Super Admin',
        }),
      });

      const res = await handleAuthRoutes(req, new URL(req.url), db, { BOOTSTRAP_SECRET: secret });
      expect(res.status).toBe(201);
      const data = await res.json<{ success: boolean; email: string; role: string }>();
      expect(data.success).toBe(true);
      expect(data.email).toBe('superadmin@nasirdigitalhub.com');
      expect(data.role).toBe('admin');

      // Verify user in DB has admin role
      const adminUser = await db.getUserByEmail('superadmin@nasirdigitalhub.com');
      expect(adminUser).not.toBeNull();
      expect(adminUser?.role).toBe('admin');
    });

    it('prevents reusing bootstrap once an administrator already exists', async () => {
      const db = createMockDb();
      const secret = 'prod-cf-bootstrap-secret-999';

      // First admin creation
      const req1 = new Request('http://localhost/api/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bootstrap_secret: secret,
          email: 'admin1@nasirdigitalhub.com',
          password: 'AdminPassword1@2026',
        }),
      });
      const res1 = await handleAuthRoutes(req1, new URL(req1.url), db, { BOOTSTRAP_SECRET: secret });
      expect(res1.status).toBe(201);

      // Attempt second admin creation
      const req2 = new Request('http://localhost/api/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bootstrap_secret: secret,
          email: 'admin2@nasirdigitalhub.com',
          password: 'AdminPassword2@2026',
        }),
      });
      const res2 = await handleAuthRoutes(req2, new URL(req2.url), db, { BOOTSTRAP_SECRET: secret });
      expect(res2.status).toBe(403);
      const data2 = await res2.json<{ errorCode: string }>();
      expect(data2.errorCode).toBe('ADMIN_ALREADY_EXISTS');
    });

    it('rejects weak password for administrator bootstrap', async () => {
      const db = createMockDb();
      const secret = 'prod-cf-bootstrap-secret-999';
      const req = new Request('http://localhost/api/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bootstrap_secret: secret,
          email: 'admin@nasirdigitalhub.com',
          password: 'short', // less than 8 chars
        }),
      });

      const res = await handleAuthRoutes(req, new URL(req.url), db, { BOOTSTRAP_SECRET: secret });
      expect(res.status).toBe(400);
      const data = await res.json<{ errorCode: string }>();
      expect(data.errorCode).toBe('WEAK_PASSWORD');
    });
  });
});
