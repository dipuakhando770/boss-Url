import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api, ApiError } from '../lib/api';
import { DomainCheckerModal } from '../components/DomainCheckerModal';
import { 
  Copy, 
  Check, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  BarChart, 
  Sparkles, 
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';

interface LandingPageProps {
  navigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ navigate }) => {
  const { user } = useAuth();
  const { t } = useTheme();

  const [urlInput, setUrlInput] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [banglaAlert, setBanglaAlert] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    final_url: string;
    stage1_url: string;
    stage1_code: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkerOpen, setCheckerOpen] = useState(false);

  const handleShorten = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBanglaAlert(null);
    setSuccessResult(null);

    if (!user) {
      // Prompt user to login or register
      navigate('/login');
      return;
    }

    if (!urlInput.trim()) {
      setErrorMsg('Please enter a destination URL.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.shortenLink({
        url: urlInput.trim(),
        custom_code: customCode.trim() || undefined,
      });

      setSuccessResult({
        final_url: res.final_url,
        stage1_url: res.stage1_url,
        stage1_code: res.stage1_code,
      });
      setUrlInput('');
      setCustomCode('');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
        if (err.banglaMessage) {
          setBanglaAlert(err.banglaMessage);
        }
      } else {
        setErrorMsg('Failed to process shortening request.');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-boss-500/10 via-transparent to-transparent pointer-events-none blur-3xl -z-10" />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
        
        {/* Hero Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-boss-50 dark:bg-boss-950/60 border border-boss-200 dark:border-boss-800 text-boss-600 dark:text-boss-400 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Two-Stage Enterprise Shortening Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.15] mb-6">
            {t.heroTitle}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t.heroSubtitle}
          </p>
        </div>

        {/* Shortener Action Card */}
        <div className="max-w-3xl mx-auto">
          <div className="glass rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-slate-800">
            <form onSubmit={handleShorten} className="space-y-4">
              
              {/* Destination URL Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Destination Long URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder={t.inputPlaceholder}
                    required
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-boss-500 text-sm sm:text-base font-medium transition-all"
                  />
                </div>
              </div>

              {/* Optional Custom Alias & Domain Checker Action */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Custom Alias (Optional)
                  </label>
                  <input
                    type="text"
                    value={customCode}
                    onChange={e => setCustomCode(e.target.value)}
                    placeholder={t.customCodePlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-boss-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={() => setCheckerOpen(true)}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-boss-300 dark:border-boss-700/60 text-boss-600 dark:text-boss-400 hover:bg-boss-50 dark:hover:bg-boss-950/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t.checkDomainBtn}</span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-boss-600 via-boss-500 to-indigo-600 hover:from-boss-700 hover:to-indigo-700 text-white font-bold text-base shadow-glow flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t.shortening}</span>
                  </>
                ) : (
                  <>
                    <span>{t.shortenBtn}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

            </form>

            {/* Error Notification */}
            {errorMsg && (
              <div className="mt-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                <div className="space-y-1">
                  <p className="font-semibold">{errorMsg}</p>
                  {banglaAlert && (
                    <div className="mt-2 p-2.5 rounded-xl bg-rose-100/80 dark:bg-rose-900/40 border border-rose-300/50 font-bold text-rose-900 dark:text-rose-100 text-xs">
                      “{banglaAlert}”
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success Result Box */}
            {successResult && (
              <div className="mt-6 p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 animate-in fade-in">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {t.successTitle}
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 font-semibold">
                      {t.stage2Badge}
                    </span>
                  </div>
                </div>

                {/* Primary Short Link Box */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80">
                  <div className="font-mono text-base sm:text-lg font-bold text-boss-600 dark:text-boss-400 truncate w-full sm:w-auto">
                    {successResult.final_url}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => copyToClipboard(successResult.final_url)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? t.copied : t.copyLink}</span>
                    </button>
                    <a
                      href={successResult.final_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-boss-600 transition-colors"
                      title="Open link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Pipeline Flow details */}
                <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>Stage 1: <code className="text-emerald-700 dark:text-emerald-300 font-mono">{successResult.stage1_url}</code></span>
                  <span>Code: <code className="text-emerald-700 dark:text-emerald-300 font-mono">{successResult.stage1_code}</code></span>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-2xl bg-boss-50 dark:bg-boss-950 flex items-center justify-center text-boss-600 dark:text-boss-400 mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
              Two-Stage Redirection
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Every link is registered on Cloudflare Workers (Stage 1) and synced with the high-speed VPS cluster (Stage 2) for maximum deliverability and failover reliability.
            </p>
          </div>

          <div className="p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
              Strict Domain Allowlist
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Granular hostname boundary verification protects your campaigns against phishing, spam, and malicious domain injection before links are created.
            </p>
          </div>

          <div className="p-6 rounded-3xl glass border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
              <BarChart className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
              Deep Click Analytics
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Track referrers, geographic countries, device types, and click velocity in real-time with server-side privacy-first hashing.
            </p>
          </div>

        </div>

      </div>

      {/* Domain Checker Modal */}
      <DomainCheckerModal isOpen={checkerOpen} onClose={() => setCheckerOpen(false)} />
    </div>
  );
};
