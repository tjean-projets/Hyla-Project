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
  Share2,
  GraduationCap,
  MapPin,
  BookOpen,
  Calculator,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { Timer, Trophy } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSuperAdmin, HYLA_CHALLENGES } from '@/lib/supabase';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { useImpersonationSafe } from '@/hooks/useImpersonation';
import { useEffectiveUserId, useEffectiveProfile } from '@/hooks/useEffectiveUser';
import { usePlan } from '@/hooks/usePlan';
import { useThemeSafe } from '@/hooks/useTheme';
import { useAmounts } from '@/contexts/AmountsContext';
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
        'flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors active:scale-[0.99] hover:bg-muted'
      )}
    >
      <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0', color)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate text-foreground')}>{title}</p>
        {subtitle && <p className={cn('text-xs truncate text-muted-foreground')}>{subtitle}</p>}
        <p className={cn('text-[10px] mt-0.5 text-muted-foreground')}>{meta}</p>
      </div>
      <button className={cn(
        'text-[11px] text-blue-500 font-semibold flex-shrink-0 px-2 py-1 rounded-lg hover:bg-blue-50'
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
    staleTime: 60000,
    refetchInterval: 2 * 60 * 1000, // 2 min (was 30s)
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
    staleTime: 60000,
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
    staleTime: 60000,
  });

  // Query upcoming appointments (next 24h)
  const { data: upcomingApts = [] } = useQuery({
    queryKey: ['notif-apts', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', effectiveId)
        .gte('date', now.toISOString())
        .lte('date', in24h.toISOString())
        .order('date', { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!effectiveId,
    staleTime: 60000,
    refetchInterval: 3 * 60 * 1000, // 3 min (was 30s)
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
    staleTime: 60000,
    refetchInterval: 2 * 60 * 1000, // 2 min (was 15s — 8× moins de requêtes)
  });

  const totalCount = newLeads.length + overdueTasks.length + todayTasks.length + hylaNotifs.length + upcomingApts.length;

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
    ...upcomingApts.map((a: any) => ({
      id: 'apt-' + a.id,
      type: 'apt' as const,
      color: 'bg-blue-500',
      title: a.title,
      subtitle: new Date(a.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      meta: (() => {
        const diff = new Date(a.date).getTime() - Date.now();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `Dans ${mins} min`;
        return `Dans ${Math.floor(mins / 60)}h`;
      })(),
      action: () => { setOpen(false); navigate('/calendar'); },
      actionLabel: 'Voir',
    })),
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'relative p-2 rounded-xl transition-colors hover:bg-muted text-muted-foreground'
        )}
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center badge-pulse">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={cn('max-w-md max-h-[80vh] overflow-y-auto')}>
          <DialogHeader>
            <DialogTitle className={cn('flex items-center gap-2')}>
              <Bell className="h-5 w-5" />
              Notifications
              {totalCount > 0 && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{totalCount}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className={cn('h-8 w-8 mx-auto mb-2 text-muted-foreground')} />
              <p className={cn('text-sm text-muted-foreground')}>Aucune notification</p>
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
              {upcomingApts.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-blue-600 uppercase mt-3 mb-1 px-1">RDV à venir ({upcomingApts.length})</p>
                  {notifications.filter(n => n.type === 'apt').map(n => (
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

/* ── Global Search ── */

function GlobalSearch({ isDark }: { isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const effectiveId = useEffectiveUserId();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: contacts = [] } = useQuery({
    queryKey: ['search-contacts', effectiveId, query],
    queryFn: async () => {
      if (!effectiveId || query.length < 2) return [];
      const { data } = await supabase.from('contacts')
        .select('id, first_name, last_name, phone, status')
        .eq('user_id', effectiveId)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5);
      return data || [];
    },
    enabled: open && query.length >= 2,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['search-deals', effectiveId, query],
    queryFn: async () => {
      if (!effectiveId || query.length < 2) return [];
      const { data } = await supabase.from('deals')
        .select('id, product, amount, status, contacts(first_name, last_name)')
        .eq('user_id', effectiveId)
        .or(`product.ilike.%${query}%,notes.ilike.%${query}%`)
        .limit(5);
      return data || [];
    },
    enabled: open && query.length >= 2,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['search-tasks', effectiveId, query],
    queryFn: async () => {
      if (!effectiveId || query.length < 2) return [];
      const { data } = await supabase.from('tasks')
        .select('id, title, status, due_date')
        .eq('user_id', effectiveId)
        .ilike('title', `%${query}%`)
        .limit(5);
      return data || [];
    },
    enabled: open && query.length >= 2,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['search-members', effectiveId, query],
    queryFn: async () => {
      if (!effectiveId || query.length < 2) return [];
      const { data } = await supabase.from('team_members')
        .select('id, first_name, last_name, status, level')
        .eq('user_id', effectiveId)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(5);
      return data || [];
    },
    enabled: open && query.length >= 2,
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-xl transition-colors hover:bg-muted text-muted-foreground"
        title="Recherche globale (⌘K)"
      >
        <Search className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher contacts, ventes, tâches..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {query.length < 2 ? (
              <p className="text-center text-xs text-muted-foreground py-8">Tape au moins 2 caractères...</p>
            ) : (contacts.length + deals.length + tasks.length + members.length === 0) ? (
              <p className="text-center text-xs text-muted-foreground py-8">Aucun résultat pour &quot;{query}&quot;</p>
            ) : (
              <div className="space-y-4">
                {contacts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Contacts</p>
                    {(contacts as any[]).map((c: any) => (
                      <button key={c.id} onClick={() => { navigate('/contacts'); setOpen(false); setQuery(''); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left">
                        <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {c.first_name[0]}{c.last_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{c.first_name} {c.last_name}</p>
                          {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {deals.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Ventes</p>
                    {(deals as any[]).map((d: any) => (
                      <button key={d.id} onClick={() => { navigate('/deals'); setOpen(false); setQuery(''); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left">
                        <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{d.product || 'Vente'}</p>
                          <p className="text-xs text-muted-foreground">{(d.amount || 0).toLocaleString('fr-FR')} € · {d.contacts ? `${(d.contacts as any).first_name} ${(d.contacts as any).last_name}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {tasks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Tâches</p>
                    {(tasks as any[]).map((t: any) => (
                      <button key={t.id} onClick={() => { navigate('/tasks'); setOpen(false); setQuery(''); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left">
                        <div className="h-7 w-7 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
                          <CheckSquare className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                          {t.due_date && <p className="text-xs text-muted-foreground">Échéance {new Date(t.due_date).toLocaleDateString('fr-FR')}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {members.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1">Réseau</p>
                    {(members as any[]).map((m: any) => (
                      <button key={m.id} onClick={() => { navigate('/network'); setOpen(false); setQuery(''); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left">
                        <div className="h-7 w-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                          <Network className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{m.first_name} {m.last_name}</p>
                          <p className="text-xs text-muted-foreground">{m.status === 'actif' ? 'Actif' : 'Inactif'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
      const { data } = await supabase.from('profiles').select('created_at, challenge_start_date').eq('id', effectiveId).single();
      return data;
    },
    enabled: !!effectiveId,
    staleTime: 300000,
  });

  if (!effectiveId || !profileData) return null;

  const startDate = profileData
    ? new Date((profileData as any).challenge_start_date || profileData.created_at)
    : new Date();
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
    <div className={cn('md:ml-[220px] bg-background')}>
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
  { to: '/network', icon: Network, label: 'Équipes' },
  { to: '/academie', icon: BookOpen, label: 'Académie', academieOnly: true },
  { to: '/commissions', icon: TrendingUp, label: 'Commissions' },
  { to: '/simulateur', icon: Calculator, label: 'Simulateur' },
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
      if (tabs.length >= 2) return tabs;
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
  const { isTrial, trialDaysLeft } = usePlan();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ⚠️ isImpersonating doit être connu AVANT isAdmin pour éviter la fuite des droits admin
  const impersonation = useImpersonationSafe();
  const isImpersonating = impersonation?.isImpersonating ?? false;
  const isAdmin = isSuperAdmin(user?.email);
  // Admin réel uniquement si pas en mode impersonation
  const isRealAdmin = !isImpersonating && isAdmin;

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
  const isManager = isRealAdmin || profile?.role === 'manager' || profile?.role === 'admin' || (teamCount != null && teamCount > 0);

  // Check Respire Académie access
  const { data: academieSettings } = useQuery({
    queryKey: ['academie-access-nav', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data } = await supabase
        .from('user_settings')
        .select('respire_academie_access')
        .eq('user_id', effectiveId)
        .maybeSingle();
      return data;
    },
    enabled: !!effectiveId,
    staleTime: 0,
  });
  const hasAcademieAccess = isRealAdmin || academieSettings?.respire_academie_access === true;

  // Amounts visibility toggle
  const { visible: amountsVisible, toggle: toggleAmounts } = useAmounts();

  // Use global theme — variant prop is now ignored, kept for backwards compat
  const themeCtx = useThemeSafe();
  const isDark = themeCtx?.isDark ?? (variant === 'dark');

  return (
    <div className={cn('min-h-screen bg-background')}>
      <ImpersonationBanner />
      {/* ── Desktop Sidebar (Mockup 2 style: dark blue) ── */}
      <aside className={cn("fixed left-0 bottom-0 w-[220px] bg-[#111827] hidden md:flex flex-col z-40", isImpersonating ? 'top-10' : 'top-0')}>
        {/* Logo */}
        <div className="px-5 py-6">
          <div className="flex items-center gap-2.5">
            <img
              src="/Hyla_logo_bold.png"
              alt="Hyla"
              className="h-9 w-9 object-contain"
            />
            <span className="text-[17px] font-bold text-white tracking-tight">Hyla</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {sidebarLinks.map((link) => {
            // Hide academie link if user has no access
            if ((link as any).academieOnly && !hasAcademieAccess) return null;

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
            // Special styling for Académie link
            if ((link as any).academieOnly) {
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-emerald-400 hover:text-white hover:bg-emerald-500/10'
                  )}
                >
                  <link.icon className="h-[18px] w-[18px]" />
                  {link.label}
                  {!isActive && (
                    <span className="ml-auto text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-semibold">NEW</span>
                  )}
                </NavLink>
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
        'sticky top-0 z-40 md:hidden bg-card border-b border-border'
      )}>
        <div className="flex h-14 items-center justify-between px-4 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img
              src="/Hyla_logo_bold.png"
              alt="Hyla"
              className="h-8 w-8 object-contain brightness-0 flex-shrink-0"
            />
            <h1 className={cn('text-sm font-semibold text-foreground truncate')}>{title}</h1>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {actions && <div className="flex items-center gap-1">{actions}</div>}
            <button
              onClick={toggleAmounts}
              className={cn('p-2 rounded-xl transition-colors', amountsVisible ? 'text-muted-foreground hover:text-foreground' : 'text-amber-500 bg-amber-50 dark:bg-amber-950/30')}
              title={amountsVisible ? 'Masquer les montants' : 'Afficher les montants'}
            >
              {amountsVisible ? <Eye className="h-4.5 w-4.5 h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
            </button>
            <GlobalSearch isDark={isDark} />
            <NotificationCenter user={user} profile={profile} isDark={isDark} />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={cn('p-2 text-muted-foreground')}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className={cn(
            'absolute top-14 left-0 right-0 shadow-xl py-2 px-3 z-50 bg-card border-b border-border'
          )}>
            {sidebarLinks.filter(link => !(link as any).academieOnly || hasAcademieAccess).map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  location.pathname.startsWith(link.to)
                    ? (link as any).academieOnly ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white' : 'bg-[#3b82f6] text-white'
                    : (link as any).academieOnly ? 'text-emerald-500' : 'text-muted-foreground'
                )}
              >
                <link.icon className="h-[18px] w-[18px]" />
                {link.label}
              </NavLink>
            ))}
            <div className={cn('mt-2 pt-2 border-t border-border')}>
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
        'hidden md:flex items-center justify-between ml-[220px] px-8 py-4 border-b bg-background border-border'
      )}>
        <h1 className={cn('text-xl font-bold text-foreground')}>{title}</h1>
        <div className="flex items-center gap-3">
          {actions}
          <button
            onClick={toggleAmounts}
            className={cn('p-2 rounded-xl transition-colors', amountsVisible ? 'text-muted-foreground hover:text-foreground hover:bg-muted' : 'text-amber-500 bg-amber-50 dark:bg-amber-950/30')}
            title={amountsVisible ? 'Masquer les montants' : 'Afficher les montants'}
          >
            {amountsVisible ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
          </button>
          <GlobalSearch isDark={isDark} />
          <NotificationCenter user={user} profile={profile} isDark={isDark} />
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white text-sm font-bold cursor-pointer">
            {(profile?.full_name || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Challenge Banner ── */}
      {!hideBanner && <ChallengeBanner isDark={isDark} />}

      {/* ── Trial Banner ── */}
      {!hideBanner && isTrial && (
        <div className="md:ml-[220px] bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Essai gratuit</span> — {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}
            {' · '}
            <a href="mailto:contact@hyla-crm.fr" className="underline font-semibold">Choisir un plan</a>
          </p>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className={cn('md:ml-[220px] pb-20 md:pb-0 overflow-x-hidden', isImpersonating && 'pt-10')}>
        <div key={location.pathname} className="p-4 md:p-8 animate-page-in">{children}</div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <MobileBottomNav isDark={isDark} isManager={isManager} hasAcademieAccess={hasAcademieAccess} />
    </div>
  );
}

function MobileBottomNav({ isDark, isManager = true, hasAcademieAccess = false }: { isDark: boolean; isManager?: boolean; hasAcademieAccess?: boolean }) {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const [, forceUpdate] = useState(0);

  // Réagit immédiatement quand les préférences de nav changent (depuis Paramètres)
  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('hyla_nav_updated', handler);
    return () => window.removeEventListener('hyla_nav_updated', handler);
  }, []);

  // Filtrer les onglets selon les droits d'accès
  const allowedTabs = ALL_MOBILE_TABS.filter(t => !(t as any).academieOnly || hasAcademieAccess);
  const mainTabs = getMobileNavLinks()
    .filter(t => !(t as any).academieOnly || hasAcademieAccess)
    .slice(0, 4);
  const otherTabs = allowedTabs.filter(t => !mainTabs.some(m => m.to === t.to));
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
              'rounded-2xl shadow-xl border p-2 bg-card border-border'
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
                          : 'text-muted-foreground'
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
        'fixed bottom-0 left-0 right-0 md:hidden z-40 border-t bg-card border-border'
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
                  isActive ? 'text-[#3b82f6]' : 'text-muted-foreground'
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
              (showMore || isMoreActive) ? 'text-[#3b82f6]' : 'text-muted-foreground'
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
