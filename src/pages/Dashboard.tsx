import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  ShoppingBag,
  CalendarCheck,
  Eye,
  Target,
  Users,
  UserPlus,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

/* ── Mockup 2 style: colored KPI cards with metrics ── */
function MetricCard({
  label,
  value,
  suffix = '',
  icon: Icon,
  color,
  bgColor,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
          <p className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
            {suffix && <span className="text-base font-semibold text-gray-400 ml-1">{suffix}</span>}
          </p>
        </div>
        <div className={`h-11 w-11 rounded-2xl ${bgColor} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

/* ── Colored circle metric (like Real Time Air Quality in mockup 2) ── */
function CircleMetric({ label, value, suffix, ringColor }: { label: string; value: number; suffix: string; ringColor: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`h-16 w-16 rounded-full border-[3px] ${ringColor} flex items-center justify-center`}>
        <span className="text-lg font-bold text-gray-900">{value.toLocaleString('fr-FR')}</span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{suffix}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

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

  const { data: upcomingAppointments } = useQuery({
    queryKey: ['upcoming-appointments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('appointments')
        .select('*, contacts(first_name, last_name)')
        .eq('user_id', user.id)
        .eq('status', 'planifie')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const k = kpis || {} as Record<string, number>;
  const tauxTransfo = k.ventes_signees && k.demos_realisees
    ? Math.round((k.ventes_signees / k.demos_realisees) * 100)
    : 0;
  const commissionTotal = (k.commissions_mois_directe || 0) + (k.commissions_mois_reseau || 0);

  // Monthly dummy chart data (will be real when DB is connected)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      name: d.toLocaleDateString('fr-FR', { month: 'short' }),
      CA: Math.round((k.ca_mois || 0) * (0.3 + Math.random() * 0.7)),
      Commissions: Math.round(commissionTotal * (0.3 + Math.random() * 0.7)),
    };
  });

  const commissionPieData = [
    { name: 'Directes', value: k.commissions_mois_directe || 0, color: '#3b82f6' },
    { name: 'Réseau', value: k.commissions_mois_reseau || 0, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const now = new Date();
  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* ── Period + subtitle (mockup 2: filters row) ── */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 capitalize">{monthLabel}</p>
          <div className="flex gap-2">
            {['Mois', 'Trimestre', 'Année'].map((p) => (
              <button key={p} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${p === 'Mois' ? 'bg-[#3b82f6] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Row 1: CA & performance ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="CA du mois" value={k.ca_mois || 0} suffix="€" icon={TrendingUp} color="text-emerald-600" bgColor="bg-emerald-50" />
          <MetricCard label="CA de l'année" value={k.ca_annee || 0} suffix="€" icon={TrendingUp} color="text-blue-600" bgColor="bg-blue-50" />
          <MetricCard label="Ventes signées" value={k.ventes_signees || 0} icon={ShoppingBag} color="text-violet-600" bgColor="bg-violet-50" />
          <MetricCard label="Taux transfo" value={tauxTransfo} suffix="%" icon={Target} color="text-amber-600" bgColor="bg-amber-50" />
        </div>

        {/* ── KPI Row 2: Activity ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="RDV pris" value={k.rdv_pris || 0} icon={CalendarCheck} color="text-purple-600" bgColor="bg-purple-50" />
          <MetricCard label="Démos réalisées" value={k.demos_realisees || 0} icon={Eye} color="text-pink-600" bgColor="bg-pink-50" />
          <MetricCard label="Équipe active" value={k.equipe_active || 0} icon={Users} color="text-blue-600" bgColor="bg-blue-50" />
          <MetricCard label="Nouvelles recrues" value={k.nouvelles_recrues || 0} icon={UserPlus} color="text-rose-600" bgColor="bg-rose-50" />
        </div>

        {/* ── Chart + Commission circle (mockup 2: Filtration Efficiency + Real Time metrics) ── */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Line chart (2/3 width) */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Évolution CA & Commissions</h3>
              <span className="text-[11px] text-gray-400 font-medium">6 derniers mois</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  formatter={(value: number) => `${value.toLocaleString('fr-FR')} €`}
                />
                <Area type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradCA)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                <Area type="monotone" dataKey="Commissions" stroke="#f59e0b" strokeWidth={2} fill="transparent" strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Commission summary (1/3 - mockup 2 Real Time metrics style) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-5">Commissions du mois</h3>
            <div className="text-center mb-6">
              <p className="text-3xl font-bold text-gray-900">{commissionTotal.toLocaleString('fr-FR')} €</p>
              <p className="text-xs text-gray-400 mt-1">Total commissions</p>
            </div>
            <div className="flex justify-center gap-6">
              <CircleMetric label="Directes" value={k.commissions_mois_directe || 0} suffix="€" ringColor="border-blue-400" />
              <CircleMetric label="Réseau" value={k.commissions_mois_reseau || 0} suffix="€" ringColor="border-amber-400" />
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">Commissions annuelles</p>
              <p className="text-lg font-bold text-gray-900">{(k.commissions_annee || 0).toLocaleString('fr-FR')} €</p>
            </div>
          </div>
        </div>

        {/* ── Bottom row: Tasks + Appointments (card list style) ── */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Tasks */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Prochaines tâches</h3>
              <a href="/tasks" className="text-xs text-[#3b82f6] font-medium flex items-center gap-0.5 hover:underline">
                Voir tout <ChevronRight className="h-3 w-3" />
              </a>
            </div>
            <div className="divide-y divide-gray-50">
              {upcomingTasks && upcomingTasks.length > 0 ? upcomingTasks.map((task: any) => (
                <div key={task.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{task.title}</p>
                    {task.contacts && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{task.contacts.first_name} {task.contacts.last_name}</p>
                    )}
                  </div>
                  {task.due_date && (
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                      new Date(task.due_date) < new Date() ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              )) : (
                <div className="px-6 py-8 text-center text-sm text-gray-400">Aucune tâche à venir</div>
              )}
            </div>
          </div>

          {/* Appointments */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Prochains RDV</h3>
              <a href="/calendar" className="text-xs text-[#3b82f6] font-medium flex items-center gap-0.5 hover:underline">
                Voir tout <ChevronRight className="h-3 w-3" />
              </a>
            </div>
            <div className="divide-y divide-gray-50">
              {upcomingAppointments && upcomingAppointments.length > 0 ? upcomingAppointments.map((apt: any) => (
                <div key={apt.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[44px] py-1 rounded-xl bg-blue-50">
                      <p className="text-xs font-bold text-[#3b82f6]">
                        {new Date(apt.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{apt.title}</p>
                      {apt.contacts && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{apt.contacts.first_name} {apt.contacts.last_name}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${
                    apt.status === 'planifie' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {apt.status === 'planifie' ? 'Confirmé' : apt.status}
                  </span>
                </div>
              )) : (
                <div className="px-6 py-8 text-center text-sm text-gray-400">Aucun rendez-vous à venir</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
