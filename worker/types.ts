// Worker Environment Bindings and Type Definitions

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  APP_NAME?: string;
  STAGE1_DOMAIN?: string;
  STAGE2_API_URL?: string;
  ADMIN_PATH?: string;
  ENVIRONMENT?: string;
  JWT_SECRET?: string;
  BOOTSTRAP_SECRET?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  name: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  created_at: number;
  updated_at: number;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  token: string;
  expires_at: number;
  created_at: number;
}

export interface PackageRecord {
  id: string;
  name: string;
  duration_days: number;
  link_quota: number;
  price: number;
  is_active: number;
  created_at: number;
}

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  package_id: string;
  links_used: number;
  starts_at: number;
  expires_at: number;
  status: 'active' | 'expired' | 'suspended';
  created_at: number;
  package_name?: string;
  link_quota?: number;
}

export interface ApprovedDomainRecord {
  id: string;
  domain: string;
  status: 'approved' | 'pending' | 'rejected';
  notes: string | null;
  created_at: number;
}

export interface LinkRecord {
  id: string;
  user_id: string;
  original_url: string;
  destination_domain: string;
  stage1_code: string;
  stage1_url: string;
  stage2_code: string | null;
  stage2_id: number | null;
  final_url: string | null;
  title: string | null;
  status: 'pending' | 'completed' | 'failed' | 'disabled';
  clicks_count: number;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  user_email?: string;
}

export interface ClickRecord {
  id: string;
  link_id: string;
  ip_hash: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  created_at: number;
}

export interface AuditLogRecord {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: string | null;
  created_at: number;
  admin_email?: string;
}

export interface SettingRecord {
  key: string;
  value: string;
  updated_at: number;
}

export interface Stage2ApiResponse {
  error: boolean;
  message?: string;
  success?: boolean;
  mode?: string;
  stage1_id?: number;
  stage1_code?: string;
  stage1_url?: string;
  original_url?: string;
}
