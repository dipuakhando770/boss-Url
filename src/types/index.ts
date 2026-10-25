export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  created_at?: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  package_id: string;
  package_name?: string;
  links_used: number;
  link_quota: number;
  starts_at: number;
  expires_at: number;
  status: 'active' | 'expired' | 'suspended';
}

export interface ShortLink {
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

export interface Package {
  id: string;
  name: string;
  duration_days: number;
  link_quota: number;
  price: number;
  is_active: number;
}

export interface ApprovedDomain {
  id: string;
  domain: string;
  status: 'approved' | 'pending' | 'rejected';
  notes: string | null;
  created_at: number;
}

export interface LinkAnalytics {
  totalClicks: number;
  clicksByDay: { date: string; count: number }[];
  topCountries: { country: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  topDevices: { device_type: string; count: number }[];
}

export interface AdminStats {
  totalUsers: number;
  totalLinks: number;
  totalClicks: number;
  activeSubscriptions: number;
}
