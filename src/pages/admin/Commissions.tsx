import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { supabase, type Lead, type Partner, type TierRule, type PartnerTier, CONTRACT_TYPE_LABELS, STATUS_LABELS, type LeadStatus } from '@/lib/supabase';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

export default function Commissions() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [tiers, setTiers] = useState<TierRule[]>([]);
  const [partnerTiers, setPartnerTiers] = useState<Record<string, PartnerTier>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editTiers, setEditTiers] = useState<{ id: string; tier_name: string; min_signed: number; max_signed: number | null; rate_percent: number }[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [leadsRes, partnersRes, tiersRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('partners').select('*').order('display_name'),
      supabase.from('tier_rules').select('*').order('min_signed'),
    ]);

    if (leadsRes.data) setLeads(leadsRes.data as unknown as Lead[]);
    if (partnersRes.data) {
      const partnerList = partnersRes.data as unknown as Partner[];
      setPartners(partnerList);
      const tierMap: Record<string, PartnerTier> = {};
      await Promise.all(
        partnerList.filter(p => p.invite_used_at).map(async (p) => {
          const { data } = await supabase.rpc('get_partner_tier', { p_partner_id: p.id });
          if (data && (data as unknown[]).length > 0) {
            tierMap[p.id] = (data as unknown as PartnerTier[])[0];
          }
        })
      );
      setPartnerTiers(tierMap);
    }
    if (tiersRes.data) {
      const tierData = tiersRes.data as unknown as TierRule[];
      setTiers(tierData);
      setEditTiers(tierData.map(t => ({
        id: t.id,
        tier_name: t.tier_name,
        min_signed: t.min_signed,
        max_signed: t.max_signed,
        rate_percent: t.rate_percent,
      })));
    }
    setIsLoading(false);
  };

  const getPartnerName = (pid: string) => partners.find(p => p.id === pid)?.display_name || '—';

  const signedLeads = leads.filter(l => l.status === 'SIGNE');

  const filteredLeads = leads.filter(l => {
    if (statusFilter === 'all') return l.commission_estimated || l.commission_final;
    return l.status === statusFilter;
  });

  const handleSaveTiers = async () => {
    setIsSaving(true);
    for (const tier of editTiers) {
      await supabase.from('tier_rules').update({
        tier_name: tier.tier_name,
        min_signed: tier.min_signed,
        max_signed: tier.max_signed,
        rate_percent: tier.rate_percent,
      }).eq('id', tier.id);
    }
    await fetchData();
    setIsSaving(false);
    toast({ title: 'Paliers enregistrés' });
  };

  // Partner performance data
  const partnerPerformance = partners
    .filter(p => p.invite_used_at)
    .map(p => {
      const pLeads = leads.filter(l => l.partner_id === p.id);
      const signed = pLeads.filter(l => l.status === 'SIGNE').length;
      const totalCA = pLeads.filter(l => l.status === 'SIGNE').reduce((sum, l) => sum + (l.annual_premium_final || l.annual_premium_estimated || 0), 0);
      const totalComm = pLeads.filter(l => l.status === 'SIGNE').reduce((sum, l) => sum + (l.commission_final || l.commission_estimated || 0), 0);
      const tier = partnerTiers[p.id];
      return {
        ...p,
        leadCount: pLeads.length,
        signedCount: signed,
        totalCA,
        totalComm,
        tier,
      };
    })
    .sort((a, b) => b.signedCount - a.signedCount);

  return (
    <AdminLayout title="Gestion des Commissions">
      <div className="space-y-8">
        {/* Commission table */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Tableau des Commissions Versées</h2>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | 'all')} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="EN_COURS">En cours</TabsTrigger>
              <TabsTrigger value="DEVIS_ENVOYE">Devis envoyé</TabsTrigger>
              <TabsTrigger value="SIGNATURE">Signature</TabsTrigger>
              <TabsTrigger value="SIGNE">Signé</TabsTrigger>
              <TabsTrigger value="REFUSE">Refusé</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Dossier Client</TableHead>
                    <TableHead className="text-xs">Date Signature</TableHead>
                    <TableHead className="text-xs">Produit</TableHead>
                    <TableHead className="text-xs">Commission Brute</TableHead>
                    <TableHead className="text-xs">Part Partenaire</TableHead>
                    <TableHead className="text-xs">Comm. Courtier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        Aucune commission trouvée
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.slice(0, 20).map((lead) => {
                      const commission = lead.commission_final || lead.commission_estimated || 0;
                      const tier = partnerTiers[lead.partner_id];
                      const partnerRate = tier?.rate_percent || 50;
                      const partnerComm = commission * (partnerRate / 100);
                      const courtierComm = commission - partnerComm;

                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="text-sm font-medium">
                            {lead.first_name} {lead.last_name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(lead.updated_at).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {lead.contract_type ? CONTRACT_TYPE_LABELS[lead.contract_type] : '—'}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {commission.toLocaleString('fr-FR')} €
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="text-muted-foreground">{partnerRate}%</span>
                            <span className="ml-2 font-medium">{partnerComm.toLocaleString('fr-FR')} €</span>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {courtierComm.toLocaleString('fr-FR')} €
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Tier Configuration */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Configuration des Paliers de Rémunération</h2>

          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {editTiers.map((tier, i) => (
                  <div key={tier.id} className="rounded-lg border bg-card p-5 space-y-4">
                    <h3 className="font-semibold text-base">
                      Palier {i + 1}: {tier.rate_percent}% Commission
                    </h3>
                    <div>
                      <Progress value={tier.rate_percent} className="h-8" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tier.min_signed} {tier.max_signed ? `to ${tier.max_signed}` : '+'} Signatures
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Taux</span>
                        <span className="text-sm font-medium">{tier.rate_percent}%</span>
                      </div>
                      <Slider
                        value={[tier.rate_percent]}
                        onValueChange={(v) => {
                          const updated = [...editTiers];
                          updated[i].rate_percent = v[0];
                          setEditTiers(updated);
                        }}
                        min={0}
                        max={100}
                        step={5}
                      />
                      <p className="text-xs text-muted-foreground">
                        {tier.min_signed} to {tier.max_signed || '∞'} Signatures
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={handleSaveTiers} disabled={isSaving} className="h-9 text-sm">
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {isSaving ? 'Enregistrement...' : 'Enregistrer les paliers'}
              </Button>
            </>
          )}
        </div>

        {/* Partner Performance Table */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Performance par Partenaire</h2>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nom Partenaire</TableHead>
                  <TableHead className="text-xs">Leads</TableHead>
                  <TableHead className="text-xs">Signés</TableHead>
                  <TableHead className="text-xs">CA Généré</TableHead>
                  <TableHead className="text-xs">Comm. Versée</TableHead>
                  <TableHead className="text-xs">Palier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerPerformance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      Aucun partenaire actif
                    </TableCell>
                  </TableRow>
                ) : (
                  partnerPerformance.map((p) => {
                    const maxSigned = tiers.length > 0 ? (tiers[tiers.length - 1].max_signed || tiers[tiers.length - 1].min_signed + 2) : 8;
                    const progressPercent = Math.min((p.signedCount / maxSigned) * 100, 100);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm font-medium">{p.display_name}</TableCell>
                        <TableCell className="text-sm">{p.leadCount}</TableCell>
                        <TableCell className="text-sm">{p.signedCount}</TableCell>
                        <TableCell className="text-sm">{p.totalCA.toLocaleString('fr-FR')} €</TableCell>
                        <TableCell className="text-sm">{p.totalComm.toLocaleString('fr-FR')} €</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24">
                              <Progress value={progressPercent} className="h-6" />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {p.tier ? `${p.signedCount}/${maxSigned} dossiers` : '—'}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
