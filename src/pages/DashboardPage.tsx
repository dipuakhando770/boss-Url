import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api, ApiError } from '../lib/api';
import { ShortLink } from '../types';
import { DomainCheckerModal } from '../components/DomainCheckerModal';
import { AnalyticsModal } from '../components/AnalyticsModal';
import { 
  Link2, 
  Copy, 
  Check, 
  BarChart2, 
  Trash2, 
  ExternalLink, 
  Plus, 
  Search, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2 
} from 'lucide-react';

interface DashboardPageProps {
  navigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ navigate }) => {
  const { user, subscription, refreshUser } = useAuth();
  const { t } = useTheme();

  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Shorten form inside dashboard
  const [urlInput, setUrlInput] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [shortening, setShortening] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [banglaAlert, setBanglaAlert] = useState<string | null>(null);

  // Modals
  const [checkerOpen, setCheckerOpen] = useState(false);
  const [selectedLinkForAnalytics, setSelectedLinkForAnalytics] = useState<ShortLink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLinks = async (query: string = '') => {
    setLoadingLinks(true);
    try {
      const res = await api.getLinks({ q: query, limit: 50 });
      setLinks(res.links);
    } catch (err) {
      console.error('Failed to load links:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchLinks(searchQuery);
  }, [user, searchQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBanglaAlert(null);

    if (!urlInput.trim()) return;

    setShortening(true);

    try {
      await api.shortenLink({
        url: urlInput.trim(),
        custom_code: customCode.trim() || undefined,
        title: linkTitle.trim() || undefined,
      });

      setUrlInput('');
      setCustomCode('');
      setLinkTitle('');
      await refreshUser();
      await fetchLinks(searchQuery);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.banglaMessage) {
          setBanglaAlert(err.banglaMessage);
        }
      } else {
        setFormError('Failed to create short link');
      }
    } finally {
      setShortening(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this short link?')) return;
    try {
      await api.deleteLink(id);
      setLinks(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      alert('Failed to delete link');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quotaPercent = subscription 
    ? Math.min(Math.round((subscription.links_used / (subscription.link_quota || 1)) * 100), 100) 
    : 0;

  const daysLeft = subscription 
    ? Math.max(Math.ceil((subscription.expires_at - Date.now()) / (1000 * 60 * 60 * 24)), 0)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Header & Quota Bar */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {t.dashboardTitle}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Welcome back, <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.name}</span>
            </p>
          </div>

          <button
            onClick={() => setCheckerOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-boss-300 dark:border-boss-800 bg-boss-50/50 dark:bg-boss-950/40 text-boss-600 dark:text-boss-400 text-xs font-semibold hover:bg-boss-100 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t.checkDomainBtn}</span>
          </button>
        </div>

        {/* Subscription & Quota Card */}
        {subscription && (
          <div className="p-5 rounded-2xl glass border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t.activePlan}
              </span>
              <p className="text-lg font-bold text-boss-600 dark:text-boss-400 mt-0.5">
                {subscription.package_name || 'Starter Plan'}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{daysLeft} {t.daysRemaining}</span>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-700 dark:text-slate-300">{t.quotaUsed}</span>
                <span className="text-boss-600 dark:text-boss-400">
                  {subscription.links_used} / {subscription.link_quota} ({quotaPercent}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    quotaPercent > 90 ? 'bg-rose-500' : 'bg-gradient-to-r from-boss-500 to-indigo-600'
                  }`}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </div>

          </div>
        )}
      </div>

      {/* URL Shortening Form Card */}
      <div className="mb-10 p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800 shadow-lg">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-boss-500" />
          <span>Create New Two-Stage Short Link</span>
        </h2>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Destination URL *
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                required
                placeholder="https://nasirdigitalhub.com/target-page"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-boss-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Custom Alias (Optional)
              </label>
              <input
                type="text"
                value={customCode}
                onChange={e => setCustomCode(e.target.value)}
                placeholder="e.g. boss2026"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-boss-500 focus:outline-none"
              />
            </div>

          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Campaign Title / Label (Optional)
            </label>
            <input
              type="text"
              value={linkTitle}
              onChange={e => setLinkTitle(e.target.value)}
              placeholder="e.g. Black Friday Campaign"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-boss-500 focus:outline-none"
            />
          </div>

          {/* Error & Bangla Warning */}
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <div>
                <p className="font-semibold">{formError}</p>
                {banglaAlert && (
                  <div className="mt-1.5 p-2 rounded-lg bg-rose-100/80 dark:bg-rose-900/40 font-bold text-rose-900 dark:text-rose-100">
                    “{banglaAlert}”
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={shortening}
              className="py-2.5 px-6 rounded-xl bg-boss-600 hover:bg-boss-700 text-white font-bold text-sm shadow-glow flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {shortening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              <span>{shortening ? 'Generating Two-Stage Link...' : 'Shorten Link'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* Links History & Search */}
      <div className="rounded-3xl glass border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Your Shortened Links
          </h2>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t.searchLinks}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-boss-500 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Links Table */}
        {loadingLinks ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-boss-500" />
            <p className="text-sm">Loading your links...</p>
          </div>
        ) : links.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400">
            <Link2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-sm">{t.noLinksFound}</p>
            <p className="text-xs text-slate-400 mt-1">Shorten your first link above to see it here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Shortened Link (VPS Final)</th>
                  <th className="py-3 px-4">Original Destination</th>
                  <th className="py-3 px-4 text-center">Clicks</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 rounded-r-xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {links.map(link => {
                  const displayUrl = link.final_url || link.stage1_url;
                  const isCopied = copiedId === link.id;

                  return (
                    <tr key={link.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      
                      {/* Short URL & Copy */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-boss-600 dark:text-boss-400 truncate max-w-xs">
                            {displayUrl}
                          </span>
                          <button
                            onClick={() => copyToClipboard(displayUrl, link.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Copy short link"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {link.title && (
                          <span className="text-[10px] text-slate-400 block">{link.title}</span>
                        )}
                      </td>

                      {/* Destination URL */}
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400 font-mono">
                        <a 
                          href={link.original_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="hover:text-boss-600 dark:hover:text-boss-400 hover:underline flex items-center gap-1"
                        >
                          <span className="truncate">{link.original_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>

                      {/* Clicks */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {link.clicks_count}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {link.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                        {link.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                            Pending
                          </span>
                        )}
                        {link.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                            <XCircle className="w-3 h-3" />
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(link.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedLinkForAnalytics(link)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-boss-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="View Analytics"
                          >
                            <BarChart2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(link.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Delete Link"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Domain Checker Modal */}
      <DomainCheckerModal isOpen={checkerOpen} onClose={() => setCheckerOpen(false)} />

      {/* Analytics Breakdown Modal */}
      <AnalyticsModal 
        link={selectedLinkForAnalytics} 
        onClose={() => setSelectedLinkForAnalytics(null)} 
      />

    </div>
  );
};
