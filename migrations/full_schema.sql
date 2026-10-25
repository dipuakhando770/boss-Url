-- Boss URL Shortener SaaS - Complete Production D1 Schema & Initial Seed
-- Database: boss-url-db-prod (ID: 6599be47-9a42-47eb-8d4d-ffeff9941b8f)
-- Safe for execution: Uses IF NOT EXISTS and INSERT OR IGNORE

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 3. Subscription Packages Table
CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  link_quota INTEGER NOT NULL,
  price REAL NOT NULL DEFAULT 0.00,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 4. User Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES packages(id),
  links_used INTEGER NOT NULL DEFAULT 0,
  starts_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'expired' | 'suspended'
  created_at INTEGER NOT NULL
);

-- 5. Approved Destination Domains Table
CREATE TABLE IF NOT EXISTS approved_domains (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved', -- 'approved' | 'pending' | 'rejected'
  notes TEXT,
  created_at INTEGER NOT NULL
);

-- 6. Links Table (Two-Stage Shortening Mappings)
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
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed' | 'disabled'
  clicks_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 7. Click Analytics Table
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

-- 8. Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  created_at INTEGER NOT NULL
);

-- 9. Application Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_links_stage1_code ON links(stage1_code);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at);
CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON clicks(created_at);
CREATE INDEX IF NOT EXISTS idx_approved_domains_domain ON approved_domains(domain);

-- 11. Initial Packages Seed
INSERT OR IGNORE INTO packages (id, name, duration_days, link_quota, price, is_active, created_at)
VALUES 
  ('pkg_starter', 'Starter Free', 30, 50, 0.00, 1, 1729860000000),
  ('pkg_pro', 'Boss Pro Monthly', 30, 1000, 15.00, 1, 1729860000000),
  ('pkg_enterprise', 'Boss VIP Annual', 365, 20000, 99.00, 1, 1729860000000);

-- 12. Initial Approved Domains Seed
INSERT OR IGNORE INTO approved_domains (id, domain, status, notes, created_at)
VALUES
  ('dom_1', 'nasirdigitalhub.com', 'approved', 'Primary domain and services', 1729860000000),
  ('dom_2', 'google.com', 'approved', 'Standard search and services', 1729860000000),
  ('dom_3', 'youtube.com', 'approved', 'Video streaming platform', 1729860000000),
  ('dom_4', 'facebook.com', 'approved', 'Social network platform', 1729860000000),
  ('dom_5', 'github.com', 'approved', 'Developer platform', 1729860000000),
  ('dom_6', 'telegram.org', 'approved', 'Messaging platform', 1729860000000),
  ('dom_7', 't.me', 'approved', 'Telegram short link', 1729860000000);

-- 13. Default Settings Seed
INSERT OR IGNORE INTO settings (key, value, updated_at)
VALUES
  ('app_name', 'Boss URL Shortener SaaS', 1729860000000),
  ('default_package_id', 'pkg_starter', 1729860000000),
  ('allow_registration', 'true', 1729860000000),
  ('stage1_domain', 'https://urlshort.nasirdigitalhub.com', 1729860000000),
  ('stage2_api_url', 'http://107.174.37.180/api/links/stage1', 1729860000000);
