-- Migration 0002: Seed initial packages, default approved domains, and settings

-- Default Packages
INSERT OR IGNORE INTO packages (id, name, duration_days, link_quota, price, is_active, created_at)
VALUES 
  ('pkg_starter', 'Starter Free', 30, 50, 0.00, 1, 1729860000000),
  ('pkg_pro', 'Boss Pro Monthly', 30, 1000, 15.00, 1, 1729860000000),
  ('pkg_enterprise', 'Boss VIP Annual', 365, 20000, 99.00, 1, 1729860000000);

-- Default Approved Domains (Strict matching on destination domain)
INSERT OR IGNORE INTO approved_domains (id, domain, status, notes, created_at)
VALUES
  ('dom_1', 'nasirdigitalhub.com', 'approved', 'Primary domain and services', 1729860000000),
  ('dom_2', 'google.com', 'approved', 'Standard search and services', 1729860000000),
  ('dom_3', 'youtube.com', 'approved', 'Video streaming platform', 1729860000000),
  ('dom_4', 'facebook.com', 'approved', 'Social network platform', 1729860000000),
  ('dom_5', 'github.com', 'approved', 'Developer platform', 1729860000000),
  ('dom_6', 'telegram.org', 'approved', 'Messaging platform', 1729860000000),
  ('dom_7', 't.me', 'approved', 'Telegram short link', 1729860000000);

-- Default Settings
INSERT OR IGNORE INTO settings (key, value, updated_at)
VALUES
  ('app_name', 'Boss URL Shortener SaaS', 1729860000000),
  ('default_package_id', 'pkg_starter', 1729860000000),
  ('allow_registration', 'true', 1729860000000),
  ('stage1_domain', 'https://urlshort.nasirdigitalhub.com', 1729860000000),
  ('stage2_api_url', 'http://107.174.37.180/api/links/stage1', 1729860000000);
