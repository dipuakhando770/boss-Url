import React, { useState } from 'react';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { CheckCircle2, AlertTriangle, ShieldCheck, X, Search, Loader2 } from 'lucide-react';

interface DomainCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DomainCheckerModal: React.FC<DomainCheckerModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTheme();
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    tested: boolean;
    hostname?: string;
    isApproved?: boolean;
    banglaMessage?: string;
    error?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await api.checkDomain(urlInput.trim());
      setResult({
        tested: true,
        hostname: res.hostname,
        isApproved: res.isApproved,
        banglaMessage: res.banglaMessage,
      });
    } catch (err: unknown) {
      setResult({
        tested: true,
        error: err instanceof Error ? err.message : 'Validation failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-boss-600 dark:text-boss-400">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              Domain Approval Checker
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCheck} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Destination URL or Hostname
            </label>
            <div className="relative">
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://nasirdigitalhub.com/page or google.com"
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-boss-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !urlInput.trim()}
                className="absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg bg-boss-600 text-white hover:bg-boss-700 disabled:opacity-50 text-xs font-medium flex items-center gap-1"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Check</span>
              </button>
            </div>
          </div>
        </form>

        {/* Results Box */}
        {result && (
          <div className="mt-5 animate-in fade-in">
            {result.error ? (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                <div>
                  <p className="font-semibold">Invalid URL</p>
                  <p className="text-xs mt-0.5">{result.error}</p>
                </div>
              </div>
            ) : result.isApproved ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <p className="font-semibold">Domain Approved: <span className="font-mono text-emerald-600 dark:text-emerald-400">{result.hostname}</span></p>
                  <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">
                    This domain is active in the Boss URL allowlist. You can safely create shortened links for it.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <p className="font-semibold">Domain Not Approved: <span className="font-mono text-amber-700 dark:text-amber-300">{result.hostname}</span></p>
                  {/* Required Bengali Warning Message */}
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-100/70 dark:bg-amber-900/40 border border-amber-300/50 text-xs font-semibold text-amber-950 dark:text-amber-100 leading-relaxed">
                    “{t.domainNotApprovedBn}”
                  </div>
                  <p className="text-xs mt-2 text-slate-600 dark:text-slate-400">
                    Destination domains must be approved by the administrator before links can be shortened to prevent abuse.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
