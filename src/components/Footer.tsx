import React from 'react';
import { Link2, ShieldCheck, Server, Cpu, CheckCircle2 } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 transition-colors py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-boss-600 flex items-center justify-center text-white">
                <Link2 className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-white">
                Boss URL Shortener SaaS
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed mb-4">
              Enterprise two-stage link shortening engine built on Cloudflare Workers and D1, providing low latency edge redirects, failover resilience, domain allowlisting, and detailed analytics.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Stage 1: urlshort.nasirdigitalhub.com
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-boss-50 dark:bg-boss-950/40 text-boss-600 dark:text-boss-400 border border-boss-500/20 font-medium">
                <Server className="w-3.5 h-3.5" />
                Stage 2 VPS: 107.174.37.180
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Architecture</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-boss-500" />
                <span>Cloudflare Workers</span>
              </li>
              <li className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-boss-500" />
                <span>Cloudflare D1 SQL</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-boss-500" />
                <span>Domain Allowlist Guard</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Security & Compliance</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
              Protected against open redirects, SSRF attacks, and unauthorized destination domains. Server-side session authentication with PBKDF2 encryption.
            </p>
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Boss URL SaaS. All rights reserved.
            </p>
          </div>

        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-500">
          Designed and engineered for high availability and enterprise scale.
        </div>
      </div>
    </footer>
  );
};
