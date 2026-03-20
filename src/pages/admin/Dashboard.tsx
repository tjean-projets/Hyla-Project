import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, FileText, TrendingUp, Euro, Activity, CheckCircle, Clock } from 'lucide-react';
import { AdminLayout } from '@/components/AdminLayout';
import { KPICard } from '@/components/KPICard';
import { LeadCard } from '@/components/LeadCard';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase, type Lead, type Partner, type PartnerTier, type LeadStatus, type LeadEvent, STATUS_LABELS, STATUS_ORDER } from '@/lib/supabase';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { toast as sonnerToast } from 'sonner';

const STATUS_BAR_COLORS: Record<LeadStatus, string> = {
  NOUVEAU: 'hsl(217, 91%, 60%)',
  EN_COURS: 'hsl(38, 92%, 50%)',
  CONTACT: 'hsl(199, 89%, 48%)',
  DEVIS_ENVOYE: 'hsl(262, 83%, 58%)',
  SIGNATURE: 'hsl(25, 95%, 53%)',
  SIGNE: 'hsl(142, 71%, 45%)',
  REFUSE: 'hsl(0, 84%, 60%)',
  PERDU: 'hsl(0, 0%, 45%)',
};

export default function AdminDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerTiers, setPartnerTiers] = useState<Record<string, PartnerTier>>({});
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-new-leads')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
      }, (payload) => {
        const newLead = payload.new as Lead;
        sonnerToast.info('📥 Nouveau lead reçu !', {
          description: `${newLead.first_name} ${newLead.last_name} vient d'être ajouté.`,
        });
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const [leadsRes, partnersRes, eventsRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('partners').select('*').order('display_name'),
      supabase.from('lead_events').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    if (leadsRes.data) setLeads(leadsRes.data as unknown as Lead[]);
    if (eventsRes.data) setEvents(eventsRes.data as unknown as LeadEvent[]);
    if (partnersRes.data) {
      const partnerList = partnersRes.data as unknown as Partner[];
      setPartners(partnerList);
      const tierMap: Record<string, PartnerTier> = {};
      await Promise.all(
        partnerList.map(async (p) => {
          const { data } = await supabase.rpc('get_partner_tier', { p_partner_id: p.id });
          if (data && (data as unknown[]).length > 0) {
            tierMap[p.id] = (data as unknown as PartnerTier[])[0];
          }
        })
      );
      setPartnerTiers(tierMap);
    }
    setIsLoading(false);
  };

  const getPartnerName = (partnerId: string) => partners.find((p) => p.id === partnerId)?.display_name || 'Inconnu';

  const totalLeads = leads.length;
  const activePartners = partners.filter((p) => p.is_active && p.invite_used_at).length;
  const signedLeads = leads.filter((l) => l.status === 'SIGNE').length;
  const grossCommission = leads
    .filter((l) => l.status === 'SIGNE')
    .reduce((sum, l) => sum + (l.frais_courtage || 0) + (l.commission_final || l.commission_estimated || 0), 0);
  const partnerShare = leads
    .filter((l) => l.status === 'SIGNE')
    .reduce((sum, l) => {
      const rate = partnerTiers[l.partner_id]?.rate_percent || 50;
      return sum + (l.commission_final || l.commission_estimated || 0) * rate / 100;
    }, 0);
  const netMargin = grossCommission - partnerShare;
  const conversionRate = totalLeads > 0 ? Math.round((signedLeads / totalLeads) * 100) : 0;

  // --- NEW KPI 1: Leads by status (bar chart data) ---
  const leadsByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_ORDER.forEach(s => { counts[s] = 0; });
    leads.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
    return STATUS_ORDER.map(s => ({
      status: s,
      label: STATUS_LABELS[s],
      count: counts[s] || 0,
      fill: STATUS_BAR_COLORS[s],
    }));
  }, [leads]);

  // --- NEW KPI 2: Commissions this month ---
  const commissionsThisMonth = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return leads
      .filter(l => l.status === 'SIGNE' && l.created_at && new Date(l.created_at).getMonth() === month && new Date(l.created_at).getFullYear() === year)
      .reduce((sum, l) => sum + (l.commission_final || l.commission_estimated || 0), 0);
  }, [leads]);

  // --- NEW KPI 3: Paid vs Pending ---
  const commissionsPaid = useMemo(() => {
    return leads
      .filter(l => l.status === 'SIGNE' && l.is_paid)
      .reduce((sum, l) => sum + (l.commission_final || l.commission_estimated || 0), 0);
  }, [leads]);

  const commissionsPending = useMemo(() => {
    return leads
      .filter(l => l.status === 'SIGNE' && !l.is_paid)
      .reduce((sum, l) => sum + (l.commission_final || l.commission_estimated || 0), 0);
  }, [leads]);

  const monthlyData = (() => {
    const months: Record<string, { gross: number; net: number }> = {};
    leads.forEach(l => {
      if (l.status === 'SIGNE') {
        const key = new Date(l.created_at).toLocaleDateString('fr-FR', { month: 'short' });
        if (!months[key]) months[key] = { gross: 0, net: 0 };
        const commission = l.commission_final || l.commission_estimated || 0;
        const rate = partnerTiers[l.partner_id]?.rate_percent || 50;
        const g = (l.frais_courtage || 0) + commission;
        const p = commission * rate / 100;
        months[key].gross += g;
        months[key].net += (g - p);
      }
    });
    return Object.entries(months).map(([month, v]) => ({ month, gross: v.gross, net: v.net })).slice(-6);
  })();

  const partnerPerf = (() => {
    const perf: Record<string, { name: string; count: number }> = {};
    leads.filter(l => l.status === 'SIGNE').forEach(l => {
      const name = getPartnerName(l.partner_id);
      if (!perf[l.partner_id]) perf[l.partner_id] = { name, count: 0 };
      perf[l.partner_id].count++;
    });
    return Object.values(perf).sort((a, b) => b.count - a.count).slice(0, 5);
  })();

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = search === '' ||
      `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone.includes(search);
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesPartner = partnerFilter === 'all' || lead.partner_id === partnerFilter;
    return matchesSearch && matchesStatus && matchesPartner;
  });

  return (
    <AdminLayout title="Tableau de Bord">
      <div className="space-y-6">
        {/* Row 1: Main KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title="CA Brut (Signés)" value={`${grossCommission.toLocaleString('fr-FR')} €`} subtitle={`${signedLeads} contrats`} />
          <KPICard title="Marge Nette" value={`${netMargin.toLocaleString('fr-FR')} €`} subtitle="Après reversements" trend={netMargin > 0 ? { value: Math.round((netMargin / Math.max(grossCommission, 1)) * 100), label: 'marge' } : undefined} />
          <KPICard title="Dossiers Reçus" value={totalLeads} subtitle={`${conversionRate}% conversion`} />
          <KPICard title="Partenaires Actifs" value={activePartners} subtitle={`${partners.length} total`} />
        </div>

        {/* Row 2: New KPIs — commissions this month + paid vs pending */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-5 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium">Commissions ce mois</p>
            <p className="text-2xl font-bold tracking-tight">{commissionsThisMonth.toLocaleString('fr-FR')} €</p>
            <p className="text-xs text-muted-foreground">Commissions générées sur les dossiers signés ce mois</p>
          </div>
          <div className="rounded-lg border bg-card p-5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs text-muted-foreground font-medium">Commissions payées</p>
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{commissionsPaid.toLocaleString('fr-FR')} €</p>
          </div>
          <div className="rounded-lg border bg-card p-5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs text-muted-foreground font-medium">Commissions en attente</p>
            </div>
            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{commissionsPending.toLocaleString('fr-FR')} €</p>
          </div>
        </div>

        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Leads by status chart */}
            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-semibold mb-4">Leads par statut</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={leadsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                    {leadsByStatus.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Margin chart */}
            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-semibold mb-4">Marge Brut vs Net</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData.length > 0 ? monthlyData : [{ month: '—', gross: 0, net: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(220, 9%, 46%)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 9%, 46%)" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="gross" name="Brut" stroke="hsl(217, 91%, 60%)" fill="hsl(217, 91%, 60%)" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="net" name="Net" stroke="hsl(142, 71%, 45%)" fill="hsl(142, 71%, 45%)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-semibold mb-3">Activité Récente</p>
              <ActivityFeed events={events.slice(0, 6)} />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10" />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | 'all')}>
              <SelectTrigger className="flex-1 h-10 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger className="flex-1 h-10 text-sm"><SelectValue placeholder="Partenaire" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Leads</h2>
            <span className="text-xs text-muted-foreground">{filteredLeads.length} résultat{filteredLeads.length !== 1 ? 's' : ''}</span>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">Aucun lead trouvé</p>
            </div>
          ) : (
            filteredLeads.slice(0, 20).map((lead) => (
              <LeadCard key={lead.id} lead={lead} showPartner partnerName={getPartnerName(lead.partner_id)} />
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
