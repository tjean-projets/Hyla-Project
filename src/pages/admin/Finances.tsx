import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { supabase, type Lead, type Partner, type PartnerTier, type TierRule, CONTRACT_TYPE_LABELS, STATUS_LABELS } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Printer, CheckCircle, AlertTriangle, FileText, RefreshCw, Filter, X } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tabs, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { toast as sonnerToast } from 'sonner';

export default function Finances() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [tiers, setTiers] = useState<TierRule[]>([]);
  const [partnerTiers, setPartnerTiers] = useState<Record<string, PartnerTier>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState('unpaid');
  const [isChecking48h, setIsChecking48h] = useState(false);
  const [filterPartnerId, setFilterPartnerId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [leadsRes, partnersRes, tiersRes] = await Promise.all([
      supabase.from('leads').select('*').eq('status', 'SIGNE').order('created_at', { ascending: false }),
      supabase.from('partners').select('*').order('display_name'),
      supabase.from('tier_rules').select('*').order('min_signed'),
    ]);
    if (leadsRes.data) setLeads(leadsRes.data as unknown as Lead[]);
    if (tiersRes.data) setTiers(tiersRes.data as unknown as TierRule[]);
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
    setIsLoading(false);
  };

  const getPartnerName = (pid: string) => partners.find(p => p.id === pid)?.display_name || '—';
  const getPartner = (pid: string) => partners.find(p => p.id === pid);

  const unpaidLeads = leads.filter(l => !l.is_paid);
  const paidLeads = leads.filter(l => l.is_paid);

  // Apply partner filter
  const filteredUnpaid = filterPartnerId ? unpaidLeads.filter(l => l.partner_id === filterPartnerId) : unpaidLeads;
  const filteredPaid = filterPartnerId ? paidLeads.filter(l => l.partner_id === filterPartnerId) : paidLeads;
  const displayLeads = tab === 'unpaid' ? filteredUnpaid : filteredPaid;

  const totalUnpaidGross = filteredUnpaid.reduce((s, l) => s + (l.commission_final || l.commission_estimated || 0), 0);
  const totalUnpaidPartner = filteredUnpaid.reduce((s, l) => {
    const rate = partnerTiers[l.partner_id]?.rate_percent || 50;
    return s + (l.commission_final || l.commission_estimated || 0) * rate / 100;
  }, 0);
  const totalUnpaidCourtage = filteredUnpaid.reduce((s, l) => s + (l.frais_courtage || 0), 0);

  const generateInvoiceHtml = (lead: Lead, partner: Partner, rate: number) => {
    const gross = lead.commission_final || lead.commission_estimated || 0;
    const partnerComm = gross * rate / 100;
    const margin = (lead.frais_courtage || 0) + gross - partnerComm;
    const refNumber = `FAC-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const isPro = partner.partner_type === 'professional';

    return { refNumber, html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Facture ${refNumber}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:#1a1a2e;padding:48px;font-size:13px;line-height:1.5}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid #e5e7eb}.logo{font-size:20px;font-weight:700;letter-spacing:-.5px}.logo span{color:#6b7280;font-weight:400;font-size:13px;display:block;margin-top:2px}.meta{text-align:right;color:#6b7280;font-size:12px}.meta strong{color:#1a1a2e;display:block;font-size:14px;margin-bottom:2px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px}.box{background:#f9fafb;border-radius:8px;padding:16px}.box h3{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:8px}.box p{font-size:13px;color:#374151}.box p strong{color:#1a1a2e}table{width:100%;border-collapse:collapse;margin-bottom:24px}thead th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;border-bottom:2px solid #e5e7eb;padding:8px 12px;text-align:left;font-weight:600}tbody td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:13px}.mono{font-variant-numeric:tabular-nums;font-family:'SF Mono','Fira Code',monospace}.totals{border-top:2px solid #e5e7eb;padding-top:16px}.tr{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}.tr.final{font-size:16px;font-weight:700;padding-top:12px;margin-top:8px;border-top:1px solid #e5e7eb}.label{color:#6b7280}.footer{margin-top:48px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;text-align:center}@media print{body{padding:24px}}</style>
</head><body>
<div class="header"><div><div class="logo">Thomas Jean Courtage<span>Facture de Commission</span></div></div><div class="meta"><strong>${refNumber}</strong>${dateStr}</div></div>
<div class="grid"><div class="box"><h3>Bénéficiaire</h3><p><strong>${partner.display_name}</strong></p><p>${partner.email}</p><p>Type : ${isPro ? 'Professionnel' : 'Particulier'}</p></div><div class="box"><h3>Dossier</h3><p><strong>${lead.first_name} ${lead.last_name}</strong></p><p>Produit : ${lead.contract_type ? CONTRACT_TYPE_LABELS[lead.contract_type] : '—'}</p><p>Payé le ${dateStr}</p></div></div>
<table><thead><tr><th>Description</th><th>Montant</th></tr></thead><tbody>
<tr><td>Commission brute</td><td class="mono">${gross.toLocaleString('fr-FR')} €</td></tr>
<tr><td>Taux partenaire (${rate}%)</td><td class="mono">${partnerComm.toLocaleString('fr-FR')} €</td></tr>
</tbody></table>
<div class="totals"><div class="tr"><span class="label">Commission brute</span><span class="mono">${gross.toLocaleString('fr-FR')} €</span></div><div class="tr"><span class="label">Part Partenaire</span><span class="mono">${partnerComm.toLocaleString('fr-FR')} €</span></div><div class="tr final"><span>Net à verser</span><span class="mono">${partnerComm.toLocaleString('fr-FR')} €</span></div></div>
<div class="footer">Thomas Jean Courtage — Facture — Réf. ${refNumber}</div>
</body></html>` };
  };

  const handleMarkPaid = async (leadId: string) => {
    const { error } = await supabase.from('leads').update({
      is_paid: true,
      paid_at: new Date().toISOString(),
    } as Record<string, unknown>).eq('id', leadId);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }

    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      const partner = getPartner(lead.partner_id);
      if (partner) {
        // Notify partner
        if (partner.user_id) {
          await supabase.from('notifications').insert({
            user_id: partner.user_id,
            title: '💰 Commission versée',
            message: `💰 La commission pour ${lead.first_name} ${lead.last_name} a été versée.`,
            type: 'success',
            link: '/leads/' + lead.id,
          });
        }

        // Generate and store invoice document
        const tier = partnerTiers[lead.partner_id];
        const rate = tier?.rate_percent || 50;
        const { refNumber, html } = generateInvoiceHtml(lead, partner, rate);
        const fileName = `Facture_${refNumber}_${lead.last_name}_${lead.first_name}.html`;
        const filePath = `${lead.partner_id}/invoice/${Date.now()}_${fileName}`;
        const blob = new Blob([html], { type: 'text/html' });

        const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, blob);
        if (!uploadErr) {
          await supabase.from('partner_documents').insert({
            partner_id: lead.partner_id,
            lead_id: lead.id,
            document_type: 'invoice',
            file_name: fileName,
            file_url: `documents/${filePath}`,
          });
        }
      }
    }

    sonnerToast.success('Paiement enregistré & facture générée');
    fetchData();
  };

  const handleCheck48h = async () => {
    setIsChecking48h(true);
    const { data, error } = await supabase.rpc('check_48h_alerts');
    setIsChecking48h(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      const count = data as unknown as number;
      sonnerToast.info(`${count} alerte${count !== 1 ? 's' : ''} 48h envoyée${count !== 1 ? 's' : ''}`);
    }
  };

  // Generate Stripe-style print invoice
  const handlePrintInvoice = (partnerId?: string) => {
    const targetPartnerId = partnerId || filterPartnerId;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const targetLeads = targetPartnerId
      ? unpaidLeads.filter(l => l.partner_id === targetPartnerId)
      : unpaidLeads;

    const partnerName = targetPartnerId ? getPartnerName(targetPartnerId) : 'Tous les partenaires';
    const tier = targetPartnerId ? partnerTiers[targetPartnerId] : null;
    const tierInfo = tier ? `${tier.tier_name} — ${tier.rate_percent}%` : '—';
    const refNumber = `TJC-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

    let totalGross = 0;
    let totalPartnerComm = 0;

    const rows = targetLeads.map(l => {
      const tierData = partnerTiers[l.partner_id];
      const rate = tierData?.rate_percent || 50;
      const gross = l.commission_final || l.commission_estimated || 0;
      const partnerComm = gross * rate / 100;
      const margin = (l.frais_courtage || 0) + gross - partnerComm;
      totalGross += gross;
      totalPartnerComm += partnerComm;
      return `<tr>
        <td>${l.first_name} ${l.last_name}</td>
        <td>${l.contract_type ? CONTRACT_TYPE_LABELS[l.contract_type] : '—'}</td>
        <td class="mono">${gross.toLocaleString('fr-FR')} €</td>
        <td class="mono">${rate}%</td>
        <td class="mono">${partnerComm.toLocaleString('fr-FR')} €</td>
        <td class="mono">${margin.toLocaleString('fr-FR')} €</td>
      </tr>`;
    }).join('');

    const totalMargin = totalGross - totalPartnerComm;

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Bordereau ${refNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #1a1a2e; padding: 48px; font-size: 13px; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb; }
        .logo { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
        .logo span { color: #6b7280; font-weight: 400; font-size: 13px; display: block; margin-top: 2px; }
        .meta { text-align: right; color: #6b7280; font-size: 12px; }
        .meta strong { color: #1a1a2e; display: block; font-size: 14px; margin-bottom: 2px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
        .info-box { background: #f9fafb; border-radius: 8px; padding: 16px; }
        .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 8px; }
        .info-box p { font-size: 13px; color: #374151; }
        .info-box p strong { color: #1a1a2e; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        thead th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; border-bottom: 2px solid #e5e7eb; padding: 8px 12px; text-align: left; font-weight: 600; }
        tbody td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
        tbody tr:last-child td { border-bottom: none; }
        .mono { font-variant-numeric: tabular-nums; font-family: 'SF Mono', 'Fira Code', monospace; }
        .totals { border-top: 2px solid #e5e7eb; padding-top: 16px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .total-row.final { font-size: 16px; font-weight: 700; padding-top: 12px; margin-top: 8px; border-top: 1px solid #e5e7eb; }
        .total-row .label { color: #6b7280; }
        .total-row .value { font-variant-numeric: tabular-nums; }
        .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
        @media print { body { padding: 24px; } .no-print { display: none; } }
      </style>
    </head><body>
      <div class="header">
        <div>
          <div class="logo">Thomas Jean Courtage<span>Bordereau de Commissions</span></div>
        </div>
        <div class="meta">
          <strong>${refNumber}</strong>
          ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <h3>Partenaire</h3>
          <p><strong>${partnerName}</strong></p>
          <p>Palier appliqué : ${tierInfo}</p>
          <p>${targetLeads.length} dossier${targetLeads.length > 1 ? 's' : ''} signé${targetLeads.length > 1 ? 's' : ''}</p>
        </div>
        <div class="info-box">
          <h3>Période</h3>
          <p><strong>Commissions en attente de règlement</strong></p>
          <p>Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      <table>
        <thead><tr>
          <th>Client</th><th>Produit</th><th>Comm. Brute</th><th>Taux</th><th>Part Partenaire</th><th>Marge Courtier</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="total-row"><span class="label">Total Commission Brute</span><span class="value mono">${totalGross.toLocaleString('fr-FR')} €</span></div>
        <div class="total-row"><span class="label">Total Part Partenaire (HT)</span><span class="value mono">${totalPartnerComm.toLocaleString('fr-FR')} €</span></div>
        <div class="total-row final"><span class="label">Marge Nette Courtier</span><span class="value mono">${totalMargin.toLocaleString('fr-FR')} €</span></div>
      </div>

      <div class="footer">
        Thomas Jean Courtage — Document généré automatiquement — Réf. ${refNumber}
      </div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  // Group unpaid leads by partner for filter chips
  const unpaidByPartner = unpaidLeads.reduce((acc, l) => {
    if (!acc[l.partner_id]) acc[l.partner_id] = [];
    acc[l.partner_id].push(l);
    return acc;
  }, {} as Record<string, Lead[]>);

  return (
    <AdminLayout title="Finances">
      <div className="space-y-6">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">À payer</p>
            <p className="text-lg font-bold">{filteredUnpaid.length} dossier{filteredUnpaid.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Commission Brute</p>
            <p className="text-lg font-bold">{totalUnpaidGross.toLocaleString('fr-FR')} €</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Part Partenaire</p>
            <p className="text-lg font-bold">{totalUnpaidPartner.toLocaleString('fr-FR')} €</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Marge Nette</p>
            <p className="text-lg font-bold text-emerald-600">{(totalUnpaidCourtage + totalUnpaidGross - totalUnpaidPartner).toLocaleString('fr-FR')} €</p>
          </div>
        </div>

        {/* Partner filter chips */}
        {Object.keys(unpaidByPartner).length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Button
              variant={!filterPartnerId ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilterPartnerId(null)}
            >
              Tous
            </Button>
            {Object.entries(unpaidByPartner).map(([pid, pLeads]) => (
              <Button
                key={pid}
                variant={filterPartnerId === pid ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilterPartnerId(filterPartnerId === pid ? null : pid)}
              >
                {getPartnerName(pid)} ({pLeads.length})
              </Button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handlePrintInvoice()} disabled={displayLeads.length === 0}>
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            {filterPartnerId ? `Bordereau ${getPartnerName(filterPartnerId)}` : 'Bordereau Général'}
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleCheck48h} disabled={isChecking48h}>
            <AlertTriangle className="h-3 w-3 mr-1" />
            {isChecking48h ? 'Vérification...' : 'Alertes 48h'}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="unpaid" className="text-sm">
              Prêtes à payer
              {filteredUnpaid.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 text-[10px]">{filteredUnpaid.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="paid" className="text-sm">Payées</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Table */}
        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Client</TableHead>
                  <TableHead className="text-xs">Partenaire</TableHead>
                  <TableHead className="text-xs">Produit</TableHead>
                  <TableHead className="text-xs">Comm. Brute</TableHead>
                  <TableHead className="text-xs">Palier</TableHead>
                  <TableHead className="text-xs">Part Partenaire</TableHead>
                  <TableHead className="text-xs">Marge Nette</TableHead>
                  {tab === 'unpaid' && <TableHead className="text-xs w-28"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tab === 'unpaid' ? 8 : 7} className="text-center text-sm text-muted-foreground py-8">
                      {tab === 'unpaid' ? 'Aucune commission en attente' : 'Aucun paiement effectué'}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayLeads.map((lead) => {
                    const tier = partnerTiers[lead.partner_id];
                    const rate = tier?.rate_percent || 50;
                    const gross = lead.commission_final || lead.commission_estimated || 0;
                    const partnerComm = gross * rate / 100;
                    const margin = (lead.frais_courtage || 0) + gross - partnerComm;
                    const isUrgent = tab === 'unpaid' && (Date.now() - new Date(lead.created_at).getTime()) > 48 * 60 * 60 * 1000;

                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="text-sm font-medium">
                          <div className="flex items-center gap-1.5">
                            {lead.first_name} {lead.last_name}
                            {isUrgent && (
                              <span className="inline-flex items-center text-[9px] h-4 px-1 rounded bg-destructive text-destructive-foreground font-medium">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                48h+
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{getPartnerName(lead.partner_id)}</TableCell>
                        <TableCell className="text-sm">{lead.contract_type ? CONTRACT_TYPE_LABELS[lead.contract_type] : '—'}</TableCell>
                        <TableCell className="text-sm font-medium tabular-nums">{gross.toLocaleString('fr-FR')} €</TableCell>
                        <TableCell className="text-sm">{rate}%</TableCell>
                        <TableCell className="text-sm tabular-nums">{partnerComm.toLocaleString('fr-FR')} €</TableCell>
                        <TableCell className="text-sm font-semibold text-emerald-600 tabular-nums">{margin.toLocaleString('fr-FR')} €</TableCell>
                        {tab === 'unpaid' && (
                          <TableCell>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMarkPaid(lead.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Payé
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
