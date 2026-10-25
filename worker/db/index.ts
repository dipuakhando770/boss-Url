import { 
  UserRecord, 
  SessionRecord, 
  PackageRecord, 
  SubscriptionRecord, 
  ApprovedDomainRecord, 
  LinkRecord, 
  ClickRecord, 
  AuditLogRecord, 
  SettingRecord 
} from '../types';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  link_quota INTEGER NOT NULL,
  price REAL NOT NULL DEFAULT 0.00,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES packages(id),
  links_used INTEGER NOT NULL DEFAULT 0,
  starts_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS approved_domains (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  destination_domain TEXT NOT NULL,
  stage1_code TEXT UNIQUE NOT NULL,
  stage1_url TEXT NOT NULL,
  stage2_code TEXT,
  stage2_id INTEGER,
  final_url TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  clicks_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS clicks (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  ip_hash TEXT,
  country TEXT,
  city TEXT,
  referrer TEXT,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_links_stage1_code ON links(stage1_code);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_approved_domains_domain ON approved_domains(domain);

INSERT OR IGNORE INTO packages (id, name, duration_days, link_quota, price, is_active, created_at)
VALUES 
  ('pkg_starter', 'Starter Free', 30, 50, 0.00, 1, 1729860000000),
  ('pkg_pro', 'Boss Pro Monthly', 30, 1000, 15.00, 1, 1729860000000),
  ('pkg_enterprise', 'Boss VIP Annual', 365, 20000, 99.00, 1, 1729860000000);

INSERT OR IGNORE INTO approved_domains (id, domain, status, notes, created_at)
VALUES
  ('dom_1', 'nasirdigitalhub.com', 'approved', 'Primary domain', 1729860000000),
  ('dom_2', 'google.com', 'approved', 'Standard search', 1729860000000),
  ('dom_3', 'youtube.com', 'approved', 'Video streaming', 1729860000000),
  ('dom_4', 'facebook.com', 'approved', 'Social network', 1729860000000),
  ('dom_5', 'github.com', 'approved', 'Developer platform', 1729860000000),
  ('dom_6', 'telegram.org', 'approved', 'Messaging', 1729860000000),
  ('dom_7', 't.me', 'approved', 'Telegram short link', 1729860000000);
`;

export class Database {
  constructor(private db: D1Database) {}

  async ensureSchema(): Promise<void> {
    try {
      if (this.db && typeof this.db.exec === 'function') {
        await this.db.exec(SCHEMA_SQL);
      }
    } catch (e) {
      console.error('Failed to auto-execute schema via db.exec:', e);
    }
  }

  async countAdmins(): Promise<number> {
    try {
      const res = await this.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>();
      return res ? Number(res.count) : 0;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('no such table')) {
        await this.ensureSchema();
        const res = await this.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>();
        return res ? Number(res.count) : 0;
      }
      throw err;
    }
  }

  // ================= Users =================
  async getUserByEmail(email: string): Promise<UserRecord | null> {
    try {
      const res = await this.db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').bind(email.toLowerCase()).first<UserRecord>();
      return res || null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('no such table')) {
        await this.ensureSchema();
        const res = await this.db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').bind(email.toLowerCase()).first<UserRecord>();
        return res || null;
      }
      throw err;
    }
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const res = await this.db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').bind(id).first<UserRecord>();
    return res || null;
  }

  async createUser(user: Omit<UserRecord, 'updated_at'>): Promise<void> {
    const now = Date.now();
    await this.db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, name, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.id,
      user.email.toLowerCase(),
      user.password_hash,
      user.salt,
      user.name,
      user.role,
      user.status,
      user.created_at,
      now
    ).run();
  }

  async updateUserStatus(id: string, status: 'active' | 'suspended'): Promise<void> {
    await this.db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind(status, Date.now(), id).run();
  }

  async updateUserPassword(id: string, password_hash: string, salt: string): Promise<void> {
    await this.db.prepare('UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?').bind(password_hash, salt, Date.now(), id).run();
  }

  async listUsers(search: string = '', limit: number = 50, offset: number = 0): Promise<{ users: UserRecord[]; total: number }> {
    const pattern = `%${search.toLowerCase()}%`;
    const countRes = await this.db.prepare('SELECT COUNT(*) as count FROM users WHERE email LIKE ? OR name LIKE ?').bind(pattern, pattern).first<{ count: number }>();
    const total = countRes ? countRes.count : 0;

    const listRes = await this.db.prepare('SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(pattern, pattern, limit, offset).all<UserRecord>();
    return { users: listRes.results || [], total };
  }

  // ================= Sessions =================
  async createSession(session: SessionRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(session.id, session.user_id, session.token, session.expires_at, session.created_at).run();
  }

  async getSessionWithUser(token: string): Promise<{ session: SessionRecord; user: UserRecord } | null> {
    const now = Date.now();
    const row = await this.db.prepare(`
      SELECT s.id as s_id, s.user_id as s_user_id, s.token as s_token, s.expires_at as s_expires_at, s.created_at as s_created_at,
             u.id as u_id, u.email as u_email, u.password_hash as u_password_hash, u.salt as u_salt,
             u.name as u_name, u.role as u_role, u.status as u_status, u.created_at as u_created_at, u.updated_at as u_updated_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
      LIMIT 1
    `).bind(token, now).first<Record<string, unknown>>();

    if (!row) return null;

    return {
      session: {
        id: row.s_id as string,
        user_id: row.s_user_id as string,
        token: row.s_token as string,
        expires_at: row.s_expires_at as number,
        created_at: row.s_created_at as number,
      },
      user: {
        id: row.u_id as string,
        email: row.u_email as string,
        password_hash: row.u_password_hash as string,
        salt: row.u_salt as string,
        name: row.u_name as string,
        role: row.u_role as 'user' | 'admin',
        status: row.u_status as 'active' | 'suspended',
        created_at: row.u_created_at as number,
        updated_at: row.u_updated_at as number,
      }
    };
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }

  // ================= Packages & Subscriptions =================
  async getPackages(): Promise<PackageRecord[]> {
    const res = await this.db.prepare('SELECT * FROM packages WHERE is_active = 1 ORDER BY price ASC').all<PackageRecord>();
    return res.results || [];
  }

  async getAllPackagesAdmin(): Promise<PackageRecord[]> {
    const res = await this.db.prepare('SELECT * FROM packages ORDER BY created_at DESC').all<PackageRecord>();
    return res.results || [];
  }

  async createPackage(pkg: PackageRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO packages (id, name, duration_days, link_quota, price, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(pkg.id, pkg.name, pkg.duration_days, pkg.link_quota, pkg.price, pkg.is_active, pkg.created_at).run();
  }

  async updatePackage(id: string, name: string, duration_days: number, link_quota: number, price: number, is_active: number): Promise<void> {
    await this.db.prepare(`
      UPDATE packages SET name = ?, duration_days = ?, link_quota = ?, price = ?, is_active = ? WHERE id = ?
    `).bind(name, duration_days, link_quota, price, is_active, id).run();
  }

  async getUserActiveSubscription(userId: string): Promise<SubscriptionRecord | null> {
    const now = Date.now();
    const row = await this.db.prepare(`
      SELECT s.*, p.name as package_name, p.link_quota
      FROM subscriptions s
      JOIN packages p ON s.package_id = p.id
      WHERE s.user_id = ? AND s.status = 'active' AND s.expires_at > ?
      ORDER BY s.created_at DESC
      LIMIT 1
    `).bind(userId, now).first<SubscriptionRecord>();
    return row || null;
  }

  async createSubscription(sub: SubscriptionRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO subscriptions (id, user_id, package_id, links_used, starts_at, expires_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(sub.id, sub.user_id, sub.package_id, sub.links_used, sub.starts_at, sub.expires_at, sub.status, sub.created_at).run();
  }

  async incrementSubscriptionUsage(subscriptionId: string): Promise<void> {
    await this.db.prepare('UPDATE subscriptions SET links_used = links_used + 1 WHERE id = ?').bind(subscriptionId).run();
  }

  // ================= Approved Domains =================
  async getApprovedDomains(): Promise<string[]> {
    const res = await this.db.prepare("SELECT domain FROM approved_domains WHERE status = 'approved'").all<{ domain: string }>();
    return (res.results || []).map(r => r.domain.toLowerCase());
  }

  async listAllApprovedDomains(): Promise<ApprovedDomainRecord[]> {
    const res = await this.db.prepare('SELECT * FROM approved_domains ORDER BY created_at DESC').all<ApprovedDomainRecord>();
    return res.results || [];
  }

  async addApprovedDomain(id: string, domain: string, notes: string = ''): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO approved_domains (id, domain, status, notes, created_at)
      VALUES (?, ?, 'approved', ?, ?)
    `).bind(id, domain.toLowerCase().trim(), notes, Date.now()).run();
  }

  async deleteApprovedDomain(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM approved_domains WHERE id = ?').bind(id).run();
  }

  // ================= Links (Two-Stage Pipeline) =================
  async createStage1Link(link: Omit<LinkRecord, 'updated_at' | 'clicks_count'>): Promise<void> {
    const now = Date.now();
    await this.db.prepare(`
      INSERT INTO links (
        id, user_id, original_url, destination_domain, stage1_code, stage1_url,
        stage2_code, stage2_id, final_url, title, status, clicks_count, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).bind(
      link.id,
      link.user_id,
      link.original_url,
      link.destination_domain,
      link.stage1_code,
      link.stage1_url,
      link.stage2_code || null,
      link.stage2_id || null,
      link.final_url || null,
      link.title || null,
      link.status,
      link.error_message || null,
      link.created_at,
      now
    ).run();
  }

  async updateStage2Completed(linkId: string, stage2Code: string, stage2Id: number, finalUrl: string): Promise<void> {
    await this.db.prepare(`
      UPDATE links 
      SET stage2_code = ?, stage2_id = ?, final_url = ?, status = 'completed', error_message = NULL, updated_at = ?
      WHERE id = ?
    `).bind(stage2Code, stage2Id, finalUrl, Date.now(), linkId).run();
  }

  async updateStage2Failed(linkId: string, errorMessage: string): Promise<void> {
    await this.db.prepare(`
      UPDATE links 
      SET status = 'failed', error_message = ?, updated_at = ?
      WHERE id = ?
    `).bind(errorMessage, Date.now(), linkId).run();
  }

  async getLinkByStage1Code(code: string): Promise<LinkRecord | null> {
    const res = await this.db.prepare('SELECT * FROM links WHERE stage1_code = ? LIMIT 1').bind(code).first<LinkRecord>();
    return res || null;
  }

  async getLinkById(id: string): Promise<LinkRecord | null> {
    const res = await this.db.prepare('SELECT * FROM links WHERE id = ? LIMIT 1').bind(id).first<LinkRecord>();
    return res || null;
  }

  async listUserLinks(userId: string, search: string = '', limit: number = 20, offset: number = 0): Promise<{ links: LinkRecord[]; total: number }> {
    const pattern = `%${search.toLowerCase()}%`;
    const countRes = await this.db.prepare(`
      SELECT COUNT(*) as count FROM links 
      WHERE user_id = ? AND (original_url LIKE ? OR stage1_code LIKE ? OR title LIKE ?)
    `).bind(userId, pattern, pattern, pattern).first<{ count: number }>();
    const total = countRes ? countRes.count : 0;

    const listRes = await this.db.prepare(`
      SELECT * FROM links 
      WHERE user_id = ? AND (original_url LIKE ? OR stage1_code LIKE ? OR title LIKE ?)
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).bind(userId, pattern, pattern, pattern, limit, offset).all<LinkRecord>();

    return { links: listRes.results || [], total };
  }

  async listAllLinksAdmin(search: string = '', limit: number = 50, offset: number = 0): Promise<{ links: LinkRecord[]; total: number }> {
    const pattern = `%${search.toLowerCase()}%`;
    const countRes = await this.db.prepare(`
      SELECT COUNT(*) as count FROM links 
      WHERE original_url LIKE ? OR stage1_code LIKE ? OR title LIKE ?
    `).bind(pattern, pattern, pattern).first<{ count: number }>();
    const total = countRes ? countRes.count : 0;

    const listRes = await this.db.prepare(`
      SELECT l.*, u.email as user_email 
      FROM links l
      JOIN users u ON l.user_id = u.id
      WHERE l.original_url LIKE ? OR l.stage1_code LIKE ? OR l.title LIKE ?
      ORDER BY l.created_at DESC 
      LIMIT ? OFFSET ?
    `).bind(pattern, pattern, pattern, limit, offset).all<LinkRecord>();

    return { links: listRes.results || [], total };
  }

  async incrementLinkClicks(linkId: string): Promise<void> {
    await this.db.prepare('UPDATE links SET clicks_count = clicks_count + 1 WHERE id = ?').bind(linkId).run();
  }

  async deleteLink(id: string, userId?: string): Promise<void> {
    if (userId) {
      await this.db.prepare('DELETE FROM links WHERE id = ? AND user_id = ?').bind(id, userId).run();
    } else {
      await this.db.prepare('DELETE FROM links WHERE id = ?').bind(id).run();
    }
  }

  // ================= Clicks & Analytics =================
  async recordClick(click: ClickRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO clicks (id, link_id, ip_hash, country, city, referrer, user_agent, device_type, browser, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      click.id,
      click.link_id,
      click.ip_hash,
      click.country,
      click.city,
      click.referrer,
      click.user_agent,
      click.device_type,
      click.browser,
      click.created_at
    ).run();
  }

  async getLinkAnalytics(linkId: string): Promise<{
    totalClicks: number;
    clicksByDay: { date: string; count: number }[];
    topCountries: { country: string; count: number }[];
    topReferrers: { referrer: string; count: number }[];
    topDevices: { device_type: string; count: number }[];
  }> {
    const countRes = await this.db.prepare('SELECT COUNT(*) as count FROM clicks WHERE link_id = ?').bind(linkId).first<{ count: number }>();
    const totalClicks = countRes ? countRes.count : 0;

    const countriesRes = await this.db.prepare(`
      SELECT country, COUNT(*) as count FROM clicks WHERE link_id = ? AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 5
    `).bind(linkId).all<{ country: string; count: number }>();

    const referrersRes = await this.db.prepare(`
      SELECT referrer, COUNT(*) as count FROM clicks WHERE link_id = ? AND referrer IS NOT NULL GROUP BY referrer ORDER BY count DESC LIMIT 5
    `).bind(linkId).all<{ referrer: string; count: number }>();

    const devicesRes = await this.db.prepare(`
      SELECT device_type, COUNT(*) as count FROM clicks WHERE link_id = ? AND device_type IS NOT NULL GROUP BY device_type ORDER BY count DESC LIMIT 5
    `).bind(linkId).all<{ device_type: string; count: number }>();

    return {
      totalClicks,
      clicksByDay: [],
      topCountries: countriesRes.results || [],
      topReferrers: referrersRes.results || [],
      topDevices: devicesRes.results || [],
    };
  }

  // ================= Audit Logs =================
  async recordAudit(log: AuditLogRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(log.id, log.admin_id, log.action, log.target_type, log.target_id, log.details, log.created_at).run();
  }

  async listAuditLogs(limit: number = 50): Promise<AuditLogRecord[]> {
    const res = await this.db.prepare(`
      SELECT a.*, u.email as admin_email
      FROM audit_logs a
      LEFT JOIN users u ON a.admin_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).bind(limit).all<AuditLogRecord>();
    return res.results || [];
  }

  // ================= Dashboard Stats =================
  async getAdminStats(): Promise<{
    totalUsers: number;
    totalLinks: number;
    totalClicks: number;
    activeSubscriptions: number;
  }> {
    const usersCount = (await this.db.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>())?.c || 0;
    const linksCount = (await this.db.prepare('SELECT COUNT(*) as c FROM links').first<{ c: number }>())?.c || 0;
    const clicksCount = (await this.db.prepare('SELECT COUNT(*) as c FROM clicks').first<{ c: number }>())?.c || 0;
    const subsCount = (await this.db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'active'").first<{ c: number }>())?.c || 0;

    return {
      totalUsers: usersCount,
      totalLinks: linksCount,
      totalClicks: clicksCount,
      activeSubscriptions: subsCount,
    };
  }
}
