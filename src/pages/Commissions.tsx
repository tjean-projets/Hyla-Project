import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase, COMMISSION_TYPE_LABELS } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Zap, Trophy, Star, ArrowUp, DollarSign } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Commissions() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());

  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions', effectiveId, selectedYear],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('commissions')
        .select('*, team_members(first_name, last_name)')
        .eq('user_id', effectiveId)
        .gte('period', `${selectedYear}-01`)
        .lte('period', `${selectedYear}-12`)
        .order('period', { ascending: false });
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const totalDirecte = commissions.filter((c: any) => c.type === 'directe' && c.status === 'validee').reduce((s: number, c: any) => s + c.amount, 0);
  const totalReseau = commissions.filter((c: any) => c.type === 'reseau' && c.status === 'validee').reduce((s: number, c: any) => s + c.amount, 0);
  const total = totalDirecte + totalReseau;

  const months = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    const period = `${selectedYear}-${month}`;
    const directe = commissions
      .filter((c: any) => c.period === period && c.type === 'directe' && c.status === 'validee')
      .reduce((s: number, c: any) => s + c.amount, 0);
    const reseau = commissions
      .filter((c: any) => c.period === period && c.type === 'reseau' && c.status === 'validee')
      .reduce((s: number, c: any) => s + c.amount, 0);
    return {
      name: new Date(parseInt(selectedYear), i).toLocaleDateString('fr-FR', { month: 'short' }),
      Directes: directe,
      Réseau: reseau,
    };
  });

  const byMember = commissions
    .filter((c: any) => c.type === 'reseau' && c.status === 'validee' && c.team_members)
    .reduce((acc: Record<string, { name: string; total: number }>, c: any) => {
      const key = c.team_member_id;
      if (!acc[key]) acc[key] = { name: `${c.team_members.first_name} ${c.team_members.last_name}`, total: 0 };
      acc[key].total += c.amount;
      return acc;
    }, {});

  const memberList = Object.values(byMember).sort((a: any, b: any) => b.total - a.total);

  return (
    <AppLayout title="Commissions" variant="dark">
      <div className="space-y-6">
        {/* ── Year selector ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#3b82f6]" />
            <span className="text-sm font-bold text-white">Année {selectedYear}</span>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px] bg-white/[0.06] border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Hero total (glassmorphism) ── */}
        <div className="bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/10 backdrop-blur-xl rounded-2xl border border-[#3b82f6]/20 p-6 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Total commissions</p>
          <p className="text-4xl font-bold text-white">{total.toLocaleString('fr-FR')} <span className="text-xl text-gray-400">€</span></p>
          <div className="flex justify-center gap-8 mt-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="h-2 w-2 rounded-full bg-[#3b82f6]" />
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Directes</span>
              </div>
              <p className="text-lg font-bold text-white">{totalDirecte.toLocaleString('fr-FR')} €</p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Réseau</span>
              </div>
              <p className="text-lg font-bold text-white">{totalReseau.toLocaleString('fr-FR')} €</p>
            </div>
          </div>
        </div>

        {/* ── Chart (dark style) ── */}
        <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-sm font-bold text-white mb-4">Évolution mensuelle</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={months}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
                formatter={(value: number) => `${value.toLocaleString('fr-FR')} €`}
              />
              <Bar dataKey="Directes" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Réseau" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Top contributeurs (leaderboard style, mockup 3) ── */}
        {memberList.length > 0 && (
          <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Trophy className="h-5 w-5 text-yellow-400" />
              <h3 className="text-sm font-bold text-white">Top contributeurs réseau</h3>
            </div>
            <div className="space-y-2">
              {memberList.slice(0, 10).map((m: any, i: number) => {
                const maxVal = (memberList[0] as any).total || 1;
                const pct = Math.round((m.total / maxVal) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-6 text-center ${
                      i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600'
                    }`}>
                      {i < 3 ? <Star className="h-4 w-4 fill-current inline" /> : i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{m.name}</span>
                        <span className="text-sm font-bold text-white">{m.total.toLocaleString('fr-FR')} €</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Commission detail table (dark) ── */}
        <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Période</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Type</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hidden md:table-cell">Membre</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Montant</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {commissions.slice(0, 50).map((c: any) => (
                <tr key={c.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-3.5 text-gray-300">{c.period}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold ${
                      c.type === 'directe'
                        ? 'bg-[#3b82f6]/15 text-blue-400 border border-[#3b82f6]/20'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    }`}>
                      {COMMISSION_TYPE_LABELS[c.type as keyof typeof COMMISSION_TYPE_LABELS]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">
                    {c.team_members ? `${c.team_members.first_name} ${c.team_members.last_name}` : 'Moi'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-white">{c.amount.toLocaleString('fr-FR')} €</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold ${
                      c.status === 'validee'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : c.status === 'en_attente'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                        : 'bg-white/5 text-gray-500 border border-white/10'
                    }`}>
                      {c.status === 'validee' ? 'Validée' : c.status === 'en_attente' ? 'En attente' : c.status}
                    </span>
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-16 text-center text-gray-600">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-gray-700" />
                  Aucune commission
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
