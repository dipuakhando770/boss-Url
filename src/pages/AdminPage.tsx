import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { 
  Users, 
  Link2, 
  Package, 
  ShieldCheck, 
  History, 
  BarChart3, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Loader2, 
  KeyRound, 
  RefreshCw 
} from 'lucide-react';

interface AdminPageProps {
  navigate: (path: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ navigate }) => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'links' | 'packages' | 'domains' | 'audit'>('overview');
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState<{ totalUsers: number; totalLinks: number; totalClicks: number; activeSubscriptions: number }>({
    totalUsers: 0,
    totalLinks: 0,
    totalClicks: 0,
    activeSubscriptions: 0,
  });

  // Users tab
  const [userList, setUserList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Links tab
  const [linkList, setLinkList] = useState<any[]>([]);
  const [linkSearch, setLinkSearch] = useState('');

  // Packages tab
  const [packageList, setPackageList] = useState<any[]>([]);
  const [showNewPkgModal, setShowNewPkgModal] = useState(false);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgDays, setNewPkgDays] = useState('30');
  const [newPkgQuota, setNewPkgQuota] = useState('100');
  const [newPkgPrice, setNewPkgPrice] = useState('0');

  // Domains tab
  const [domainList, setDomainList] = useState<any[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newDomainNotes, setNewDomainNotes] = useState('');

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Bootstrap Helper state (for non-admin visitors)
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [bootstrapEmail, setBootstrapEmail] = useState('admin@nasirdigitalhub.com');
  const [bootstrapPassword, setBootstrapPassword] = useState('BossAdmin@2026');
  const [bootstrapStatus, setBootstrapStatus] = useState<string | null>(null);

  const loadData = async () => {
    if (!user || user.role !== 'admin') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [sRes, uRes, lRes, pRes, dRes, aRes] = await Promise.all([
        api.adminGetStats().catch(() => ({ stats: { totalUsers: 0, totalLinks: 0, totalClicks: 0, activeSubscriptions: 0 } })),
        api.adminGetUsers({ q: userSearch }).catch(() => ({ users: [] })),
        api.adminGetLinks({ q: linkSearch }).catch(() => ({ links: [] })),
        api.adminGetPackages().catch(() => ({ packages: [] })),
        api.adminGetDomains().catch(() => ({ domains: [] })),
        api.adminGetAuditLogs().catch(() => ({ logs: [] })),
      ]);

      setStats(sRes.stats);
      setUserList(uRes.users);
      setLinkList(lRes.links);
      setPackageList(pRes.packages);
      setDomainList(dRes.domains);
      setAuditLogs(aRes.logs);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, userSearch, linkSearch]);

  // If user is not admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full glass rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center shadow-2xl">
          <KeyRound className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Restricted Admin Area
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
            Administrator credentials are required to access <code className="font-mono text-xs">/nachid/admin</code>.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 px-4 rounded-xl bg-boss-600 text-white font-semibold text-sm hover:bg-boss-700 transition-colors"
            >
              Log in with Admin Account
            </button>
            <button
              onClick={() => setShowBootstrapModal(true)}
              className="w-full py-2 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              First-Time Administrator Setup (Bootstrap)
            </button>
          </div>

          {/* Bootstrap Modal */}
          {showBootstrapModal && (
            <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-left border border-slate-200 dark:border-slate-700 animate-in fade-in">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                Bootstrap First Admin
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">Bootstrap Secret</label>
                  <input
                    type="password"
                    value={bootstrapSecret}
                    onChange={e => setBootstrapSecret(e.target.value)}
                    placeholder="Enter BOOTSTRAP_SECRET"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Admin Email</label>
                  <input
                    type="email"
                    value={bootstrapEmail}
                    onChange={e => setBootstrapEmail(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">New Password</label>
                  <input
                    type="password"
                    value={bootstrapPassword}
                    onChange={e => setBootstrapPassword(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                {bootstrapStatus && (
                  <p className="text-xs font-semibold text-boss-600 dark:text-boss-400">{bootstrapStatus}</p>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setBootstrapStatus('Bootstrapping admin account...');
                      await api.bootstrapAdmin({
                        bootstrap_secret: bootstrapSecret,
                        email: bootstrapEmail,
                        password: bootstrapPassword,
                        name: 'Boss Super Admin',
                      });
                      setBootstrapStatus('Admin created! Now log in with these credentials.');
                    } catch (err: unknown) {
                      setBootstrapStatus(err instanceof Error ? err.message : 'Bootstrap failed');
                    }
                  }}
                  className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                >
                  Create Admin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Admin Actions
  const toggleUserStatus = async (id: string, current: string) => {
    const nextStatus = current === 'active' ? 'suspended' : 'active';
    await api.adminUpdateUserStatus(id, nextStatus);
    loadData();
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPkgName.trim()) return;
    await api.adminCreatePackage({
      name: newPkgName.trim(),
      duration_days: parseInt(newPkgDays, 10),
      link_quota: parseInt(newPkgQuota, 10),
      price: parseFloat(newPkgPrice) || 0,
    });
    setShowNewPkgModal(false);
    setNewPkgName('');
    loadData();
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    await api.adminAddDomain({ domain: newDomain.trim(), notes: newDomainNotes.trim() });
    setNewDomain('');
    setNewDomainNotes('');
    loadData();
  };

  const handleDeleteDomain = async (id: string) => {
    if (!window.confirm('Remove domain from approved allowlist?')) return;
    await api.adminDeleteDomain(id);
    loadData();
  };

  const handleDeleteLink = async (id: string) => {
    if (!window.confirm('Delete this link permanently?')) return;
    await api.adminDeleteLink(id);
    loadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Executive Administration Panel
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold">
              ROOT /nachid/admin
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            System health, user accounts, link routing, approved domains allowlist, and subscriptions.
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'overview', label: 'Metrics Overview', icon: BarChart3 },
          { id: 'users', label: 'Users Directory', icon: Users },
          { id: 'links', label: 'All Links', icon: Link2 },
          { id: 'packages', label: 'Subscription Packages', icon: Package },
          { id: 'domains', label: 'Approved Domains', icon: ShieldCheck },
          { id: 'audit', label: 'Audit Logs', icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                active 
                  ? 'bg-boss-600 text-white shadow-glow' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-boss-500" />
          <p className="text-sm">Fetching management records...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Users</span>
                    <Users className="w-5 h-5 text-boss-500" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalUsers}</p>
                </div>

                <div className="p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Links</span>
                    <Link2 className="w-5 h-5 text-indigo-500" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalLinks}</p>
                </div>

                <div className="p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Recorded Clicks</span>
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalClicks}</p>
                </div>

                <div className="p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Active Subscriptions</span>
                    <Package className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.activeSubscriptions}</p>
                </div>
              </div>

              {/* Engine Status Info */}
              <div className="p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4">
                  Two-Stage Pipeline Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block mb-1 font-sans font-semibold">Stage 1 Public Domain:</span>
                    <span className="text-boss-600 dark:text-boss-400 font-bold">https://urlshort.nasirdigitalhub.com</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block mb-1 font-sans font-semibold">Stage 2 VPS API Target:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">http://107.174.37.180/api/links/stage1</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS */}
          {activeTab === 'users' && (
            <div className="rounded-3xl glass border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Registered Users</h3>
                <div className="relative w-64">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-4 rounded-l-xl">User</th>
                      <th className="py-2.5 px-4">Role</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Created</th>
                      <th className="py-2.5 px-4 rounded-r-xl text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {userList.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 dark:text-white">{u.name}</p>
                          <p className="text-slate-400 font-mono text-[11px]">{u.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                            u.role === 'admin' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 font-semibold text-[10px] ${
                            u.status === 'active' ? 'text-emerald-500' : 'text-rose-500'
                          }`}>
                            {u.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => toggleUserStatus(u.id, u.status)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                u.status === 'active'
                                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40'
                                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40'
                              }`}
                            >
                              {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LINKS */}
          {activeTab === 'links' && (
            <div className="rounded-3xl glass border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">All System Short Links</h3>
                <div className="relative w-64">
                  <input
                    type="text"
                    value={linkSearch}
                    onChange={e => setLinkSearch(e.target.value)}
                    placeholder="Search links..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-4 rounded-l-xl">User</th>
                      <th className="py-2.5 px-4">Stage 2 VPS Final URL</th>
                      <th className="py-2.5 px-4">Original Destination</th>
                      <th className="py-2.5 px-4 text-center">Clicks</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 rounded-r-xl text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {linkList.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {l.user_email || l.user_id}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-boss-600 dark:text-boss-400">
                          {l.final_url || l.stage1_url}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate font-mono text-slate-600 dark:text-slate-400">
                          {l.original_url}
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          {l.clicks_count}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                            l.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteLink(l.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PACKAGES */}
          {activeTab === 'packages' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Subscription Packages</h3>
                <button
                  onClick={() => setShowNewPkgModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-boss-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Package</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {packageList.map(pkg => (
                  <div key={pkg.id} className="p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-black text-lg text-slate-900 dark:text-white">{pkg.name}</h4>
                        <span className="text-xs font-bold text-boss-600 dark:text-boss-400">${pkg.price}/period</span>
                      </div>
                      <div className="space-y-2 mt-4 text-xs text-slate-600 dark:text-slate-300">
                        <p>Quota: <span className="font-bold">{pkg.link_quota} links</span></p>
                        <p>Duration: <span className="font-bold">{pkg.duration_days} days</span></p>
                        <p>Status: <span className="font-bold text-emerald-500">{pkg.is_active ? 'Active' : 'Disabled'}</span></p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* New Package Modal */}
              {showNewPkgModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                  <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
                    <h3 className="font-bold text-base mb-4 text-slate-900 dark:text-white">Create New Package</h3>
                    <form onSubmit={handleCreatePackage} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-500 mb-1">Package Name</label>
                        <input
                          type="text"
                          value={newPkgName}
                          onChange={e => setNewPkgName(e.target.value)}
                          required
                          placeholder="e.g. VIP Enterprise"
                          className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 mb-1">Duration (Days)</label>
                          <input
                            type="number"
                            value={newPkgDays}
                            onChange={e => setNewPkgDays(e.target.value)}
                            required
                            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Link Quota</label>
                          <input
                            type="number"
                            value={newPkgQuota}
                            onChange={e => setNewPkgQuota(e.target.value)}
                            required
                            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Price ($ USD)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={newPkgPrice}
                          onChange={e => setNewPkgPrice(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowNewPkgModal(false)}
                          className="px-4 py-2 rounded-xl text-slate-500"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl bg-boss-600 text-white font-bold"
                        >
                          Save Package
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DOMAINS */}
          {activeTab === 'domains' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Add Domain Form */}
              <div className="p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800 shadow-md">
                <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">
                  Add Approved Destination Domain
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Only destination domains in this allowlist can be shortened by users. Strict boundary matching applies.
                </p>
                <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newDomain}
                    onChange={e => setNewDomain(e.target.value)}
                    required
                    placeholder="e.g. nasirdigitalhub.com or google.com"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={newDomainNotes}
                    onChange={e => setNewDomainNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="sm:w-64 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-boss-600 hover:bg-boss-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Approve Domain</span>
                  </button>
                </form>
              </div>

              {/* Domains Table */}
              <div className="rounded-3xl glass border border-slate-200 dark:border-slate-800 p-6">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">
                  Currently Approved Allowlist ({domainList.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-4 rounded-l-xl">Domain</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Notes</th>
                        <th className="py-2.5 px-4 rounded-r-xl text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {domainList.map(dom => (
                        <tr key={dom.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="py-3 px-4 font-mono font-bold text-boss-600 dark:text-boss-400">
                            {dom.domain}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold text-[10px]">
                              Approved
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            {dom.notes || '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteDomain(dom.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                              title="Delete domain"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="rounded-3xl glass border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in">
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4">Security & Admin Audit Logs</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-4 rounded-l-xl">Timestamp</th>
                      <th className="py-2.5 px-4">Admin</th>
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4">Target</th>
                      <th className="py-2.5 px-4 rounded-r-xl">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium">
                          {log.admin_email || log.admin_id}
                        </td>
                        <td className="py-3 px-4 font-semibold text-boss-600 dark:text-boss-400">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {log.target_type}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};
