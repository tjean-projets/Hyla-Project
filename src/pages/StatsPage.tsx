import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { useAmounts } from '@/contexts/AmountsContext';
import { usePlan } from '@/hooks/usePlan';
import { PaywallScreen } from '@/components/PaywallScreen';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ArrowUp, ArrowDown, Trophy, XCircle, TrendingDown, Users, CalendarCheck, ShoppingBag, UserCheck } from 'lucide-react';
import { SkeletonKPI, SkeletonChart } from '@/components/ui/skeleton-card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

/* Tooltip propre utilisé sur tous les charts */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[120px]">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
            <span className="text-gray-500 dark:text-gray-400">{entry.name}</span>
          </div>
          <span className="font-bold text-gray-800 dark:text-gray-100">
            {typeof entry.value === 'number' ? `${entry.value.toLocaleString('fr-FR')} €` : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const effectiveId = useEffectiveUserId();
  const { visible: amountsVisible } = useAmounts();
  const fmtAmt = (n: number) => amountsVisible ? n.toLocaleString('fr-FR') : '•••';
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());

  const { data: commissions = [], isLoading: commissionsLoading } = useQuery({
    queryKey: ['stats-commissions', effectiveId, selectedYear],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('commissions')
        .select('*, team_members(first_name, last_name)')
        .eq('user_id', effectiveId)
        .eq('status', 'validee')
        .gte('period', `${selectedYear}-01`)
        .lte('period', `${selectedYear}-12`)
        .order('period');
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['stats-members', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('team_members').select('*').eq('user_id', effectiveId);
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['stats-contacts', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('contacts').select('id, status, created_at').eq('user_id', effectiveId);
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['stats-deals', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('deals').select('id, status, created_at').eq('user_id', effectiveId);
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: rdvTasks = [] } = useQuery({
    queryKey: ['stats-rdv', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('tasks').select('id, type, status').eq('user_id', effectiveId).eq('type', 'rdv');
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: lostDeals = [] } = useQuery({
    queryKey: ['lost-deals', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('deals')
        .select('loss_reason_category, loss_reason, amount, created_at')
        .eq('user_id', effectiveId)
        .eq('status', 'annulee')
        .not('loss_reason_category', 'is', null);
      return data || [];
    },
    enabled: !!effectiveId,
  });

  // ── Calculations ──
  const totalCA = commissions.reduce((s: number, c: any) => s + c.amount, 0);
  const totalDirecte = commissions.filter((c: any) => c.type === 'directe').reduce((s: number, c: any) => s + c.amount, 0);
  const totalReseau = commissions.filter((c: any) => c.type === 'reseau').reduce((s: number, c: any) => s + c.amount, 0);

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const period = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
    const directe = commissions.filter((c: any) => c.period === period && c.type === 'directe').reduce((s: number, c: any) => s + c.amount, 0);
    const reseau = commissions.filter((c: any) => c.period === period && c.type === 'reseau').reduce((s: number, c: any) => s + c.amount, 0);
    return { name: MONTHS_FR[i], Directe: directe, Réseau: reseau, Total: directe + reseau };
  });

  const currentMonth = `${selectedYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonth = `${now.getMonth() === 0 ? parseInt(selectedYear) - 1 : selectedYear}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0')}`;
  const currentMonthCA = commissions.filter((c: any) => c.period === currentMonth).reduce((s: number, c: any) => s + c.amount, 0);
  const prevMonthCA = commissions.filter((c: any) => c.period === prevMonth).reduce((s: number, c: any) => s + c.amount, 0);
  const monthGrowth = prevMonthCA > 0 ? Math.round(((currentMonthCA - prevMonthCA) / prevMonthCA) * 100) : 0;

  const byMember = commissions
    .filter((c: any) => c.type === 'reseau' && c.team_member_id && c.team_members)
    .reduce((acc: Record<string, { name: string; total: number; count: number }>, c: any) => {
      const key = c.team_member_id;
      if (!acc[key]) acc[key] = { name: `${c.team_members.first_name} ${c.team_members.last_name}`, total: 0, count: 0 };
      acc[key].total += c.amount;
      acc[key].count += 1;
      return acc;
    }, {});
  const topPerformers = Object.values(byMember).sort((a: any, b: any) => b.total - a.total);

  const pieData = [
    { name: 'Directe', value: totalDirecte },
    { name: 'Réseau', value: totalReseau },
  ].filter(d => d.value > 0);

  const memberGrowth = Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(parseInt(selectedYear), i, 1);
    const monthEnd = new Date(parseInt(selectedYear), i + 1, 0);
    const joined = members.filter((m: any) => {
      if (!m.joined_at) return false;
      const d = new Date(m.joined_at);
      return d >= monthStart && d <= monthEnd;
    }).length;
    return { name: MONTHS_FR[i], Membres: joined };
  });

  const totalContacts = contacts.length;
  const recrues = contacts.filter((c: any) => c.status === 'recrue').length;
  const conversionRate = totalContacts > 0 ? Math.round((recrues / totalContacts) * 100) : 0;

  // ── Entonnoir de conversion ──
  const totalDeals = deals.length;
  const signedDeals = deals.filter((d: any) => d.status === 'signee' || d.status === 'livree').length;
  const rdvDone = rdvTasks.filter((t: any) => t.status === 'terminee').length;
  const rdvTotal = rdvTasks.length;
  const funnelSteps = [
    { label: 'Contacts créés', value: totalContacts, icon: Users, color: 'bg-blue-500', light: 'bg-blue-50 text-blue-700' },
    { label: 'Prospects actifs', value: contacts.filter((c: any) => c.status === 'prospect').length, icon: UserCheck, color: 'bg-indigo-500', light: 'bg-indigo-50 text-indigo-700' },
    { label: 'RDV effectués', value: rdvDone, icon: CalendarCheck, color: 'bg-violet-500', light: 'bg-violet-50 text-violet-700' },
    { label: 'Ventes créées', value: totalDeals, icon: ShoppingBag, color: 'bg-amber-500', light: 'bg-amber-50 text-amber-700' },
    { label: 'Ventes signées', value: signedDeals, icon: TrendingDown, color: 'bg-green-500', light: 'bg-green-50 text-green-700' },
  ];

  const lossReasonLabels: Record<string, string> = {
    prix: '💰 Prix trop élevé',
    concurrent: '🏢 Concurrence',
    pas_interesse: '❌ Pas intéressé',
    pas_de_reponse: '📵 Plus de réponse',
    besoin_reflechi: '🤔 En réflexion',
    autre: '💬 Autre',
  };

  const lossByReason = lostDeals.reduce((acc: Record<string, number>, d: any) => {
    const cat = d.loss_reason_category || 'autre';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const lossStats = Object.entries(lossByReason)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ label: lossReasonLabels[key] || key, count, pct: Math.round((count / lostDeals.length) * 100) }));

  const { canAccess, isTrial, trialDaysLeft } = usePlan();

  if (!canAccess.stats) {
    return (
      <AppLayout title="Statistiques">
        <PaywallScreen feature="stats" isTrial={isTrial} trialDaysLeft={trialDaysLeft} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Statistiques">
      <div className="space-y-5">

        {/* ── Year selector ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#3b82f6]" />
            <span className="text-sm font-bold text-foreground">Statistiques {selectedYear}</span>
          </div>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
              <option key={y} value={y.toString()}>{y}</option>
            ))}
          </select>
        </div>

        {/* ── Hero KPIs ── */}
        {commissionsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SkeletonKPI />
            <SkeletonKPI />
            <SkeletonKPI />
            <SkeletonKPI />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">CA Total</p>
              <p className={`text-xl font-bold text-foreground mt-1 transition-all ${!amountsVisible ? 'blur-sm select-none' : ''}`}>{fmtAmt(totalCA)}€</p>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Ce mois</p>
              <p className={`text-xl font-bold text-foreground mt-1 transition-all ${!amountsVisible ? 'blur-sm select-none' : ''}`}>{fmtAmt(currentMonthCA)}€</p>
              {monthGrowth !== 0 && (
                <div className={`flex items-center gap-1 mt-1 text-[10px] font-semibold ${monthGrowth > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {monthGrowth > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(monthGrowth)}% vs mois dernier
                </div>
              )}
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Équipe</p>
              <p className="text-xl font-bold text-foreground mt-1">{members.length}</p>
              <p className="text-[10px] text-muted-foreground">{members.filter((m: any) => m.status === 'actif').length} actifs</p>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Conversion</p>
              <p className="text-xl font-bold text-foreground mt-1">{conversionRate}%</p>
              <p className="text-[10px] text-muted-foreground">{recrues}/{totalContacts} contacts</p>
            </div>
          </div>
        )}

        {/* ── Entonnoir de conversion ── */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Entonnoir de conversion</h3>
          <div className="space-y-2">
            {funnelSteps.map((step, i) => {
              const maxVal = funnelSteps[0].value || 1;
              const pct = Math.round((step.value / maxVal) * 100);
              const convPct = i > 0 && funnelSteps[i - 1].value > 0
                ? Math.round((step.value / funnelSteps[i - 1].value) * 100)
                : null;
              const Icon = step.icon;
              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-6 w-6 rounded-lg ${step.color} flex items-center justify-center`}>
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{step.label}</span>
                      {convPct !== null && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${step.light}`}>
                          {convPct}% conv.
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-foreground">{step.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${step.color} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CA Evolution chart ── */}
        {commissionsLoading ? (
          <SkeletonChart />
        ) : (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">Évolution du CA</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="Directe" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="Réseau" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Split Directe vs Réseau ── */}
        {pieData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">Répartition</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={4}>
                    {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#3b82f6' : '#f59e0b'} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
                  <span className={`text-muted-foreground transition-all ${!amountsVisible ? 'blur-sm select-none' : ''}`}>Directe {fmtAmt(totalDirecte)}€</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                  <span className={`text-muted-foreground transition-all ${!amountsVisible ? 'blur-sm select-none' : ''}`}>Réseau {fmtAmt(totalReseau)}€</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">Croissance réseau</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={memberGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.06)' }} />
                  <Line type="monotone" dataKey="Membres" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Top Performers ── */}
        {topPerformers.length > 0 && (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <h3 className="text-sm font-bold text-foreground">Top performers réseau</h3>
            </div>
            <div className="space-y-3">
              {topPerformers.slice(0, 10).map((m: any, i: number) => {
                const maxVal = (topPerformers[0] as any)?.total || 1;
                const pct = Math.round((m.total / maxVal) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-6 text-center ${
                      i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{m.name}</span>
                        <span className={`text-sm font-bold text-foreground transition-all ${!amountsVisible ? 'blur-sm select-none' : ''}`}>{fmtAmt(m.total)} €</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{m.count} commission{m.count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* ── Raisons d'annulation ── */}
        {lostDeals.length > 0 && (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-5 w-5 text-red-500" />
              <h3 className="text-sm font-bold text-foreground">Raisons d'annulation</h3>
            </div>
            <p className="text-[10px] text-muted-foreground mb-4">{lostDeals.length} vente{lostDeals.length > 1 ? 's' : ''} annulée{lostDeals.length > 1 ? 's' : ''} avec raison renseignée</p>
            <div className="space-y-3">
              {lossStats.map((stat, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{stat.label}</span>
                    <span className="text-muted-foreground font-semibold">{stat.count} ({stat.pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div style={{ width: `${stat.pct}%` }} className="h-2 bg-red-400 rounded-full transition-all duration-700" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
