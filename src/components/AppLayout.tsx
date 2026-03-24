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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Timer, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

function ChallengeBanner({ isDark }: { isDark: boolean }) {
  const { user } = useAuth();

  // Fetch user's deals to calculate challenge progress
  const { data: deals = [] } = useQuery({
    queryKey: ['challenge-deals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('deals')
        .select('id, signed_at')
        .eq('user_id', user.id)
        .eq('status', 'signee')
        .order('signed_at', { ascending: true });
      return data || [];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Fetch user profile creation date for countdown calculation
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

  // Compte à Rebours: 2 mois, 5 ventes, 5ème = 800€ bonus
  const countdownEnd = new Date(startDate);
  countdownEnd.setMonth(countdownEnd.getMonth() + 2);
  const countdownDaysLeft = Math.max(0, Math.ceil((countdownEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const countdownActive = countdownDaysLeft > 0;
  const countdownSales = Math.min(deals.length, 5);

  // Rookie: 6 mois, 15 ventes, 15ème dans le 7ème mois = 1000€ bonus
  const rookieEnd = new Date(startDate);
  rookieEnd.setMonth(rookieEnd.getMonth() + 7);
  const rookieDaysLeft = Math.max(0, Math.ceil((rookieEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const rookieActive = rookieDaysLeft > 0 && deals.length < 15;
  const rookieSales = Math.min(deals.length, 15);

  if (!countdownActive && !rookieActive) return null;

  return (
    <div className={cn('md:ml-[220px]', isDark ? 'bg-[#0f1729]' : 'bg-[#f0f4f8]')}>
      <div className="flex gap-2 px-4 md:px-8 pt-3 overflow-x-auto">
        {countdownActive && (
          <div className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl text-white text-[11px] font-medium">
            <Timer className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-bold">Compte à Rebours</span>
            <span className="opacity-80">|</span>
            <span>{countdownSales}/5 ventes</span>
            <span className="opacity-80">|</span>
            <span className="font-bold">{countdownDaysLeft}j restants</span>
            {countdownSales >= 5 && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">+800€</span>}
          </div>
        )}
        {rookieActive && (
          <div className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-xl text-white text-[11px] font-medium">
            <Trophy className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-bold">Rookie Online</span>
            <span className="opacity-80">|</span>
            <span>{rookieSales}/15 ventes</span>
            <span className="opacity-80">|</span>
            <span className="font-bold">{rookieDaysLeft}j restants</span>
            {rookieSales >= 15 && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">+1000€</span>}
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

const mobileNavLinks = sidebarLinks.slice(0, 5);

interface AppLayoutProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  variant?: 'light' | 'dark';
}

export function AppLayout({ title, children, actions, variant = 'light' }: AppLayoutProps) {
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <ChallengeBanner isDark={isDark} />

      {/* ── Main Content ── */}
      <main className="md:ml-[220px] pb-20 md:pb-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className={cn(
        'fixed bottom-0 left-0 right-0 md:hidden z-40 border-t',
        isDark ? 'bg-[#111827] border-white/5' : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center justify-around py-2 px-1">
          {mobileNavLinks.map((link) => {
            const isActive = link.to === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(link.to);
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors rounded-xl',
                  isActive
                    ? 'text-[#3b82f6]'
                    : isDark ? 'text-gray-500' : 'text-gray-400'
                )}
              >
                <div className={cn(
                  'p-1.5 rounded-xl transition-colors',
                  isActive && 'bg-[#3b82f6]/10'
                )}>
                  <link.icon className="h-5 w-5" />
                </div>
                {link.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
