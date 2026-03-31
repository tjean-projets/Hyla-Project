import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ArrowUp, ArrowDown, Trophy } from 'lucide-react';
import { SkeletonKPI, SkeletonChart } from '@/components/ui/skeleton-card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

export default function StatsPage() {
  const effectiveId = useEffectiveUserId();
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
  const prevMonth = `${now.getMonth() === 0 ? parseInt(selectedYear) - 1 : selectedYear}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '00')}`;
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
  const recrues = contacts.filter((c: any) => c.status === 'recrue' || c.status === 'partenaire').length;
  const conversionRate = totalContacts > 0 ? Math.round((recrues / totalContacts) * 100) : 0;

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
              <p className="text-xl font-bold text-foreground mt-1">{totalCA.toLocaleString('fr-FR')}€</p>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Ce mois</p>
              <p className="text-xl font-bold text-foreground mt-1">{currentMonthCA.toLocaleString('fr-FR')}€</p>
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
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--foreground)' }}
                  formatter={(value: number) => `${value.toLocaleString('fr-FR')} €`}
                />
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
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--foreground)' }}
                    formatter={(value: number) => `${value.toLocaleString('fr-FR')} €`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
                  <span className="text-muted-foreground">Directe {totalDirecte.toLocaleString('fr-FR')}€</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="text-muted-foreground">Réseau {totalReseau.toLocaleString('fr-FR')}€</span>
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
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--foreground)' }}
                  />
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
                        <span className="text-sm font-bold text-foreground">{m.total.toLocaleString('fr-FR')} €</span>
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
      </div>
    </AppLayout>
  );
}
