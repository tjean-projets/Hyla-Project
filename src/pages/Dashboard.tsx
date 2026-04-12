import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, HYLA_CHALLENGES, HYLA_LEVELS, getPersonalSaleCommission, getHylaCommission } from '@/lib/supabase';
import { useAmounts } from '@/contexts/AmountsContext';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Timer,
  Trophy,
  ChevronRight,
  Target,
  Zap,
  GraduationCap,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState, useMemo, useCallback } from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import OnboardingGuide from '@/components/OnboardingGuide';
import GettingStartedWidget from '@/components/GettingStartedWidget';
import { useEffectiveUserId, useEffectiveProfile } from '@/hooks/useEffectiveUser';
import { SkeletonKPI, SkeletonTable } from '@/components/ui/skeleton-card';

export default function Dashboard() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { profile } = useEffectiveProfile();
  const [showChallenge, setShowChallenge] = useState<'countdown' | 'rookie' | null>(null);

  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useQuery({
    queryKey: ['dashboard-kpis', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data, error } = await supabase.rpc('get_dashboard_kpis', { p_user_id: effectiveId });
      if (error) throw error;
      return data as Record<string, number>;
    },
    enabled: !!effectiveId,
    staleTime: 30000,
  });

  // Auto-generate relance tasks for inactive prospects (runs once per session)
  useQuery({
    queryKey: ['auto-relances', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return 0;
      const { data } = await supabase.rpc('generate_relance_tasks', { p_user_id: effectiveId, p_days_threshold: 7 });
      return data || 0;
    },
    enabled: !!effectiveId,
    staleTime: 1000 * 60 * 30, // Only run every 30 minutes
    refetchOnWindowFocus: false,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['dashboard-deals', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('deals').select('id, signed_at').eq('user_id', effectiveId).eq('status', 'signee');
      return data || [];
    },
    enabled: !!effectiveId,
    staleTime: 120000,
  });

  const { data: profileData } = useQuery({
    queryKey: ['profile-date-dash', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data } = await supabase.from('profiles').select('created_at, challenge_start_date').eq('id', effectiveId).single();
      return data;
    },
    enabled: !!effectiveId,
  });

  // Objectifs du mois — définis par le manager (member_objectives) ou personnels (user_settings)
  const { data: myObjectives } = useQuery({
    queryKey: ['my-objectives', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data } = await supabase
        .from('member_objectives')
        .select('*')
        .eq('user_id', effectiveId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!effectiveId,
    staleTime: 60000,
  });

  const { data: userSettings } = useQuery({
    queryKey: ['user-settings', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data } = await supabase
        .from('user_settings')
        .select('monthly_sales_target, monthly_ca_target, hyla_level, challenges_disabled')
        .eq('user_id', effectiveId)
        .maybeSingle();
      return data;
    },
    enabled: !!effectiveId,
  });

  // Compteur de ventes validées par TRV import — pour les challenges Hyla
  // On compte les commission_import_rows (is_owner_row = true) du user
  const challengesDisabled = (userSettings as any)?.challenges_disabled === true;
  const { data: trvValidatedCount = 0 } = useQuery({
    queryKey: ['trv-validated-sales', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return 0;
      // Compter les lignes de l'import TRV qui correspondent au user lui-même
      const { count } = await supabase
        .from('commission_import_rows')
        .select('id', { count: 'exact', head: true })
        .eq('is_owner_row', true);
      return count ?? 0;
    },
    enabled: !!effectiveId && !challengesDisabled,
    staleTime: 300000,
  });

  const { data: myManagerChallenge } = useQuery({
    queryKey: ['my-manager-challenge', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      // Chercher si ce user est un membre direct (1ère ligne) chez un manager
      // La RLS de team_challenges permet déjà de lire si on est membre direct
      const { data } = await supabase
        .from('team_challenges')
        .select('*, team_members!inner(linked_user_id, sponsor_id)')
        .eq('status', 'actif')
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!effectiveId,
    staleTime: 60000,
  });

  const { data: myChallengeProg } = useQuery({
    queryKey: ['my-challenge-progress', myManagerChallenge?.id, effectiveId],
    queryFn: async () => {
      if (!myManagerChallenge || !effectiveId) return 0;
      if (myManagerChallenge.objective_type === 'ventes') {
        const { count } = await supabase.from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', effectiveId)
          .eq('status', 'signee')
          .gte('signed_at', myManagerChallenge.start_date)
          .lte('signed_at', myManagerChallenge.end_date);
        return count || 0;
      } else if (myManagerChallenge.objective_type === 'ca') {
        const { data: dealsData } = await supabase.from('deals')
          .select('amount')
          .eq('user_id', effectiveId)
          .eq('status', 'signee')
          .gte('signed_at', myManagerChallenge.start_date)
          .lte('signed_at', myManagerChallenge.end_date);
        return (dealsData || []).reduce((s: number, d: any) => s + (d.amount || 0), 0);
      } else if (myManagerChallenge.objective_type === 'recrues') {
        const { count } = await supabase.from('team_members')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', effectiveId)
          .gte('joined_at', myManagerChallenge.start_date)
          .lte('joined_at', myManagerChallenge.end_date);
        return count || 0;
      }
      return 0;
    },
    enabled: !!myManagerChallenge && !!effectiveId,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-dash', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('team_members')
        .select('id, status, sponsor_id, hyla_level')
        .eq('user_id', effectiveId);
      return data || [];
    },
    enabled: !!effectiveId,
    staleTime: 60000,
  });

  const { data: recentImports = [] } = useQuery({
    queryKey: ['recent-imports-dash', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const n = new Date();
      const periods = Array.from({ length: 4 }, (_, i) => {
        const d = new Date(n.getFullYear(), n.getMonth() - i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      });
      const { data } = await supabase
        .from('commission_imports')
        .select('period, id, commission_import_rows(id, is_owner_row, match_status)')
        .eq('user_id', effectiveId)
        .in('period', periods)
        .order('period', { ascending: false });
      return data || [];
    },
    enabled: !!effectiveId,
    staleTime: 60000,
  });

  // Total lessons count
  const { data: totalLessons } = useQuery({
    queryKey: ['formation-total-lessons'],
    queryFn: async () => {
      const { count } = await supabase
        .from('formation_lessons')
        .select('id', { count: 'exact', head: true })
      return count || 0
    },
    staleTime: 300000,
  })

  // User's completed lessons
  const { data: completedLessons } = useQuery({
    queryKey: ['formation-progress-dash', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return 0
      const { count } = await supabase
        .from('formation_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', effectiveId)
      return count || 0
    },
    enabled: !!effectiveId,
    staleTime: 60000,
  })

  const { data: upcomingTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['upcoming-tasks', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('tasks')
        .select('*, contacts(first_name, last_name)')
        .eq('user_id', effectiveId)
        .in('status', ['a_faire', 'en_cours'])
        .order('due_date', { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!effectiveId,
    staleTime: 60000,
  });

  const k = kpis || {} as Record<string, number>;
  const nbSignees = deals.length;
  const commDirecte = k.commissions_mois_directe || 0;
  const commReseau = k.commissions_mois_reseau || 0;
  const commTotal = commDirecte + commReseau;
  // Fallback to estimated if no real commissions yet
  const commissionAffichee = commTotal > 0 ? commTotal : getHylaCommission(nbSignees);

  // Challenge calculations (centralisé via HYLA_CHALLENGES)
  // Compteur basé sur les ventes validées par import TRV uniquement (données fiables)
  const startDate = profileData
    ? new Date((profileData as any).challenge_start_date || profileData.created_at)
    : new Date();
  const now = new Date();

  const countdownEnd = new Date(startDate);
  countdownEnd.setMonth(countdownEnd.getMonth() + HYLA_CHALLENGES.countdown.months);
  const countdownDaysLeft = Math.max(0, Math.ceil((countdownEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const countdownActive = !challengesDisabled && countdownDaysLeft > 0;
  const countdownSales = Math.min(trvValidatedCount, HYLA_CHALLENGES.countdown.target);
  const countdownPct = Math.round((countdownSales / HYLA_CHALLENGES.countdown.target) * 100);

  const rookieEnd = new Date(startDate);
  rookieEnd.setMonth(rookieEnd.getMonth() + HYLA_CHALLENGES.rookie.months);
  const rookieDaysLeft = Math.max(0, Math.ceil((rookieEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const rookieActive = !challengesDisabled && rookieDaysLeft > 0 && trvValidatedCount < HYLA_CHALLENGES.rookie.target;
  const rookieSales = Math.min(trvValidatedCount, HYLA_CHALLENGES.rookie.target);
  const rookiePct = Math.round((rookieSales / HYLA_CHALLENGES.rookie.target) * 100);

  // Chart data — ventilation réelle des ventes signées par mois
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const month = d.getMonth();
    const year = d.getFullYear();
    const ventesduMois = deals.filter((deal: any) => {
      if (!deal.signed_at) return false;
      const sd = new Date(deal.signed_at);
      return sd.getMonth() === month && sd.getFullYear() === year;
    }).length;
    return {
      name: d.toLocaleDateString('fr-FR', { month: 'short' }),
      Ventes: ventesduMois,
    };
  });

  // Objectifs personnels — fallback sur user_settings si pas de member_objectives
  const salesTarget = (myObjectives as any)?.ventes_objectif_mois ?? (userSettings as any)?.monthly_sales_target ?? 0;
  const caTarget = (userSettings as any)?.monthly_ca_target ?? 0;
  const hasObjectives = salesTarget > 0 || caTarget > 0;

  // Progression ventes du mois en cours
  const currentMonthSales = (() => {
    const n = new Date();
    return deals.filter((d: any) => {
      if (!d.signed_at) return false;
      const sd = new Date(d.signed_at);
      return sd.getMonth() === n.getMonth() && sd.getFullYear() === n.getFullYear();
    }).length;
  })();
  const currentMonthCA = k.ca_mois || 0;

  // ── Com attendue (théorique depuis deals saisis manuellement) ──
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const myLevel = (userSettings as any)?.hyla_level || 'manager';

  // Ventes perso ce mois, triées chronologiquement
  const currentMonthDeals = deals
    .filter((d: any) => {
      if (!d.signed_at) return false;
      const sd = new Date(d.signed_at);
      return sd.getMonth() === now.getMonth() && sd.getFullYear() === now.getFullYear();
    })
    .sort((a: any, b: any) => new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime());

  const comAttendue = currentMonthDeals.reduce((sum: number, _: any, idx: number) => {
    return sum + getPersonalSaleCommission(idx + 1);
  }, 0);

  // Com confirmée = depuis imports TRV (commissions consolidées)
  const comConfirmee = commTotal; // commDirecte + commReseau depuis KPIs

  // ── Widget "Prochain niveau" ──
  const myLevelIdx = HYLA_LEVELS.findIndex(l => l.value === myLevel);
  const nextLevel = myLevelIdx >= 0 && myLevelIdx < HYLA_LEVELS.length - 1 ? HYLA_LEVELS[myLevelIdx + 1] : null;

  const MANAGER_LEVELS = ['manager','chef_groupe','chef_agence','distributeur','elite_bronze','elite_argent','elite_or'];

  // Vendeurs directs actifs (pas de sponsor dans l'équipe = recruté directement par le manager)
  const directActifs = (teamMembers as any[]).filter(m => !m.sponsor_id && m.status === 'actif').length;

  // Lignées = managers directs (pas de sponsor dans l'équipe ET niveau manager+)
  const ligneesCount = (teamMembers as any[]).filter(m =>
    !m.sponsor_id && MANAGER_LEVELS.includes(m.hyla_level || '')
  ).length;

  // Vendeurs directs actifs hors managers (pour ceux qui ont besoin de "directs + indirects")
  const indirectActifs = (teamMembers as any[]).filter(m => m.sponsor_id && m.status === 'actif').length;

  // Ventes équipe : priorité au mois en cours (KPI), sinon dernier import disponible
  // (car si on est en mi-mois et que le dernier import date du mois précédent,
  //  le KPI mois en cours = 0 alors que les données réelles sont dans le dernier import)
  const latestImport = (recentImports as any[]).length > 0 ? (recentImports as any[])[0] : null;
  const latestImportTeamSales = latestImport
    ? ((latestImport.commission_import_rows || []) as any[])
        .filter((r: any) => !r.is_owner_row && r.match_status !== 'non_reconnu').length
    : 0;
  const teamSalesThisMonth = (k.equipe_ventes_mois || 0) > 0
    ? (k.equipe_ventes_mois || 0)
    : latestImportTeamSales;

  // Vérification x3 mois consécutifs : vérifier les 3 mois précédant le dernier import
  // (pas le mois calendaire en cours, qui peut ne pas encore avoir d'import)
  const importedPeriods = new Set((recentImports as any[]).map((r: any) => r.period));
  const latestImportedPeriod = latestImport?.period || null;
  const last3Periods = latestImportedPeriod
    ? Array.from({ length: 3 }, (_, i) => {
        const [y, m] = latestImportedPeriod.split('-').map(Number);
        const d = new Date(y, m - 1 - i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })
    : Array.from({ length: 3 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      });
  const consecutiveMonthsMet = last3Periods.every(p => importedPeriods.has(p));

  // Conditions du prochain niveau à remplir
  type LevelCondition = { label: string; met: boolean; detail: string };
  const nextLevelConditions: LevelCondition[] = nextLevel ? (() => {
    const conds: LevelCondition[] = [];
    const nv = nextLevel.value;

    if (nv === 'manager') {
      conds.push({ label: 'Vendeurs directs actifs', met: directActifs >= 3, detail: `${directActifs} / 3 requis` });
      conds.push({ label: 'Volume équipe/mois', met: teamSalesThisMonth >= 15, detail: `${teamSalesThisMonth} / 15 ventes` });
    } else if (nv === 'chef_groupe') {
      conds.push({ label: 'Vendeurs directs actifs', met: directActifs >= 4, detail: `${directActifs} / 4 requis` });
      conds.push({ label: 'Vendeur indirect actif', met: indirectActifs >= 1, detail: `${indirectActifs} / 1 requis` });
      conds.push({ label: 'Volume équipe/mois', met: teamSalesThisMonth >= 30, detail: `${teamSalesThisMonth} / 30 ventes` });
    } else if (nv === 'chef_agence') {
      conds.push({ label: 'Vendeurs directs actifs', met: directActifs >= 4, detail: `${directActifs} / 4 requis` });
      conds.push({ label: 'Lignée manager directe', met: ligneesCount >= 1, detail: `${ligneesCount} / 1 requise` });
      conds.push({ label: 'Volume équipe/mois', met: teamSalesThisMonth >= 60, detail: `${teamSalesThisMonth} / 60 ventes` });
    } else if (nv === 'distributeur') {
      conds.push({ label: 'Lignées managers directes', met: ligneesCount >= 2, detail: `${ligneesCount} / 2 requises` });
      conds.push({ label: 'Volume équipe/mois', met: teamSalesThisMonth >= 90, detail: `${teamSalesThisMonth} / 90 ventes` });
    } else if (nv === 'elite_bronze') {
      conds.push({ label: 'Lignées managers directes', met: ligneesCount >= 3, detail: `${ligneesCount} / 3 requises` });
      conds.push({ label: 'Volume équipe/mois', met: teamSalesThisMonth >= 120, detail: `${teamSalesThisMonth} / 120 ventes` });
    }
    // Condition transversale : 3 mois consécutifs via imports
    conds.push({
      label: '3 mois consécutifs',
      met: consecutiveMonthsMet,
      detail: consecutiveMonthsMet
        ? '3 imports TRV détectés ✓'
        : `${last3Periods.filter(p => importedPeriods.has(p)).length}/3 imports TRV`
    });
    return conds;
  })() : [];

  const conditionsMet = nextLevelConditions.filter(c => c.met).length;
  const conditionsTotal = nextLevelConditions.length;
  const levelProgressPct = conditionsTotal > 0 ? Math.round((conditionsMet / conditionsTotal) * 100) : 0;

  const salesPct = salesTarget > 0 ? Math.min(100, Math.round((currentMonthSales / salesTarget) * 100)) : 0;
  const caPct = caTarget > 0 ? Math.min(100, Math.round((currentMonthCA / caTarget) * 100)) : 0;

  const objectifBarColor = (pct: number) =>
    pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500';
  const objectifTextColor = (pct: number) =>
    pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-blue-600' : 'text-amber-600';

  const firstName = profile?.full_name?.split(' ')[0] || 'Partenaire';
  const { visible: amountsVisible, mask: maskAmount } = useAmounts();
  const fmtAmt = useCallback((n: number) => amountsVisible ? n.toLocaleString('fr-FR') : '•••', [amountsVisible]);

  return (
    <AppLayout title="Dashboard" hideBanner>
      <div className="space-y-5">
        {/* ── Greeting ── */}
        <div>
          <h2 className="text-lg font-bold text-foreground">Bonjour {firstName} !</h2>
          <p className="text-xs text-muted-foreground capitalize">{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {/* ── Challenges (clickable cards) ── */}
        {(countdownActive || rookieActive) && (
          <div className="space-y-3">
            {countdownActive && (
              <div onClick={() => setShowChallenge('countdown')} className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 text-white cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="h-5 w-5" />
                  <span className="text-sm font-bold uppercase tracking-wider">{HYLA_CHALLENGES.countdown.name} — {HYLA_CHALLENGES.countdown.months} mois</span>
                </div>
                <p className="text-xs opacity-90 mb-3">
                  Réalise {HYLA_CHALLENGES.countdown.target} ventes pendant cette période. La {HYLA_CHALLENGES.countdown.target}ème vente est sur-commissionnée <span className="font-bold">{HYLA_CHALLENGES.countdown.bonus}€</span>
                </p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-black">{countdownSales}/{HYLA_CHALLENGES.countdown.target}</span>
                  <span className="text-sm font-bold opacity-90">{countdownDaysLeft}j restants</span>
                </div>
                <div className="h-3 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-card transition-all duration-700" style={{ width: `${countdownPct}%` }} />
                </div>
                {countdownSales >= HYLA_CHALLENGES.countdown.target && (
                  <div className="mt-2 text-center bg-white/20 rounded-xl py-1.5 text-sm font-bold">+{HYLA_CHALLENGES.countdown.bonus}€ débloqué !</div>
                )}
              </div>
            )}

            {rookieActive && (
              <div onClick={() => setShowChallenge('rookie')} className="bg-gradient-to-r from-violet-500 to-indigo-500 rounded-2xl p-5 text-white cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-5 w-5" />
                  <span className="text-sm font-bold uppercase tracking-wider">{HYLA_CHALLENGES.rookie.name} — {HYLA_CHALLENGES.rookie.months} mois</span>
                </div>
                <p className="text-xs opacity-90 mb-3">
                  Réalise {HYLA_CHALLENGES.rookie.target - 1} ventes en {HYLA_CHALLENGES.rookie.months} mois. La {HYLA_CHALLENGES.rookie.target}ème vente déclenche une super-commission de <span className="font-bold">{HYLA_CHALLENGES.rookie.bonus}€</span>
                </p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-black">{rookieSales}/{HYLA_CHALLENGES.rookie.target}</span>
                  <span className="text-sm font-bold opacity-90">{rookieDaysLeft}j restants</span>
                </div>
                <div className="h-3 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-card transition-all duration-700" style={{ width: `${rookiePct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Challenge detail popup ── */}
        <Dialog open={!!showChallenge} onOpenChange={(open) => { if (!open) setShowChallenge(null); }}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
            {showChallenge === 'countdown' && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-amber-600">
                    <Timer className="h-5 w-5" />
                    Compte à Rebours Online
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-amber-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-800 mb-2">Comment ça marche ?</p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      C'est un challenge de <span className="font-bold">{HYLA_CHALLENGES.countdown.months} mois</span> pour passer à l'action dès ton démarrage.
                      L'objectif est de réaliser <span className="font-bold">{HYLA_CHALLENGES.countdown.target} ventes</span> pendant cette période.
                      La <span className="font-bold">{HYLA_CHALLENGES.countdown.target}ème vente est sur-commissionnée à {HYLA_CHALLENGES.countdown.bonus}€</span> au lieu de la commission normale !
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Ta progression</p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-foreground">{countdownSales}/{HYLA_CHALLENGES.countdown.target} ventes</span>
                      <span className="text-sm font-bold text-amber-600">{countdownDaysLeft} jours restants</span>
                    </div>
                    <div className="h-3 rounded-full bg-amber-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all" style={{ width: `${countdownPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Début : {startDate.toLocaleDateString('fr-FR')}</span>
                      <span>Fin : {countdownEnd.toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                  {countdownSales >= HYLA_CHALLENGES.countdown.target ? (
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-sm font-bold text-green-700">Challenge réussi ! +{HYLA_CHALLENGES.countdown.bonus}€ débloqué</p>
                    </div>
                  ) : (
                    <div className="bg-muted rounded-xl p-3">
                      <p className="text-xs text-muted-foreground">
                        Il te reste <span className="font-bold">{HYLA_CHALLENGES.countdown.target - countdownSales} vente{HYLA_CHALLENGES.countdown.target - countdownSales > 1 ? 's' : ''}</span> à réaliser
                        en <span className="font-bold">{countdownDaysLeft} jours</span> pour décrocher le bonus de {HYLA_CHALLENGES.countdown.bonus}€.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
            {showChallenge === 'rookie' && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-violet-600">
                    <Trophy className="h-5 w-5" />
                    Rookie Online
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-violet-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-violet-800 mb-2">Comment ça marche ?</p>
                    <p className="text-xs text-violet-700 leading-relaxed">
                      Chaque recrue dispose de <span className="font-bold">{HYLA_CHALLENGES.rookie.months} mois</span> pour réaliser
                      <span className="font-bold"> {HYLA_CHALLENGES.rookie.target - 1} ventes</span> à partir de sa date de signature de contrat.
                      La <span className="font-bold">{HYLA_CHALLENGES.rookie.target}ème vente déclenche une super-commission de {HYLA_CHALLENGES.rookie.bonus}€</span>.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Ta progression</p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-foreground">{rookieSales}/{HYLA_CHALLENGES.rookie.target} ventes</span>
                      <span className="text-sm font-bold text-violet-600">{rookieDaysLeft} jours restants</span>
                    </div>
                    <div className="h-3 rounded-full bg-violet-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all" style={{ width: `${rookiePct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Début : {startDate.toLocaleDateString('fr-FR')}</span>
                      <span>Fin : {rookieEnd.toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                  <div className="bg-muted rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">
                      Il te reste <span className="font-bold">{HYLA_CHALLENGES.rookie.target - rookieSales} vente{HYLA_CHALLENGES.rookie.target - rookieSales > 1 ? 's' : ''}</span> à réaliser
                      en <span className="font-bold">{rookieDaysLeft} jours</span> pour décrocher le bonus de {HYLA_CHALLENGES.rookie.bonus}€.
                    </p>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── KPIs essentiels ── */}
        {kpisLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SkeletonKPI />
              <SkeletonKPI />
              <div className="sm:col-span-2"><SkeletonKPI /></div>
            </div>
            <SkeletonKPI />
          </div>
        ) : kpisError ? (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Impossible de charger les données</p>
            <p className="text-xs text-red-500 dark:text-red-500 mb-3">Une erreur est survenue. Vérifie ta connexion et réessaie.</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-semibold text-red-700 dark:text-red-400 underline"
            >
              Recharger la page
            </button>
          </div>
        ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
            {/* CA du mois */}
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border hover-lift animate-stagger-in">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">CA du mois</p>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <p className={`text-xl font-bold text-foreground transition-all ${!amountsVisible ? 'blur-sm select-none' : ''}`}>{fmtAmt(k.ca_mois || 0)} <span className="text-sm text-muted-foreground">€</span></p>
              {(k.commissions_annee || 0) > 0 && (
                <p className={`text-[9px] text-muted-foreground mt-1 transition-all ${!amountsVisible ? 'blur-sm select-none' : ''}`}>{fmtAmt(k.commissions_annee || 0)}€ cette année</p>
              )}
            </div>
            {/* Ventes */}
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border hover-lift animate-stagger-in">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Ventes</p>
                <ShoppingBag className="h-4 w-4 text-violet-500" />
              </div>
              <p className="text-xl font-bold text-foreground">{nbSignees}</p>
            </div>
            {/* Équipe */}
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border sm:col-span-2 hover-lift animate-stagger-in">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Équipe</p>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-xl font-bold text-foreground">{k.equipe_active || 0}</p>
            </div>
          </div>
          {/* Commissions — pleine largeur */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Commissions du mois</p>
              <Zap className="h-4 w-4 text-[#3b82f6]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                <p className="text-[9px] font-semibold text-amber-600 uppercase mb-1">Attendue</p>
                <p className={`text-lg font-bold text-amber-700 dark:text-amber-400 transition-all ${!amountsVisible ? 'blur-sm select-none' : ''}`}>
                  {fmtAmt(comAttendue)} <span className="text-xs font-normal">€</span>
                </p>
                <p className="text-[9px] text-amber-500 mt-0.5">Depuis vos saisies</p>
              </div>
              <div className={`rounded-xl p-3 border ${comConfirmee > 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-muted border-border'}`}>
                <p className={`text-[9px] font-semibold uppercase mb-1 ${comConfirmee > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>Confirmée</p>
                <p className={`text-lg font-bold transition-all ${comConfirmee > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'} ${!amountsVisible ? 'blur-sm select-none' : ''}`}>
                  {fmtAmt(comConfirmee)} <span className="text-xs font-normal">€</span>
                </p>
                <p className={`text-[9px] mt-0.5 ${comConfirmee > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  {comConfirmee > 0 ? 'Depuis import TRV' : 'Import TRV requis'}
                </p>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ── Objectifs du mois ── */}
        {hasObjectives && (
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-foreground">Mes objectifs du mois</p>
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {salesTarget > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">Ventes</span>
                    <span className={`text-[11px] font-bold ${objectifTextColor(salesPct)}`}>
                      {currentMonthSales}/{salesTarget}
                      {salesPct >= 100 && ' ✓'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${objectifBarColor(salesPct)}`}
                      style={{ width: `${salesPct}%` }}
                    />
                  </div>
                </div>
              )}
              {caTarget > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">CA</span>
                    <span className={`text-[11px] font-bold ${objectifTextColor(caPct)}`}>
                      {currentMonthCA.toLocaleString('fr-FR')} / {caTarget.toLocaleString('fr-FR')} €
                      {caPct >= 100 && ' ✓'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${objectifBarColor(caPct)}`}
                      style={{ width: `${caPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Formation progress */}
        {(totalLessons ?? 0) > 0 && (
          <a href="/formation" className="block bg-card rounded-2xl border shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Formation</p>
                  <p className="text-xs text-muted-foreground">{completedLessons ?? 0} / {totalLessons ?? 0} leçons</p>
                </div>
              </div>
              <span className="text-lg font-bold text-violet-600">
                {totalLessons ? Math.round(((completedLessons ?? 0) / totalLessons) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-violet-100 rounded-full h-2">
              <div
                className="bg-violet-500 h-2 rounded-full transition-all"
                style={{ width: `${totalLessons ? Math.min(100, Math.round(((completedLessons ?? 0) / totalLessons) * 100)) : 0}%` }}
              />
            </div>
          </a>
        )}

        {/* ── Challenge manager ── */}
        {myManagerChallenge && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5" />
              <span className="text-sm font-bold uppercase tracking-wide">Challenge en cours</span>
              {(() => {
                const daysLeft = Math.max(0, Math.ceil((new Date(myManagerChallenge.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                return <span className="ml-auto text-xs opacity-80">{daysLeft}j restant{daysLeft > 1 ? 's' : ''}</span>;
              })()}
            </div>
            <p className="font-bold text-base mb-0.5">{myManagerChallenge.title}</p>
            {myManagerChallenge.description && (
              <p className="text-xs opacity-80 mb-3">{myManagerChallenge.description}</p>
            )}
            {/* Progression */}
            {(() => {
              const prog = myChallengeProg || 0;
              const target = myManagerChallenge.target_value;
              const pct = Math.min(100, Math.round((prog / target) * 100));
              return (
                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-black">
                      {myManagerChallenge.objective_type === 'ca'
                        ? `${prog.toLocaleString('fr-FR')} €`
                        : prog}
                    </span>
                    <span className="text-sm opacity-80">
                      / {myManagerChallenge.objective_type === 'ca'
                        ? `${target.toLocaleString('fr-FR')} €`
                        : target}{' '}
                      {myManagerChallenge.objective_type === 'ventes' ? 'ventes' : myManagerChallenge.objective_type === 'ca' ? '' : 'recrues'}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {pct >= 100 && (
                    <p className="text-center text-sm font-bold bg-white/20 rounded-xl py-1.5">
                      🎉 Objectif atteint !
                    </p>
                  )}
                </div>
              );
            })()}
            {/* Récompense */}
            {myManagerChallenge.reward && (
              <p className="text-xs opacity-70 mt-3">🏆 {myManagerChallenge.reward}</p>
            )}
          </div>
        )}

        {/* ── Prochain niveau Hyla ── */}
        {nextLevel && (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Progression niveau</p>
                <p className="text-sm font-bold text-foreground mt-0.5 break-words">
                  {HYLA_LEVELS[myLevelIdx]?.label} → <span className="text-violet-600">{nextLevel.label}</span>
                </p>
              </div>
              <span className="text-sm font-bold text-violet-600 flex-shrink-0">{conditionsMet}/{conditionsTotal}</span>
            </div>

            {/* Barre de progression globale */}
            <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700"
                style={{ width: `${levelProgressPct}%` }}
              />
            </div>

            {/* Liste des conditions */}
            <div className="space-y-2">
              {nextLevelConditions.map((cond, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                      cond.met ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-muted'
                    }`}>
                      <span className={`text-[9px] font-bold ${cond.met ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {cond.met ? '✓' : '·'}
                      </span>
                    </div>
                    <span className={`text-xs truncate ${cond.met ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {cond.label}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold flex-shrink-0 ${cond.met ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {cond.detail}
                  </span>
                </div>
              ))}
            </div>

            {/* Note réunions */}
            <p className="text-[9px] text-muted-foreground mt-3 italic">
              ⚠ Présence aux réunions hebdomadaires et au meeting mensuel requise (non traçable automatiquement).
            </p>

            {/* CTA : toutes conditions remplies */}
            {conditionsMet === conditionsTotal && conditionsTotal > 0 ? (
              <div className="mt-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                  🎉 Vous remplissez toutes les conditions pour passer {nextLevel.label} !
                </p>
                <a
                  href="/parametres"
                  className="inline-block w-full text-center text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2 transition-colors"
                >
                  Passer au niveau supérieur →
                </a>
              </div>
            ) : (
              <div className="mt-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl p-3">
                <p className="text-[10px] text-violet-700 dark:text-violet-300">
                  <span className="font-bold">{nextLevel.label}</span> → <span className="font-bold">{nextLevel.recruteCommission}€</span> par vente de recrue directe
                  {nextLevel.quotaMois > 0 && <> + prime groupe dès {nextLevel.quotaMois} ventes/mois</>}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Guide de démarrage ── */}
        <GettingStartedWidget />


        {/* ── Chart Ventes mensuelles ── */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <h3 className="text-xs font-bold text-foreground mb-3">Ventes signées / mois</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="gradVentes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(value: number) => [`${value} vente${value > 1 ? 's' : ''}`, 'Signées']} />
              <Area type="monotone" dataKey="Ventes" stroke="#3b82f6" strokeWidth={2} fill="url(#gradVentes)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Prochaines tâches ── */}
        {tasksLoading ? (
          <SkeletonTable rows={4} />
        ) : (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground">Prochaines tâches</h3>
            <a href="/tasks" className="text-[10px] text-[#3b82f6] font-medium flex items-center gap-0.5">
              Voir tout <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="divide-y divide-border">
            {upcomingTasks && upcomingTasks.length > 0 ? upcomingTasks.slice(0, 4).map((task: any) => (
              <div key={task.id} className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  {task.contacts && (
                    <p className="text-[10px] text-muted-foreground">{task.contacts.first_name} {task.contacts.last_name}</p>
                  )}
                </div>
                {task.due_date && (
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg flex-shrink-0 ml-2 ${
                    new Date(task.due_date) < new Date() ? 'bg-red-50 text-red-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            )) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune tâche</div>
            )}
          </div>
        </div>
        )}
      </div>

      <OnboardingGuide />
    </AppLayout>
  );
}

