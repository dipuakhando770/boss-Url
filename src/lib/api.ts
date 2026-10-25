// Frontend Typed API Client

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  status: number;
  errorCode?: string;
  banglaMessage?: string;

  constructor(message: string, status: number, errorCode?: string, banglaMessage?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.banglaMessage = banglaMessage;
  }
}

export function getToken(): string | null {
  return localStorage.getItem('boss_session_token');
}

export function setToken(token: string): void {
  localStorage.setItem('boss_session_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('boss_session_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr: unknown) {
    throw new ApiError(
      'Unable to connect to the server. Please check your internet connection.',
      0,
      'NETWORK_ERROR',
      'সার্ভারের সাথে সংযোগ স্থাপন করা সম্ভব হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
    );
  }

  let data: any = {};
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    const text = await response.text().catch(() => '');
    if (response.status === 404) {
      data = {
        error: 'API endpoint not found (404). Please verify backend deployment.',
        errorCode: 'ENDPOINT_NOT_FOUND',
        banglaMessage: 'এপিআই এন্ডপয়েন্ট পাওয়া যায়নি (৪০৪)। ব্যাকএন্ড ডেপ্লয়মেন্ট যাচাই করুন।',
      };
    } else if (response.status >= 500) {
      data = {
        error: 'The server encountered an error. Please try again later.',
        errorCode: 'SERVER_ERROR',
        banglaMessage: 'সার্ভারে একটি ত্রুটি ঘটেছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
      };
    } else {
      data = {
        error: text || `Request failed with HTTP status ${response.status}`,
        errorCode: `HTTP_${response.status}`,
        banglaMessage: `অনুরোধটি ব্যর্থ হয়েছে (কোড: ${response.status})।`,
      };
    }
  }

  if (!response.ok) {
    throw new ApiError(
      data.error || `Request failed with status ${response.status}`,
      response.status,
      data.errorCode || `HTTP_${response.status}`,
      data.banglaMessage
    );
  }

  return data as T;
}

export const api = {
  // Auth
  register: (payload: { email: string; password: string; name: string }) =>
    request<{ success: boolean; token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ success: boolean; token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () =>
    request<{ user: any; subscription: any }>('/auth/me'),

  updatePassword: (payload: { current_password: string; new_password: string }) =>
    request<{ success: boolean; message: string }>('/auth/password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  bootstrapAdmin: (payload: { bootstrap_secret: string; email?: string; password?: string; name?: string }) =>
    request<{ success: boolean; message: string }>('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Links
  checkDomain: (url: string) =>
    request<{ isValid: boolean; hostname: string; isApproved: boolean; banglaMessage?: string }>('/links/check-domain', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  shortenLink: (payload: { url: string; custom_code?: string; title?: string }) =>
    request<{ success: boolean; final_url: string; stage1_url: string; stage1_code: string; link: any }>('/links/shorten', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getLinks: (params?: { q?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.q) q.set('q', params.q);
    if (params?.page) q.set('page', params.page.toString());
    if (params?.limit) q.set('limit', params.limit.toString());
    return request<{ links: any[]; total: number; page: number; limit: number }>(`/links?${q.toString()}`);
  },

  getLinkStats: (id: string) =>
    request<{ link: any; analytics: any }>(`/links/${id}/stats`),

  deleteLink: (id: string) =>
    request<{ success: boolean; message: string }>(`/links/${id}`, {
      method: 'DELETE',
    }),

  // Admin
  adminGetStats: () =>
    request<{ stats: any }>('/admin/stats'),

  adminGetUsers: (params?: { q?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.q) q.set('q', params.q);
    if (params?.page) q.set('page', params.page.toString());
    if (params?.limit) q.set('limit', params.limit.toString());
    return request<{ users: any[]; total: number; page: number; limit: number }>(`/admin/users?${q.toString()}`);
  },

  adminUpdateUserStatus: (id: string, status: 'active' | 'suspended') =>
    request<{ success: boolean; message: string }>(`/admin/users/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  adminAssignPackage: (userId: string, packageId: string) =>
    request<{ success: boolean; message: string; subscription: any }>(`/admin/users/${userId}/assign-package`, {
      method: 'POST',
      body: JSON.stringify({ package_id: packageId }),
    }),

  adminGetLinks: (params?: { q?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.q) q.set('q', params.q);
    if (params?.page) q.set('page', params.page.toString());
    if (params?.limit) q.set('limit', params.limit.toString());
    return request<{ links: any[]; total: number; page: number; limit: number }>(`/admin/links?${q.toString()}`);
  },

  adminDeleteLink: (id: string) =>
    request<{ success: boolean; message: string }>(`/admin/links/${id}`, {
      method: 'DELETE',
    }),

  adminGetPackages: () =>
    request<{ packages: any[] }>('/admin/packages'),

  adminCreatePackage: (payload: any) =>
    request<{ success: boolean; package: any }>('/admin/packages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminUpdatePackage: (id: string, payload: any) =>
    request<{ success: boolean; message: string }>(`/admin/packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  adminGetDomains: () =>
    request<{ domains: any[] }>('/admin/domains'),

  adminAddDomain: (payload: { domain: string; notes?: string }) =>
    request<{ success: boolean; domain: string; id: string }>('/admin/domains', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminDeleteDomain: (id: string) =>
    request<{ success: boolean; message: string }>(`/admin/domains/${id}`, {
      method: 'DELETE',
    }),

  adminGetAuditLogs: () =>
    request<{ logs: any[] }>('/admin/audit-logs'),
};
