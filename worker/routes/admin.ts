import { Database } from '../db';
import { authenticateUser, jsonResponse } from './auth';
import { generateRandomString } from '../services/crypto';
import { AuditLogRecord, PackageRecord, SubscriptionRecord } from '../types';

export async function handleAdminRoutes(request: Request, url: URL, db: Database): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  // Enforce Admin Authentication on all admin routes
  const auth = await authenticateUser(request, db);
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized: Authentication required' }, 401);
  }
  if (auth.user.role !== 'admin') {
    return jsonResponse({ error: 'Forbidden: Administrator privileges required' }, 403);
  }

  const logAdminAction = async (action: string, targetType: string, targetId: string | null, details: string) => {
    const log: AuditLogRecord = {
      id: 'aud_' + generateRandomString(12),
      admin_id: auth.user.id,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      created_at: Date.now(),
    };
    await db.recordAudit(log);
  };

  // 1. GET /api/admin/stats
  if (path === '/api/admin/stats' && method === 'GET') {
    const stats = await db.getAdminStats();
    return jsonResponse({ stats });
  }

  // 2. GET /api/admin/users
  if (path === '/api/admin/users' && method === 'GET') {
    const search = url.searchParams.get('q') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const offset = (page - 1) * limit;

    const data = await db.listUsers(search, limit, offset);
    return jsonResponse({
      users: data.users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        created_at: u.created_at,
      })),
      total: data.total,
      page,
      limit,
    });
  }

  // 3. POST /api/admin/users/:id/status (Suspend / Reactivate)
  const userStatusMatch = path.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)\/status$/);
  if (userStatusMatch && method === 'POST') {
    const targetUserId = userStatusMatch[1];
    const body = await request.json<{ status: 'active' | 'suspended' }>();
    if (body.status !== 'active' && body.status !== 'suspended') {
      return jsonResponse({ error: 'Invalid status' }, 400);
    }

    await db.updateUserStatus(targetUserId, body.status);
    await logAdminAction('UPDATE_USER_STATUS', 'user', targetUserId, `Changed status to ${body.status}`);
    return jsonResponse({ success: true, message: `User status updated to ${body.status}` });
  }

  // 4. POST /api/admin/users/:id/assign-package
  const assignPkgMatch = path.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)\/assign-package$/);
  if (assignPkgMatch && method === 'POST') {
    const targetUserId = assignPkgMatch[1];
    const body = await request.json<{ package_id: string }>();
    const packages = await db.getAllPackagesAdmin();
    const pkg = packages.find(p => p.id === body.package_id);
    if (!pkg) {
      return jsonResponse({ error: 'Package not found' }, 404);
    }

    const now = Date.now();
    const subRecord: SubscriptionRecord = {
      id: 'sub_' + generateRandomString(10),
      user_id: targetUserId,
      package_id: pkg.id,
      links_used: 0,
      starts_at: now,
      expires_at: now + pkg.duration_days * 86400000,
      status: 'active',
      created_at: now,
    };

    await db.createSubscription(subRecord);
    await logAdminAction('ASSIGN_PACKAGE', 'subscription', targetUserId, `Assigned package ${pkg.name} (${pkg.duration_days} days)`);
    return jsonResponse({ success: true, message: 'Package assigned successfully', subscription: subRecord });
  }

  // 5. GET /api/admin/links
  if (path === '/api/admin/links' && method === 'GET') {
    const search = url.searchParams.get('q') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const offset = (page - 1) * limit;

    const data = await db.listAllLinksAdmin(search, limit, offset);
    return jsonResponse({
      links: data.links,
      total: data.total,
      page,
      limit,
    });
  }

  // 6. DELETE /api/admin/links/:id
  const deleteLinkMatch = path.match(/^\/api\/admin\/links\/([a-zA-Z0-9_-]+)$/);
  if (deleteLinkMatch && method === 'DELETE') {
    const linkId = deleteLinkMatch[1];
    await db.deleteLink(linkId);
    await logAdminAction('DELETE_LINK', 'link', linkId, 'Admin deleted link');
    return jsonResponse({ success: true, message: 'Link deleted successfully' });
  }

  // 7. GET /api/admin/packages
  if (path === '/api/admin/packages' && method === 'GET') {
    const packages = await db.getAllPackagesAdmin();
    return jsonResponse({ packages });
  }

  // 8. POST /api/admin/packages
  if (path === '/api/admin/packages' && method === 'POST') {
    const body = await request.json<{
      name: string;
      duration_days: number;
      link_quota: number;
      price: number;
      is_active?: number;
    }>();

    if (!body.name || !body.duration_days || !body.link_quota) {
      return jsonResponse({ error: 'Name, duration, and quota are required' }, 400);
    }

    const pkg: PackageRecord = {
      id: 'pkg_' + generateRandomString(8),
      name: body.name.trim(),
      duration_days: Number(body.duration_days),
      link_quota: Number(body.link_quota),
      price: Number(body.price || 0),
      is_active: body.is_active !== undefined ? body.is_active : 1,
      created_at: Date.now(),
    };

    await db.createPackage(pkg);
    await logAdminAction('CREATE_PACKAGE', 'package', pkg.id, `Created package ${pkg.name}`);
    return jsonResponse({ success: true, package: pkg }, 201);
  }

  // 9. PUT /api/admin/packages/:id
  const updatePkgMatch = path.match(/^\/api\/admin\/packages\/([a-zA-Z0-9_-]+)$/);
  if (updatePkgMatch && method === 'PUT') {
    const pkgId = updatePkgMatch[1];
    const body = await request.json<{
      name: string;
      duration_days: number;
      link_quota: number;
      price: number;
      is_active: number;
    }>();

    await db.updatePackage(pkgId, body.name, body.duration_days, body.link_quota, body.price, body.is_active);
    await logAdminAction('UPDATE_PACKAGE', 'package', pkgId, `Updated package ${body.name}`);
    return jsonResponse({ success: true, message: 'Package updated successfully' });
  }

  // 10. GET /api/admin/domains
  if (path === '/api/admin/domains' && method === 'GET') {
    const domains = await db.listAllApprovedDomains();
    return jsonResponse({ domains });
  }

  // 11. POST /api/admin/domains
  if (path === '/api/admin/domains' && method === 'POST') {
    const body = await request.json<{ domain: string; notes?: string }>();
    const cleanDomain = (body.domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleanDomain || cleanDomain.length < 3) {
      return jsonResponse({ error: 'Valid domain is required' }, 400);
    }

    const domainId = 'dom_' + generateRandomString(8);
    await db.addApprovedDomain(domainId, cleanDomain, body.notes || '');
    await logAdminAction('ADD_DOMAIN', 'domain', domainId, `Approved domain ${cleanDomain}`);
    return jsonResponse({ success: true, domain: cleanDomain, id: domainId }, 201);
  }

  // 12. DELETE /api/admin/domains/:id
  const deleteDomainMatch = path.match(/^\/api\/admin\/domains\/([a-zA-Z0-9_-]+)$/);
  if (deleteDomainMatch && method === 'DELETE') {
    const domId = deleteDomainMatch[1];
    await db.deleteApprovedDomain(domId);
    await logAdminAction('DELETE_DOMAIN', 'domain', domId, 'Removed approved domain');
    return jsonResponse({ success: true, message: 'Domain removed from approved list' });
  }

  // 13. GET /api/admin/audit-logs
  if (path === '/api/admin/audit-logs' && method === 'GET') {
    const logs = await db.listAuditLogs(100);
    return jsonResponse({ logs });
  }

  return jsonResponse({ error: 'Admin API endpoint not found' }, 404);
}
