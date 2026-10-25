import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ShortLink, LinkAnalytics } from '../types';
import { BarChart3, Globe, Laptop, ArrowUpRight, X, Loader2 } from 'lucide-react';

interface AnalyticsModalProps {
  link: ShortLink | null;
  onClose: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ link, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(null);

  useEffect(() => {
    if (!link) return;
    setLoading(true);
    api.getLinkStats(link.id)
      .then(res => {
        setAnalytics(res.analytics);
      })
      .catch(err => {
        console.error('Failed to load stats:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [link]);

  if (!link) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-boss-600 dark:text-boss-400">
            <BarChart3 className="w-5 h-5" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              Link Click Analytics
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Link Details */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Target Destination</p>
              <a
                href={link.original_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-boss-600 dark:text-boss-400 hover:underline flex items-center gap-1 break-all"
              >
                <span>{link.original_url}</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {link.clicks_count}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Recorded Clicks</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono">
            Stage 1 Code: <span className="font-semibold text-slate-700 dark:text-slate-300">{link.stage1_code}</span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-boss-500" />
            <p className="text-sm">Fetching detailed metrics...</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Top Countries */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/30">
              <div className="flex items-center gap-2 mb-3 text-slate-800 dark:text-slate-200 font-semibold text-sm">
                <Globe className="w-4 h-4 text-boss-500" />
                <span>Top Countries</span>
              </div>
              {analytics?.topCountries && analytics.topCountries.length > 0 ? (
                <div className="space-y-2">
                  {analytics.topCountries.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{c.country || 'Unknown'}</span>
                      <span className="font-semibold text-boss-600 dark:text-boss-400">{c.count} clicks</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">No country data recorded yet.</p>
              )}
            </div>

            {/* Devices & Browsers */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/30">
              <div className="flex items-center gap-2 mb-3 text-slate-800 dark:text-slate-200 font-semibold text-sm">
                <Laptop className="w-4 h-4 text-boss-500" />
                <span>Devices</span>
              </div>
              {analytics?.topDevices && analytics.topDevices.length > 0 ? (
                <div className="space-y-2">
                  {analytics.topDevices.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{d.device_type}</span>
                      <span className="font-semibold text-boss-600 dark:text-boss-400">{d.count} clicks</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">No device data recorded yet.</p>
              )}
            </div>

            {/* Top Referrers */}
            <div className="sm:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/30">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Top Traffic Referrers</h4>
              {analytics?.topReferrers && analytics.topReferrers.length > 0 ? (
                <div className="space-y-2">
                  {analytics.topReferrers.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs">{r.referrer}</span>
                      <span className="font-semibold text-boss-600 dark:text-boss-400">{r.count} clicks</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-2 text-center">No referrer data recorded yet.</p>
              )}
            </div>

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
