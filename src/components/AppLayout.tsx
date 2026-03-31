import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSuperAdmin, HYLA_CHALLENGES } from '@/lib/supabase';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { useImpersonationSafe } from '@/hooks/useImpersonation';
import { useEffectiveUserId, useEffectiveProfile } from '@/hooks/useEffectiveUser';
import { useThemeSafe } from '@/hooks/useTheme';
import { BarChart3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/* ── Notification Center ── */

function NotifItem({ color, title, subtitle, meta, action, actionLabel, isDark }: {
  color: string; title: string; subtitle: string; meta: string; action: () => void; actionLabel: string; isDark?: boolean;
}) {
  return (
    <div
      onClick={action}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors active:scale-[0.99]',
        isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
      )}
    >
      <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0', color)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', isDark ? 'text-white' : 'text-gray-900')}>{title}</p>
        {subtitle && <p className={cn('text-xs truncate', isDark ? 'text-gray-400' : 'text-gray-500')}>{subtitle}</p>}
        <p className={cn('text-[10px] mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>{meta}</p>
      </div>
      <button className={cn(
        'text-[11px] text-blue-500 font-semibold flex-shrink-0 px-2 py-1 rounded-lg',
        isDark ? 'hover:bg-blue-500/10' : 'hover:bg-blue-50'
      )}>
        {actionLabel}
      </button>
    </div>
  );
}

function NotificationCenter({ user, profile, isDark }: { user: any; profile: any; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const effectiveId = useEffectiveUserId();

  // Query new leads
  const { data: newLeads = [] } = useQuery({
    queryKey: ['notif-leads', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('public_leads')
        .select('*')
        .eq('profile_id', effectiveId)
        .eq('status', 'nouveau')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!effectiveId,
    refetchInterval: 30000,
  });

  // Query overdue tasks
  const { data: overdueTasks = [] } = useQuery({
    queryKey: ['notif-overdue', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('tasks')
        .select('*, contacts(first_name, last_name)')
        .eq('user_id', effectiveId)
        .eq('status', 'a_faire')
        .lt('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(10);
      return data || [];
    },
    enabled: !!effectiveId,
  });

  // Query today's tasks
  const { data: todayTasks = [] } = useQuery({
    queryKey: ['notif-today', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      const { data } = await supabase
        .from('tasks')
        .select('*, contacts(first_name, last_name)')
        .eq('user_id', effectiveId)
        .eq('status', 'a_faire')
        .gte('due_date', startOfDay)
        .lt('due_date', endOfDay)
        .order('due_date', { ascending: true })
        .limit(10);
      return data || [];
    },
    enabled: !!effectiveId,
  });

  // Query Hyla notifications from DB
  const { data: hylaNotifs = [] } = useQuery({
    queryKey: ['notif-hyla', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', effectiveId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!effectiveId,
    refetchInterval: 15000,
  });

  const totalCount = newLeads.length + overdueTasks.length + todayTasks.length + hylaNotifs.length;

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'min';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h';
    return Math.floor(hours / 24) + 'j';
  }

  const notifications = [
    ...newLeads.map((l: any) => ({
      id: 'lead-' + l.id,
      type: 'lead' as const,
      color: 'bg-green-500',
      title: `${l.first_name} ${l.last_name}`,
      subtitle: l.intent === 'acheter' ? 'Veut acheter un Hyla' : l.intent === 'devenir_conseiller' ? 'Veut devenir conseiller(e)' : 'Veut en savoir plus',
      meta: `via ${l.source === 'bio' ? 'Bio' : l.source === 'story' ? 'Story' : 'Direct'} \u2022 ${timeAgo(l.created_at)}`,
      action: () => { setOpen(false); navigate('/contacts'); },
      actionLabel: 'Voir',
    })),
    ...overdueTasks.map((t: any) => ({
      id: 'overdue-' + t.id,
      type: 'overdue' as const,
      color: 'bg-red-500',
      title: t.title,
      subtitle: t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}` : 'Sans contact',
      meta: `En retard de ${timeAgo(t.due_date)}`,
      action: () => { setOpen(false); navigate('/tasks'); },
      actionLabel: 'Voir',
    })),
    ...todayTasks.map((t: any) => ({
      id: 'today-' + t.id,
      type: 'today' as const,
      color: 'bg-orange-500',
      title: t.title,
      subtitle: t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}` : '',
      meta: 'Aujourd\'hui' + (t.due_date ? ' \u2022 ' + new Date(t.due_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''),
      action: () => { setOpen(false); navigate('/tasks'); },
      actionLabel: 'Voir',
    })),
    ...hylaNotifs.map((n: any) => ({
      id: 'hyla-' + n.id,
      type: 'hyla' as const,
      color: n.type === 'success' ? 'bg-emerald-500' : n.type === 'warning' ? 'bg-amber-500' : n.type === 'error' ? 'bg-red-500' : 'bg-blue-500',
      title: n.title,
      subtitle: n.message,
      meta: timeAgo(n.created_at),
      action: () => {
        // Mark as read
        supabase.from('notifications').update({ is_read: true }).eq('id', n.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['notif-hyla'] });
        });
        setOpen(false);
        if (n.link) navigate(n.link);
      },
      actionLabel: 'Voir',
    })),
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'relative p-2 rounded-xl transition-colors',
          isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
        )}
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={cn('max-w-md max-h-[80vh] overflow-y-auto', isDark && 'bg-[#1a2332] border-white/10')}>
          <DialogHeader>
            <DialogTitle className={cn('flex items-center gap-2', isDark && 'text-white')}>
              <Bell className="h-5 w-5" />
              Notifications
              {totalCount > 0 && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{totalCount}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className={cn('h-8 w-8 mx-auto mb-2', isDark ? 'text-gray-600' : 'text-gray-300')} />
              <p className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>Aucune notification</p>
            </div>
          ) : (
            <div className="space-y-1">
              {newLeads.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-green-600 uppercase mt-2 mb-1 px-1">Nouveaux leads ({newLeads.length})</p>
                  {notifications.filter(n => n.type === 'lead').map(n => (
                    <NotifItem key={n.id} {...n} isDark={isDark} />
                  ))}
                </>
              )}
              {overdueTasks.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-red-600 uppercase mt-3 mb-1 px-1">En retard ({overdueTasks.length})</p>
                  {notifications.filter(n => n.type === 'overdue').map(n => (
                    <NotifItem key={n.id} {...n} isDark={isDark} />
                  ))}
                </>
              )}
              {todayTasks.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-orange-600 uppercase mt-3 mb-1 px-1">Aujourd&apos;hui ({todayTasks.length})</p>
                  {notifications.filter(n => n.type === 'today').map(n => (
                    <NotifItem key={n.id} {...n} isDark={isDark} />
                  ))}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChallengeBanner({ isDark }: { isDark: boolean }) {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();

  const { data: deals = [] } = useQuery({
    queryKey: ['challenge-deals', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('deals').select('id, signed_at').eq('user_id', effectiveId).eq('status', 'signee');
      return data || [];
    },
    enabled: !!effectiveId,
    staleTime: 60000,
  });

  const { data: profileData } = useQuery({
    queryKey: ['profile-date', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data } = await supabase.from('profiles').select('created_at').eq('id', effectiveId).single();
      return data;
    },
    enabled: !!effectiveId,
    staleTime: 300000,
  });

  if (!effectiveId || !profileData) return null;

  const startDate = new Date(profileData.created_at);
  const now = new Date();

  const countdownEnd = new Date(startDate);
  countdownEnd.setMonth(countdownEnd.getMonth() + HYLA_CHALLENGES.countdown.months);
  const countdownDaysLeft = Math.max(0, Math.ceil((countdownEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const countdownActive = countdownDaysLeft > 0;
  const countdownSales = Math.min(deals.length, HYLA_CHALLENGES.countdown.target);

  const rookieEnd = new Date(startDate);
  rookieEnd.setMonth(rookieEnd.getMonth() + HYLA_CHALLENGES.rookie.months);
  const rookieDaysLeft = Math.max(0, Math.ceil((rookieEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const rookieActive = rookieDaysLeft > 0 && deals.length < HYLA_CHALLENGES.rookie.target;
  const rookieSales = Math.min(deals.length, HYLA_CHALLENGES.rookie.target);

  if (!countdownActive && !rookieActive) return null;

  return (
    <div className={cn('md:ml-[220px]', isDark ? 'bg-[#0f1729]' : 'bg-[#f0f4f8]')}>
      <div className="flex flex-col gap-1.5 px-4 md:px-8 pt-3">
        {countdownActive && (
          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl text-white text-[11px] font-medium">
            <div className="flex items-center gap-2">
              <Timer className="h-3.5 w-3.5" />
              <span className="font-bold">Rebours</span>
              <span>{countdownSales}/{HYLA_CHALLENGES.countdown.target}</span>
            </div>
            <span className="font-bold">{countdownDaysLeft}j</span>
          </div>
        )}
        {rookieActive && (
          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-xl text-white text-[11px] font-medium">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" />
              <span className="font-bold">Rookie</span>
              <span>{rookieSales}/{HYLA_CHALLENGES.rookie.target}</span>
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
  { to: '/stats', icon: BarChart3, label: 'Statistiques' },
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
  const { signOut, profile: authProfile, user } = useAuth();
  const { profile: effectiveProfile } = useEffectiveProfile();
  const profile = effectiveProfile || authProfile;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = isSuperAdmin(user?.email);

  const effectiveId = useEffectiveUserId();

  // Check if user is a manager (has team members)
  const { data: teamCount } = useQuery({
    queryKey: ['team-count', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return 0;
      const { count } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', effectiveId);
      return count || 0;
    },
    enabled: !!effectiveId,
    staleTime: 60000,
  });
  const isManager = isAdmin || profile?.role === 'manager' || profile?.role === 'admin' || (teamCount != null && teamCount > 0);

  // Use global theme — variant prop is now ignored, kept for backwards compat
  const themeCtx = useThemeSafe();
  const isDark = themeCtx?.isDark ?? (variant === 'dark');
  const impersonation = useImpersonationSafe();
  const isImpersonating = impersonation?.isImpersonating ?? false;

  return (
    <div className={cn('min-h-screen', isDark ? 'bg-[#0f1729]' : 'bg-[#f0f4f8]')}>
      <ImpersonationBanner />
      {/* ── Desktop Sidebar (Mockup 2 style: dark blue) ── */}
      <aside className={cn("fixed left-0 bottom-0 w-[220px] bg-[#111827] hidden md:flex flex-col z-40", isImpersonating ? 'top-10' : 'top-0')}>
        {/* Logo */}
        <div className="px-5 py-6">
          <div className="flex items-center gap-2.5">
            <img
              src="/Logo%20Hyla%20Assistant.jpeg"
              alt="Hyla"
              className="h-9 w-9 rounded-xl object-cover shadow-lg shadow-blue-500/20"
            />
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
            <img
              src="/Logo%20Hyla%20Assistant.jpeg"
              alt="Hyla"
              className="h-8 w-8 rounded-xl object-cover shadow-md shadow-blue-500/20"
            />
            <h1 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{title}</h1>
          </div>
          <div className="flex items-center gap-1">
            {actions && <div className="flex items-center gap-2">{actions}</div>}
            <NotificationCenter user={user} profile={profile} isDark={isDark} />
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
          <NotificationCenter user={user} profile={profile} isDark={isDark} />
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white text-sm font-bold cursor-pointer">
            {(profile?.full_name || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Challenge Banner ── */}
      {!hideBanner && <ChallengeBanner isDark={isDark} />}

      {/* ── Main Content ── */}
      <main className={cn('md:ml-[220px] pb-20 md:pb-0', isImpersonating && 'pt-10')}>
        <div className="p-4 md:p-8 animate-page-in">{children}</div>
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
