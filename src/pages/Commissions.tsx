import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase, COMMISSION_TYPE_LABELS } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Zap, Trophy, Star, ArrowUp, DollarSign, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Commissions() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [view, setView] = useState<'perso' | 'equipe'>('perso');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

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

  // ── Team members for "Équipe" view ──
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-commissions', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('team_members').select('id, first_name, last_name, status, level, email').eq('user_id', effectiveId);
      return data || [];
    },
    enabled: !!effectiveId,
  });

  // Commissions réseau groupées par membre et par mois
  const teamCommissions = commissions.filter((c: any) => c.type === 'reseau' && c.status === 'validee' && c.team_member_id);

  const teamSummary = teamMembers.map((m: any) => {
    const memberComms = teamCommissions.filter((c: any) => c.team_member_id === m.id);
    const totalYear = memberComms.reduce((s: number, c: any) => s + c.amount, 0);
    const currentMonth = `${selectedYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const totalMonth = memberComms.filter((c: any) => c.period === currentMonth).reduce((s: number, c: any) => s + c.amount, 0);
    return { ...m, totalYear, totalMonth, commissions: memberComms };
  }).sort((a: any, b: any) => b.totalYear - a.totalYear);

  const teamTotalYear = teamSummary.reduce((s: number, m: any) => s + m.totalYear, 0);
  const teamTotalMonth = teamSummary.reduce((s: number, m: any) => s + m.totalMonth, 0);

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

        {/* ── View toggle: Perso / Équipe ── */}
        <div className="flex gap-1 bg-white/[0.06] rounded-xl p-1 border border-white/10">
          <button
            onClick={() => setView('perso')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              view === 'perso' ? 'bg-[#3b82f6] text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <DollarSign className="h-4 w-4" /> Mes commissions
          </button>
          <button
            onClick={() => setView('equipe')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              view === 'equipe' ? 'bg-[#3b82f6] text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="h-4 w-4" /> Mon équipe
          </button>
        </div>

        {/* ── ÉQUIPE VIEW ── */}
        {view === 'equipe' ? (
          <div className="space-y-4">
            {/* Team KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-violet-500/15 to-indigo-500/10 backdrop-blur-xl rounded-2xl border border-violet-500/20 p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Réseau {selectedYear}</p>
                <p className="text-2xl font-bold text-white">{teamTotalYear.toLocaleString('fr-FR')} <span className="text-sm text-gray-400">€</span></p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/15 to-green-500/10 backdrop-blur-xl rounded-2xl border border-emerald-500/20 p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Ce mois</p>
                <p className="text-2xl font-bold text-white">{teamTotalMonth.toLocaleString('fr-FR')} <span className="text-sm text-gray-400">€</span></p>
              </div>
            </div>

            {/* Members list */}
            <div className="space-y-2">
              {teamSummary.map((m: any) => {
                const isExpanded = expandedMemberId === m.id;
                const maxVal = teamSummary[0]?.totalYear || 1;
                const pct = Math.round((m.totalYear / maxVal) * 100);
                return (
                  <div key={m.id} className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setExpandedMemberId(isExpanded ? null : m.id)}
                    >
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-500/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">{m.first_name.charAt(0)}{m.last_name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-white truncate">{m.first_name} {m.last_name}</p>
                          <p className="text-sm font-bold text-white ml-2">{m.totalYear.toLocaleString('fr-FR')} €</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">{m.totalMonth.toLocaleString('fr-FR')} € ce mois</span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />}
                    </div>

                    {isExpanded && m.commissions.length > 0 && (
                      <div className="px-4 pb-4 border-t border-white/5 pt-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left pb-2">Période</th>
                              <th className="text-right pb-2">Montant</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {m.commissions.map((c: any) => (
                              <tr key={c.id}>
                                <td className="py-1.5 text-gray-400">{new Date(c.period + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td>
                                <td className="py-1.5 text-right font-semibold text-white">{c.amount.toLocaleString('fr-FR')} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {isExpanded && m.commissions.length === 0 && (
                      <div className="px-4 pb-4 border-t border-white/5 pt-3">
                        <p className="text-xs text-gray-600 text-center">Aucune commission cette année</p>
                      </div>
                    )}
                  </div>
                );
              })}
              {teamSummary.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucun membre dans le réseau</p>
                </div>
              )}
            </div>
          </div>
        ) : (
        <>

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
        </>
        )}
      </div>
    </AppLayout>
  );
}
