import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Link2, 
  Sun, 
  Moon, 
  Globe, 
  ShieldAlert, 
  LogOut, 
  LayoutDashboard, 
  Sparkles 
} from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, navigate }) => {
  const { user, subscription, logout } = useAuth();
  const { theme, toggleTheme, language, setLanguage, t } = useTheme();

  return (
    <nav className="sticky top-0 z-40 w-full glass border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand */}
          <div 
            onClick={() => navigate('/')} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-boss-600 to-boss-400 flex items-center justify-center text-white shadow-glow group-hover:scale-105 transition-transform">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-boss-600 via-boss-500 to-indigo-600 dark:from-boss-400 dark:to-boss-200">
                  BOSS
                </span>
                <span className="font-bold text-xl text-slate-800 dark:text-slate-100">
                  URL
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  SaaS
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Two-Stage Enterprise Shortener
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            <button
              onClick={() => navigate('/')}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                currentPath === '/' 
                  ? 'text-boss-600 dark:text-boss-400 bg-boss-50 dark:bg-boss-950/50' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-boss-600 dark:hover:text-boss-400'
              }`}
            >
              {t.navHome}
            </button>

            {user && (
              <button
                onClick={() => navigate('/dashboard')}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  currentPath === '/dashboard' 
                    ? 'text-boss-600 dark:text-boss-400 bg-boss-50 dark:bg-boss-950/50' 
                    : 'text-slate-600 dark:text-slate-300 hover:text-boss-600 dark:hover:text-boss-400'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{t.navDashboard}</span>
              </button>
            )}

            {user && user.role === 'admin' && (
              <button
                onClick={() => navigate('/nachid/admin')}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  currentPath.includes('admin') 
                    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50' 
                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/30'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span className="hidden md:inline">{t.navAdmin}</span>
              </button>
            )}

            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle Language (English / বাংলা)"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* User Auth Menu */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user.name}</span>
                  {subscription && (
                    <span className="text-[10px] text-boss-600 dark:text-boss-400">
                      {subscription.links_used}/{subscription.link_quota} links
                    </span>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  title={t.navLogout}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm font-semibold px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {t.navLogin}
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="text-sm font-semibold px-3.5 py-1.5 rounded-lg bg-boss-600 text-white hover:bg-boss-700 shadow-sm transition-all flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t.navRegister}</span>
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </nav>
  );
};
