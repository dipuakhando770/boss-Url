// In-Memory & File Fallback D1 Database for Vercel Serverless / Node Environments
// Automatically seeds packages and approved domains if no native Cloudflare D1 binding is found.

import { 
  UserRecord, 
  SessionRecord, 
  PackageRecord, 
  SubscriptionRecord, 
  ApprovedDomainRecord, 
  LinkRecord, 
  ClickRecord, 
  AuditLogRecord 
} from '../types';

export class MemoryD1Database implements D1Database {
  users: Map<string, UserRecord> = new Map();
  sessions: Map<string, SessionRecord> = new Map();
  packages: Map<string, PackageRecord> = new Map();
  subscriptions: Map<string, SubscriptionRecord> = new Map();
  approvedDomains: Map<string, ApprovedDomainRecord> = new Map();
  links: Map<string, LinkRecord> = new Map();
  clicks: ClickRecord[] = [];
  auditLogs: AuditLogRecord[] = [];

  constructor() {
    this.seedDefaults();
  }

  seedDefaults() {
    const now = Date.now();
    // Default packages
    this.packages.set('pkg_starter', {
      id: 'pkg_starter',
      name: 'Starter Free',
      duration_days: 30,
      link_quota: 50,
      price: 0.00,
      is_active: 1,
      created_at: now,
    });
    this.packages.set('pkg_pro', {
      id: 'pkg_pro',
      name: 'Boss Pro Monthly',
      duration_days: 30,
      link_quota: 1000,
      price: 15.00,
      is_active: 1,
      created_at: now,
    });
    this.packages.set('pkg_enterprise', {
      id: 'pkg_enterprise',
      name: 'Boss VIP Annual',
      duration_days: 365,
      link_quota: 20000,
      price: 99.00,
      is_active: 1,
      created_at: now,
    });

    // Default approved domains
    const defaultDoms = [
      'nasirdigitalhub.com',
      'google.com',
      'youtube.com',
      'facebook.com',
      'github.com',
      'telegram.org',
      't.me'
    ];
    defaultDoms.forEach((d, i) => {
      this.approvedDomains.set(`dom_${i + 1}`, {
        id: `dom_${i + 1}`,
        domain: d,
        status: 'approved',
        notes: 'Pre-approved domain',
        created_at: now,
      });
    });
  }

  prepare(query: string): D1PreparedStatement {
    return new MemoryPreparedStatement(this, query);
  }

  async batch<T = unknown>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return [];
  }

  async exec(_query: string): Promise<D1ExecResult> {
    return { count: 0, duration: 0 };
  }

  withSession(_constraintOrBookmark?: string): D1DatabaseSession {
    return {
      prepare: (query: string) => this.prepare(query),
      batch: <T = unknown>(statements: D1PreparedStatement[]) => this.batch<T>(statements),
      exec: (query: string) => this.exec(query),
      dump: () => this.dump(),
      getBookmark: () => null,
    } as unknown as D1DatabaseSession;
  }

  dump(): Promise<ArrayBuffer> {
    throw new Error('Method not implemented.');
  }
}

class MemoryPreparedStatement implements D1PreparedStatement {
  private boundParams: any[] = [];

  constructor(private memDb: MemoryD1Database, private query: string) {}

  bind(...params: any[]): D1PreparedStatement {
    this.boundParams = params;
    return this as any;
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const q = this.query.trim();

    // 1. SELECT * FROM users WHERE email = ? LIMIT 1
    if (q.includes('FROM users WHERE email = ?')) {
      const email = String(this.boundParams[0]).toLowerCase();
      for (const u of this.memDb.users.values()) {
        if (u.email === email) return u as unknown as T;
      }
      return null;
    }

    // 2. SELECT * FROM users WHERE id = ? LIMIT 1
    if (q.includes('FROM users WHERE id = ?')) {
      const id = String(this.boundParams[0]);
      const u = this.memDb.users.get(id);
      return (u || null) as unknown as T;
    }

    // 3. SELECT s.*, u.* FROM sessions s JOIN users u ... WHERE s.token = ? AND s.expires_at > ?
    if (q.includes('FROM sessions s') && q.includes('JOIN users u')) {
      const token = String(this.boundParams[0]);
      const now = Number(this.boundParams[1]);
      for (const s of this.memDb.sessions.values()) {
        if (s.token === token && s.expires_at > now) {
          const u = this.memDb.users.get(s.user_id);
          if (u) {
            return {
              s_id: s.id,
              s_user_id: s.user_id,
              s_token: s.token,
              s_expires_at: s.expires_at,
              s_created_at: s.created_at,
              u_id: u.id,
              u_email: u.email,
              u_password_hash: u.password_hash,
              u_salt: u.salt,
              u_name: u.name,
              u_role: u.role,
              u_status: u.status,
              u_created_at: u.created_at,
              u_updated_at: u.updated_at,
            } as unknown as T;
          }
        }
      }
      return null;
    }

    // 4. SELECT s.*, p.name as package_name, p.link_quota FROM subscriptions s JOIN packages p
    if (q.includes('FROM subscriptions s') && q.includes('JOIN packages p')) {
      const userId = String(this.boundParams[0]);
      const now = Number(this.boundParams[1]);
      for (const s of this.memDb.subscriptions.values()) {
        if (s.user_id === userId && s.status === 'active' && s.expires_at > now) {
          const p = this.memDb.packages.get(s.package_id);
          return {
            ...s,
            package_name: p?.name || 'Starter Plan',
            link_quota: p?.link_quota || 50,
          } as unknown as T;
        }
      }
      return null;
    }

    // 5. SELECT * FROM links WHERE stage1_code = ? LIMIT 1
    if (q.includes('FROM links WHERE stage1_code = ?')) {
      const code = String(this.boundParams[0]);
      for (const l of this.memDb.links.values()) {
        if (l.stage1_code === code) return l as unknown as T;
      }
      return null;
    }

    // 6. SELECT * FROM links WHERE id = ? LIMIT 1
    if (q.includes('FROM links WHERE id = ?')) {
      const id = String(this.boundParams[0]);
      const l = this.memDb.links.get(id);
      return (l || null) as unknown as T;
    }

    // Counts
    if (q.includes('SELECT COUNT(*) as count') || q.includes('SELECT COUNT(*) as c')) {
      if (q.includes('FROM users')) return { count: this.memDb.users.size, c: this.memDb.users.size } as unknown as T;
      if (q.includes('FROM links')) return { count: this.memDb.links.size, c: this.memDb.links.size } as unknown as T;
      if (q.includes('FROM clicks')) return { count: this.memDb.clicks.length, c: this.memDb.clicks.length } as unknown as T;
      if (q.includes('FROM subscriptions')) return { count: this.memDb.subscriptions.size, c: this.memDb.subscriptions.size } as unknown as T;
    }

    return null;
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const q = this.query.trim();

    // Packages
    if (q.includes('FROM packages')) {
      const pkgs = Array.from(this.memDb.packages.values());
      return { results: pkgs as unknown as T[], success: true, meta: {} as any };
    }

    // Approved Domains
    if (q.includes('FROM approved_domains')) {
      const doms = Array.from(this.memDb.approvedDomains.values());
      return { results: doms as unknown as T[], success: true, meta: {} as any };
    }

    // Links for user
    if (q.includes('FROM links WHERE user_id = ?')) {
      const userId = String(this.boundParams[0]);
      const userLinks = Array.from(this.memDb.links.values())
        .filter(l => l.user_id === userId)
        .sort((a, b) => b.created_at - a.created_at);
      return { results: userLinks as unknown as T[], success: true, meta: {} as any };
    }

    // All links (admin)
    if (q.includes('FROM links l') && q.includes('JOIN users u')) {
      const list = Array.from(this.memDb.links.values()).map(l => ({
        ...l,
        user_email: this.memDb.users.get(l.user_id)?.email || 'unknown',
      })).sort((a, b) => b.created_at - a.created_at);
      return { results: list as unknown as T[], success: true, meta: {} as any };
    }

    // Users list
    if (q.includes('FROM users WHERE email LIKE')) {
      const users = Array.from(this.memDb.users.values()).sort((a, b) => b.created_at - a.created_at);
      return { results: users as unknown as T[], success: true, meta: {} as any };
    }

    // Audit logs
    if (q.includes('FROM audit_logs')) {
      return { results: this.memDb.auditLogs.slice(-100).reverse() as unknown as T[], success: true, meta: {} as any };
    }

    return { results: [], success: true, meta: {} as any };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const q = this.query.trim();
    const okResult: D1Result<T> = { results: [] as T[], success: true, meta: {} as any };

    // 1. INSERT INTO users
    if (q.includes('INSERT INTO users')) {
      const [id, email, password_hash, salt, name, role, status, created_at, updated_at] = this.boundParams;
      this.memDb.users.set(id, {
        id,
        email: String(email).toLowerCase(),
        password_hash,
        salt,
        name,
        role,
        status,
        created_at,
        updated_at,
      });
      return okResult;
    }

    // 2. INSERT INTO sessions
    if (q.includes('INSERT INTO sessions')) {
      const [id, user_id, token, expires_at, created_at] = this.boundParams;
      this.memDb.sessions.set(token, { id, user_id, token, expires_at, created_at });
      return okResult;
    }

    // 3. DELETE FROM sessions
    if (q.includes('DELETE FROM sessions WHERE token = ?')) {
      const token = String(this.boundParams[0]);
      this.memDb.sessions.delete(token);
      return okResult;
    }

    // 4. INSERT INTO packages
    if (q.includes('INSERT INTO packages')) {
      const [id, name, duration_days, link_quota, price, is_active, created_at] = this.boundParams;
      this.memDb.packages.set(id, { id, name, duration_days, link_quota, price, is_active, created_at });
      return okResult;
    }

    // 5. INSERT INTO subscriptions
    if (q.includes('INSERT INTO subscriptions')) {
      const [id, user_id, package_id, links_used, starts_at, expires_at, status, created_at] = this.boundParams;
      this.memDb.subscriptions.set(id, { id, user_id, package_id, links_used, starts_at, expires_at, status, created_at });
      return okResult;
    }

    // 6. UPDATE subscriptions SET links_used = links_used + 1
    if (q.includes('UPDATE subscriptions SET links_used = links_used + 1')) {
      const id = String(this.boundParams[0]);
      const sub = this.memDb.subscriptions.get(id);
      if (sub) {
        sub.links_used++;
      }
      return okResult;
    }

    // 7. INSERT INTO approved_domains
    if (q.includes('approved_domains')) {
      if (q.includes('INSERT')) {
        const [id, domain, notes, created_at] = this.boundParams;
        this.memDb.approvedDomains.set(id, { id, domain: String(domain).toLowerCase(), status: 'approved', notes, created_at });
      } else if (q.includes('DELETE')) {
        const id = String(this.boundParams[0]);
        this.memDb.approvedDomains.delete(id);
      }
      return okResult;
    }

    // 8. INSERT INTO links
    if (q.includes('INSERT INTO links')) {
      const [id, user_id, original_url, destination_domain, stage1_code, stage1_url, stage2_code, stage2_id, final_url, title, status, error_message, created_at, updated_at] = this.boundParams;
      this.memDb.links.set(id, {
        id,
        user_id,
        original_url,
        destination_domain,
        stage1_code,
        stage1_url,
        stage2_code,
        stage2_id,
        final_url,
        title,
        status,
        clicks_count: 0,
        error_message,
        created_at,
        updated_at,
      });
      return okResult;
    }

    // 9. UPDATE links (completed / failed)
    if (q.includes('UPDATE links')) {
      if (q.includes('status = \'completed\'')) {
        const [stage2Code, stage2Id, finalUrl, updated_at, linkId] = this.boundParams;
        const link = this.memDb.links.get(linkId);
        if (link) {
          link.stage2_code = stage2Code;
          link.stage2_id = stage2Id;
          link.final_url = finalUrl;
          link.status = 'completed';
          link.updated_at = updated_at;
        }
      } else if (q.includes('status = \'failed\'')) {
        const [error_message, updated_at, linkId] = this.boundParams;
        const link = this.memDb.links.get(linkId);
        if (link) {
          link.status = 'failed';
          link.error_message = error_message;
          link.updated_at = updated_at;
        }
      } else if (q.includes('clicks_count = clicks_count + 1')) {
        const linkId = String(this.boundParams[0]);
        const link = this.memDb.links.get(linkId);
        if (link) {
          link.clicks_count++;
        }
      }
      return okResult;
    }

    // 10. DELETE FROM links
    if (q.includes('DELETE FROM links')) {
      const id = String(this.boundParams[0]);
      this.memDb.links.delete(id);
      return okResult;
    }

    // 11. INSERT INTO clicks
    if (q.includes('INSERT INTO clicks')) {
      const [id, link_id, ip_hash, country, city, referrer, user_agent, device_type, browser, created_at] = this.boundParams;
      this.memDb.clicks.push({ id, link_id, ip_hash, country, city, referrer, user_agent, device_type, browser, created_at });
      return okResult;
    }

    // 12. INSERT INTO audit_logs
    if (q.includes('INSERT INTO audit_logs')) {
      const [id, admin_id, action, target_type, target_id, details, created_at] = this.boundParams;
      this.memDb.auditLogs.push({ id, admin_id, action, target_type, target_id, details, created_at });
      return okResult;
    }

    // 13. UPDATE users SET status = ?
    if (q.includes('UPDATE users SET status = ?')) {
      const [status, updated_at, id] = this.boundParams;
      const u = this.memDb.users.get(id);
      if (u) {
        u.status = status;
        u.updated_at = updated_at;
      }
      return okResult;
    }

    // 14. UPDATE users SET password_hash = ?
    if (q.includes('UPDATE users SET password_hash = ?')) {
      const [hash, salt, updated_at, id] = this.boundParams;
      const u = this.memDb.users.get(id);
      if (u) {
        u.password_hash = hash;
        u.salt = salt;
        u.updated_at = updated_at;
      }
      return okResult;
    }

    return okResult;
  }

  async raw<T = unknown[]>(_options?: any): Promise<any> {
    return [];
  }
}

// Global instance for persistent state across hot invocations in memory
export const globalMemoryDb = new MemoryD1Database();
