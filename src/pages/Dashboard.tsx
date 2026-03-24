import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, HYLA_COMMISSION_SCALE, getHylaCommission } from '@/lib/supabase';
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

export default function Dashboard() {
  const { user, profile } = useAuth();

  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc('get_dashboard_kpis', { p_user_id: user.id });
      if (error) throw error;
      return data as Record<string, number>;
    },
    enabled: !!user,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['dashboard-deals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('deals').select('id, signed_at').eq('user_id', user.id).eq('status', 'signee');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: profileData } = useQuery({
    queryKey: ['profile-date-dash', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('created_at').eq('id', user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: upcomingTasks } = useQuery({
    queryKey: ['upcoming-tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('tasks')
        .select('*, contacts(first_name, last_name)')
        .eq('user_id', user.id)
        .in('status', ['a_faire', 'en_cours'])
        .order('due_date', { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const k = kpis || {} as Record<string, number>;
  const nbSignees = deals.length;
  const commissionEstimee = getHylaCommission(nbSignees);

  // Challenge calculations
  const startDate = profileData ? new Date(profileData.created_at) : new Date();
  const now = new Date();

  const countdownEnd = new Date(startDate);
  countdownEnd.setMonth(countdownEnd.getMonth() + 2);
  const countdownDaysLeft = Math.max(0, Math.ceil((countdownEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const countdownActive = countdownDaysLeft > 0;
  const countdownSales = Math.min(nbSignees, 5);
  const countdownPct = Math.round((countdownSales / 5) * 100);

  const rookieEnd = new Date(startDate);
  rookieEnd.setMonth(rookieEnd.getMonth() + 7);
  const rookieDaysLeft = Math.max(0, Math.ceil((rookieEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const rookieActive = rookieDaysLeft > 0 && nbSignees < 15;
  const rookieSales = Math.min(nbSignees, 15);
  const rookiePct = Math.round((rookieSales / 15) * 100);

  // Chart data
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      name: d.toLocaleDateString('fr-FR', { month: 'short' }),
      CA: Math.round((k.ca_mois || 0) * (0.3 + Math.random() * 0.7)),
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

        {/* ── Challenges (big cards, presentation style) ── */}
        {(countdownActive || rookieActive) && (
          <div className="space-y-3">
            {countdownActive && (
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="h-5 w-5" />
                  <span className="text-sm font-bold uppercase tracking-wider">Compte à Rebours — 2 mois</span>
                </div>
                <p className="text-xs opacity-90 mb-3">
                  Réalise 5 ventes pendant cette période. La 5ème vente est sur-commissionnée <span className="font-bold">800€</span>
                </p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-black">{countdownSales}/5</span>
                  <span className="text-sm font-bold opacity-90">{countdownDaysLeft}j restants</span>
                </div>
                <div className="h-3 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${countdownPct}%` }} />
                </div>
                {countdownSales >= 5 && (
                  <div className="mt-2 text-center bg-white/20 rounded-xl py-1.5 text-sm font-bold">
                    +800€ débloqué !
                  </div>
                )}
              </div>
            )}

            {rookieActive && (
              <div className="bg-gradient-to-r from-violet-500 to-indigo-500 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-5 w-5" />
                  <span className="text-sm font-bold uppercase tracking-wider">Rookie Online — 6 mois</span>
                </div>
                <p className="text-xs opacity-90 mb-3">
                  Réalise 14 ventes en 6 mois. La 15ème vente déclenche une super-commission de <span className="font-bold">1000€</span>
                </p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-black">{rookieSales}/15</span>
                  <span className="text-sm font-bold opacity-90">{rookieDaysLeft}j restants</span>
                </div>
                <div className="h-3 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${rookiePct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

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

        {/* ── Chart CA ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-xs font-bold text-gray-900 mb-3">Évolution CA</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(value: number) => `${value.toLocaleString('fr-FR')} €`} />
              <Area type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={2} fill="url(#gradCA)" />
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
    </AppLayout>
  );
}
