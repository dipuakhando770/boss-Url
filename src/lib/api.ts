// Frontend Typed API Client

const API_BASE = '/api';

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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data.error || 'An unexpected error occurred',
      response.status,
      data.errorCode,
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
