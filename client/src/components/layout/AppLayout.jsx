import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu as MenuIcon, Moon, Sun, LogOut, Settings, X, ChevronsUpDown, Search } from 'lucide-react';
import { NAV } from '../../config/nav';
import { useAuth } from '../../context/AuthContext';
import { useApi, useTheme } from '../../lib/hooks';
import { Avatar, Menu } from '../ui';
import { cn } from '../../lib/format';
import CommandPalette from './CommandPalette';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}logo-192.png`} alt="Intra Interiors" className="size-14 shrink-0 mix-blend-lighten" />
      <div className="leading-tight">
        <div className="text-gold text-lg font-bold tracking-wide">Intra Interiors</div>
        <div className="text-[10px] font-medium tracking-[0.2em] text-brand-200/60 uppercase">Construction · Interiors</div>
      </div>
    </Link>
  );
}

function Sidebar({ onNavigate }) {
  const { can, user } = useAuth();
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.module)) })).filter((g) => g.items.length);
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-neutral-950 via-[#0d0b07] to-neutral-950 border-r border-brand-900/40">
      <div className="flex h-24 shrink-0 items-center border-b border-brand-400/10 px-5"><Logo /></div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pt-4 pb-6">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-widest text-brand-300/50 uppercase">{g.group}</p>
            <div className="space-y-0.5">
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate}
                  className={({ isActive }) => cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition',
                    isActive ? 'bg-gold text-neutral-950 font-semibold shadow-md shadow-brand-500/25' : 'text-neutral-400 hover:bg-brand-400/10 hover:text-brand-200',
                  )}>
                  <i.icon className="size-4 shrink-0" />
                  <span className="truncate">{i.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-brand-400/10 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-brand-400/5 px-3 py-2.5 ring-1 ring-brand-400/10">
          <Avatar name={user?.name} className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-400">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [mobile, setMobile] = useState(false);
  const [palette, setPalette] = useState(false);
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const { data: notes } = useApi('/notifications', undefined, { refetchInterval: 120_000 });
  const high = notes?.items?.filter((n) => n.severity === 'high').length || 0;

  useEffect(() => setMobile(false), [loc.pathname]);
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="min-h-screen">
      {/* desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><Sidebar /></aside>
      {/* mobile sidebar */}
      {mobile && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobile(false)} />
          <div className="absolute inset-y-0 left-0 w-72 animate-[slide-in_.2s_reverse]">
            <Sidebar onNavigate={() => setMobile(false)} />
            <button className="absolute top-4 -right-11 rounded-lg bg-white/10 p-2 text-white" onClick={() => setMobile(false)}><X className="size-5" /></button>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-xl sm:px-6 dark:border-slate-800 dark:bg-slate-950/80">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setMobile(true)}><MenuIcon className="size-5" /></button>
          <button onClick={() => setPalette(true)} className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
            <Search className="size-4" />
            <span className="flex-1 text-left">Search or jump to…</span>
            <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-500 sm:block dark:border-slate-700 dark:bg-slate-800">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={toggle} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" title="Toggle theme">
              {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
            <Link to="/notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" title="Notifications">
              <Bell className="size-5" />
              {notes?.total > 0 && (
                <span className={cn('absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950', high ? 'bg-red-500' : 'bg-brand-500')}>
                  {notes.total > 99 ? '99+' : notes.total}
                </span>
              )}
            </Link>
            <Menu
              items={[
                { label: 'Profile & settings', icon: Settings, onClick: () => nav('/settings') },
                { divider: true },
                { label: 'Sign out', icon: LogOut, danger: true, onClick: logout },
              ]}
              trigger={
                <button className="ml-1 flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Avatar name={user?.name} />
                  <div className="hidden text-left leading-tight md:block">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{user?.name}</p>
                    <p className="text-[11px] text-slate-500">{user?.role}</p>
                  </div>
                  <ChevronsUpDown className="hidden size-3.5 text-slate-400 md:block" />
                </button>
              }
            />
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
