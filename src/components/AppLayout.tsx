import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Network,
  TrendingUp,
  CheckSquare,
  Calendar,
  Wallet,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  MoreHorizontal,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Timer, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSuperAdmin } from '@/lib/supabase';

function ChallengeBanner({ isDark }: { isDark: boolean }) {
  const { user } = useAuth();

  const { data: deals = [] } = useQuery({
    queryKey: ['challenge-deals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('deals').select('id, signed_at').eq('user_id', user.id).eq('status', 'signee');
      return data || [];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const { data: profileData } = useQuery({
    queryKey: ['profile-date', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('created_at').eq('id', user.id).single();
      return data;
    },
    enabled: !!user,
    staleTime: 300000,
  });

  if (!user || !profileData) return null;

  const startDate = new Date(profileData.created_at);
  const now = new Date();

  const countdownEnd = new Date(startDate);
  countdownEnd.setMonth(countdownEnd.getMonth() + 2);
  const countdownDaysLeft = Math.max(0, Math.ceil((countdownEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const countdownActive = countdownDaysLeft > 0;
  const countdownSales = Math.min(deals.length, 5);

  const rookieEnd = new Date(startDate);
  rookieEnd.setMonth(rookieEnd.getMonth() + 7);
  const rookieDaysLeft = Math.max(0, Math.ceil((rookieEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const rookieActive = rookieDaysLeft > 0 && deals.length < 15;
  const rookieSales = Math.min(deals.length, 15);

  if (!countdownActive && !rookieActive) return null;

  return (
    <div className={cn('md:ml-[220px]', isDark ? 'bg-[#0f1729]' : 'bg-[#f0f4f8]')}>
      <div className="flex flex-col gap-1.5 px-4 md:px-8 pt-3">
        {countdownActive && (
          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl text-white text-[11px] font-medium">
            <div className="flex items-center gap-2">
              <Timer className="h-3.5 w-3.5" />
              <span className="font-bold">Rebours</span>
              <span>{countdownSales}/5</span>
            </div>
            <span className="font-bold">{countdownDaysLeft}j</span>
          </div>
        )}
        {rookieActive && (
          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-xl text-white text-[11px] font-medium">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" />
              <span className="font-bold">Rookie</span>
              <span>{rookieSales}/15</span>
            </div>
            <span className="font-bold">{rookieDaysLeft}j</span>
          </div>
        )}
      </div>
    </div>
  );
}

const sidebarLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Accueil' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/deals', icon: ShoppingBag, label: 'Ventes' },
  { to: '/network', icon: Network, label: 'Réseau' },
  { to: '/commissions', icon: TrendingUp, label: 'Commissions' },
  { to: '/tasks', icon: CheckSquare, label: 'Tâches' },
  { to: '/calendar', icon: Calendar, label: 'Calendrier' },
  { to: '/finance', icon: Wallet, label: 'Finance' },
  { to: '/settings', icon: Settings, label: 'Paramètres' },
];

// All available tabs for mobile bottom nav (excluding settings)
export const ALL_MOBILE_TABS = sidebarLinks.filter(l => l.to !== '/settings');

function getMobileNavLinks() {
  try {
    const saved = localStorage.getItem('hyla_mobile_tabs');
    if (saved) {
      const paths: string[] = JSON.parse(saved);
      const tabs = paths
        .map(p => ALL_MOBILE_TABS.find(l => l.to === p))
        .filter(Boolean) as typeof ALL_MOBILE_TABS;
      if (tabs.length === 5) return tabs;
    }
  } catch {}
  return sidebarLinks.slice(0, 5);
}

interface AppLayoutProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  variant?: 'light' | 'dark';
  hideBanner?: boolean;
}

export function AppLayout({ title, children, actions, variant = 'light', hideBanner = false }: AppLayoutProps) {
  const location = useLocation();
  const { signOut, profile, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = isSuperAdmin(user?.email);

  // Check if user is a manager (has team members)
  const { data: teamCount } = useQuery({
    queryKey: ['team-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return count || 0;
    },
    enabled: !!user,
    staleTime: 60000,
  });
  const isManager = isAdmin || (teamCount != null && teamCount > 0);

  const isDark = variant === 'dark';

  return (
    <div className={cn('min-h-screen', isDark ? 'bg-[#0f1729]' : 'bg-[#f0f4f8]')}>
      {/* ── Desktop Sidebar (Mockup 2 style: dark blue) ── */}
      <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-[#111827] hidden md:flex flex-col z-40">
        {/* Logo */}
        <div className="px-5 py-6">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#3b82f6] flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <span className="text-[17px] font-bold text-white tracking-tight">Hyla</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {sidebarLinks.map((link) => {
            const isActive =
              link.to === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(link.to);
            const isLocked = link.to === '/network' && !isManager;
            if (isLocked) {
              return (
                <div
                  key={link.to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-600 cursor-not-allowed opacity-40"
                  title="Réservé aux Managers"
                >
                  <link.icon className="h-[18px] w-[18px]" />
                  {link.label}
                  <span className="ml-auto text-[9px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Manager</span>
                </div>
              );
            }
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <link.icon className="h-[18px] w-[18px]" />
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Admin link */}
        {isAdmin && (
          <div className="px-3 pt-2">
            <NavLink
              to="/admin"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200',
                location.pathname === '/admin'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                  : 'text-red-400 hover:text-white hover:bg-red-500/10'
              )}
            >
              <Shield className="h-[18px] w-[18px]" />
              Admin
            </NavLink>
          </div>
        )}

        {/* User + Logout */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white text-xs font-bold">
              {(profile?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-300 truncate">
              {profile?.full_name || 'Mon compte'}
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors w-full"
          >
            <LogOut className="h-[16px] w-[16px]" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <header className={cn(
        'sticky top-0 z-40 md:hidden',
        isDark ? 'bg-[#111827] border-b border-white/5' : 'bg-white border-b border-gray-200'
      )}>
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-[#3b82f6] flex items-center justify-center">
              <span className="text-white font-bold text-xs">H</span>
            </div>
            <h1 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {actions && <div className="flex items-center gap-2">{actions}</div>}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={cn('p-2', isDark ? 'text-gray-400' : 'text-gray-500')}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className={cn(
            'absolute top-14 left-0 right-0 shadow-xl py-2 px-3 z-50',
            isDark ? 'bg-[#111827] border-b border-white/5' : 'bg-white border-b border-gray-200'
          )}>
            {sidebarLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  location.pathname.startsWith(link.to)
                    ? 'bg-[#3b82f6] text-white'
                    : isDark ? 'text-gray-400' : 'text-gray-500'
                )}
              >
                <link.icon className="h-[18px] w-[18px]" />
                {link.label}
              </NavLink>
            ))}
            <div className={cn('mt-2 pt-2 border-t', isDark ? 'border-white/10' : 'border-gray-200')}>
              <button
                onClick={() => { setMobileMenuOpen(false); signOut(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 w-full"
              >
                <LogOut className="h-[18px] w-[18px]" />
                Déconnexion
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Desktop Top Bar (Mockup 2 style) ── */}
      <div className={cn(
        'hidden md:flex items-center justify-between ml-[220px] px-8 py-4 border-b',
        isDark ? 'bg-[#0f1729] border-white/5' : 'bg-white border-gray-200'
      )}>
        <h1 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{title}</h1>
        <div className="flex items-center gap-4">
          {actions}
          <button className={cn(
            'relative p-2 rounded-xl transition-colors',
            isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          )}>
            <Bell className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">3</span>
          </button>
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white text-sm font-bold cursor-pointer">
            {(profile?.full_name || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Challenge Banner ── */}
      {!hideBanner && <ChallengeBanner isDark={isDark} />}

      {/* ── Main Content ── */}
      <main className="md:ml-[220px] pb-20 md:pb-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <MobileBottomNav isDark={isDark} isManager={isManager} />
    </div>
  );
}

function MobileBottomNav({ isDark, isManager = true }: { isDark: boolean; isManager?: boolean }) {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const mainTabs = getMobileNavLinks().slice(0, 4);
  const otherTabs = ALL_MOBILE_TABS.filter(t => !mainTabs.some(m => m.to === t.to));
  // Add settings to other tabs
  const moreItems = [...otherTabs, { to: '/settings', icon: Settings, label: 'Paramètres' }];

  const isMoreActive = moreItems.some(t => location.pathname.startsWith(t.to));

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-16 left-2 right-2 z-50" onClick={(e) => e.stopPropagation()}>
            <div className={cn(
              'rounded-2xl shadow-xl border p-2',
              isDark ? 'bg-[#1a2332] border-white/10' : 'bg-white border-gray-200'
            )}>
              <div className="grid grid-cols-4 gap-1">
                {moreItems.map((link) => {
                  const isActive = location.pathname.startsWith(link.to);
                  const locked = link.to === '/network' && !isManager;
                  if (locked) {
                    return (
                      <div
                        key={link.to}
                        className="flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-[10px] font-medium opacity-30 cursor-not-allowed text-gray-400"
                      >
                        <link.icon className="h-5 w-5" />
                        {link.label}
                      </div>
                    );
                  }
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      onClick={() => setShowMore(false)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-[10px] font-medium',
                        isActive
                          ? 'text-[#3b82f6] bg-[#3b82f6]/10'
                          : isDark ? 'text-gray-400' : 'text-gray-500'
                      )}
                    >
                      <link.icon className="h-5 w-5" />
                      {link.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className={cn(
        'fixed bottom-0 left-0 right-0 md:hidden z-40 border-t',
        isDark ? 'bg-[#111827] border-white/5' : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center justify-around py-2 px-1">
          {mainTabs.map((link) => {
            const isActive = link.to === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(link.to);
            const locked = link.to === '/network' && !isManager;
            if (locked) {
              return (
                <div
                  key={link.to}
                  className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium opacity-30 cursor-not-allowed text-gray-400"
                >
                  <div className="p-1.5 rounded-xl"><link.icon className="h-5 w-5" /></div>
                  {link.label}
                </div>
              );
            }
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors rounded-xl',
                  isActive ? 'text-[#3b82f6]' : isDark ? 'text-gray-500' : 'text-gray-400'
                )}
              >
                <div className={cn('p-1.5 rounded-xl transition-colors', isActive && 'bg-[#3b82f6]/10')}>
                  <link.icon className="h-5 w-5" />
                </div>
                {link.label}
              </NavLink>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors rounded-xl',
              (showMore || isMoreActive) ? 'text-[#3b82f6]' : isDark ? 'text-gray-500' : 'text-gray-400'
            )}
          >
            <div className={cn('p-1.5 rounded-xl transition-colors', (showMore || isMoreActive) && 'bg-[#3b82f6]/10')}>
              <MoreHorizontal className="h-5 w-5" />
            </div>
            Plus
          </button>
        </div>
      </nav>
    </>
  );
}
