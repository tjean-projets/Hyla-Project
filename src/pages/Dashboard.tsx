import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, HYLA_COMMISSION_SCALE, HYLA_CHALLENGES, getHylaCommission } from '@/lib/supabase';
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
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import OnboardingGuide from '@/components/OnboardingGuide';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const effectiveId = useEffectiveUserId();
  const [showChallenge, setShowChallenge] = useState<'countdown' | 'rookie' | null>(null);

  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data, error } = await supabase.rpc('get_dashboard_kpis', { p_user_id: effectiveId });
      if (error) throw error;
      return data as Record<string, number>;
    },
    enabled: !!effectiveId,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['dashboard-deals', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('deals').select('id, signed_at').eq('user_id', effectiveId).eq('status', 'signee');
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: profileData } = useQuery({
    queryKey: ['profile-date-dash', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data } = await supabase.from('profiles').select('created_at').eq('id', effectiveId).single();
      return data;
    },
    enabled: !!effectiveId,
  });

  const { data: upcomingTasks } = useQuery({
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
  });

  const k = kpis || {} as Record<string, number>;
  const nbSignees = deals.length;
  const commissionEstimee = getHylaCommission(nbSignees);

  // Challenge calculations (centralisé via HYLA_CHALLENGES)
  const startDate = profileData ? new Date(profileData.created_at) : new Date();
  const now = new Date();

  const countdownEnd = new Date(startDate);
  countdownEnd.setMonth(countdownEnd.getMonth() + HYLA_CHALLENGES.countdown.months);
  const countdownDaysLeft = Math.max(0, Math.ceil((countdownEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const countdownActive = countdownDaysLeft > 0;
  const countdownSales = Math.min(nbSignees, HYLA_CHALLENGES.countdown.target);
  const countdownPct = Math.round((countdownSales / HYLA_CHALLENGES.countdown.target) * 100);

  const rookieEnd = new Date(startDate);
  rookieEnd.setMonth(rookieEnd.getMonth() + HYLA_CHALLENGES.rookie.months);
  const rookieDaysLeft = Math.max(0, Math.ceil((rookieEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const rookieActive = rookieDaysLeft > 0 && nbSignees < HYLA_CHALLENGES.rookie.target;
  const rookieSales = Math.min(nbSignees, HYLA_CHALLENGES.rookie.target);
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

  const firstName = profile?.full_name?.split(' ')[0] || 'Partenaire';

  return (
    <AppLayout title="Dashboard" hideBanner>
      <div className="space-y-5">
        {/* ── Greeting ── */}
        <div>
          <h2 className="text-lg font-bold text-gray-900">Bonjour {firstName} !</h2>
          <p className="text-xs text-gray-400 capitalize">{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
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
                  <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${countdownPct}%` }} />
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
                  <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${rookiePct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Challenge detail popup ── */}
        <Dialog open={!!showChallenge} onOpenChange={(open) => { if (!open) setShowChallenge(null); }}>
          <DialogContent className="max-w-md">
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
                    <p className="text-xs font-semibold text-gray-500 uppercase">Ta progression</p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-gray-900">{countdownSales}/{HYLA_CHALLENGES.countdown.target} ventes</span>
                      <span className="text-sm font-bold text-amber-600">{countdownDaysLeft} jours restants</span>
                    </div>
                    <div className="h-3 rounded-full bg-amber-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all" style={{ width: `${countdownPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Début : {startDate.toLocaleDateString('fr-FR')}</span>
                      <span>Fin : {countdownEnd.toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                  {countdownSales >= HYLA_CHALLENGES.countdown.target ? (
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-sm font-bold text-green-700">Challenge réussi ! +{HYLA_CHALLENGES.countdown.bonus}€ débloqué</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-600">
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
                    <p className="text-xs font-semibold text-gray-500 uppercase">Ta progression</p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-gray-900">{rookieSales}/{HYLA_CHALLENGES.rookie.target} ventes</span>
                      <span className="text-sm font-bold text-violet-600">{rookieDaysLeft} jours restants</span>
                    </div>
                    <div className="h-3 rounded-full bg-violet-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all" style={{ width: `${rookiePct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Début : {startDate.toLocaleDateString('fr-FR')}</span>
                      <span>Fin : {rookieEnd.toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600">
                      Il te reste <span className="font-bold">{HYLA_CHALLENGES.rookie.target - rookieSales} vente{HYLA_CHALLENGES.rookie.target - rookieSales > 1 ? 's' : ''}</span> à réaliser
                      en <span className="font-bold">{rookieDaysLeft} jours</span> pour décrocher le bonus de {HYLA_CHALLENGES.rookie.bonus}€.
                    </p>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── KPIs essentiels (4 cards) ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase text-gray-400">CA du mois</p>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">{(k.ca_mois || 0).toLocaleString('fr-FR')} <span className="text-sm text-gray-400">€</span></p>
          </div>
          <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase opacity-80">Commission</p>
              <Zap className="h-4 w-4 opacity-80" />
            </div>
            <p className="text-xl font-bold">{commissionEstimee.toLocaleString('fr-FR')} <span className="text-sm opacity-70">€</span></p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase text-gray-400">Ventes</p>
              <ShoppingBag className="h-4 w-4 text-violet-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">{nbSignees}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase text-gray-400">Équipe</p>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">{k.equipe_active || 0}</p>
          </div>
        </div>

        {/* ── Barème rapide ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-900">Barème ventes</p>
            <Target className="h-3.5 w-3.5 text-gray-400" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {HYLA_COMMISSION_SCALE.map((s, i) => (
              <div key={i} className={`flex-shrink-0 text-center px-2.5 py-1.5 rounded-lg text-[10px] font-medium border ${
                nbSignees >= s.machines ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-400'
              }`}>
                <div className="font-bold text-xs">{s.commission}€</div>
                <div>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chart Ventes mensuelles ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-xs font-bold text-gray-900 mb-3">Ventes signées / mois</h3>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900">Prochaines tâches</h3>
            <a href="/tasks" className="text-[10px] text-[#3b82f6] font-medium flex items-center gap-0.5">
              Voir tout <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="divide-y divide-gray-50">
            {upcomingTasks && upcomingTasks.length > 0 ? upcomingTasks.slice(0, 4).map((task: any) => (
              <div key={task.id} className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                  {task.contacts && (
                    <p className="text-[10px] text-gray-400">{task.contacts.first_name} {task.contacts.last_name}</p>
                  )}
                </div>
                {task.due_date && (
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg flex-shrink-0 ml-2 ${
                    new Date(task.due_date) < new Date() ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            )) : (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Aucune tâche</div>
            )}
          </div>
        </div>
      </div>

      <OnboardingGuide />
    </AppLayout>
  );
}
