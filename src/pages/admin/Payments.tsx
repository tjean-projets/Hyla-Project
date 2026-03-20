import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { supabase, type Partner, PARTNER_TYPE_LABELS, CONTRACT_TYPE_LABELS } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { CheckCircle, XCircle, Printer, FileText } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WithdrawalRequest {
  id: string;
  partner_id: string;
  amount: number;
  status: string;
  lead_ids: string[];
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
}

interface LeadInfo {
  id: string;
  first_name: string;
  last_name: string;
  contract_type: string | null;
  commission_final: number | null;
  commission_estimated: number | null;
}

export default function Payments() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState('pending');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [reqRes, partRes] = await Promise.all([
      supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('partners').select('*'),
    ]);
    if (reqRes.data) setRequests(reqRes.data as unknown as WithdrawalRequest[]);
    if (partRes.data) setPartners(partRes.data as unknown as Partner[]);
    setIsLoading(false);
  };

  const getPartner = (pid: string) => partners.find(p => p.id === pid);
  const getPartnerName = (pid: string) => getPartner(pid)?.display_name || '—';

  const filtered = requests.filter(r => {
    if (tab === 'pending') return r.status === 'pending';
    return r.status !== 'pending';
  });

  const handleApprove = async (req: WithdrawalRequest) => {
    // Mark leads as paid
    if (req.lead_ids.length > 0) {
      await supabase.from('leads').update({
        is_paid: true,
        paid_at: new Date().toISOString(),
      } as Record<string, unknown>).in('id', req.lead_ids);
    }

    // Update request
    const { error } = await supabase.from('withdrawal_requests').update({
      status: 'approved',
      processed_at: new Date().toISOString(),
    } as Record<string, unknown>).eq('id', req.id);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }

    // Notify partner
    const partner = getPartner(req.partner_id);
    if (partner?.user_id) {
      await supabase.from('notifications').insert({
        user_id: partner.user_id,
        title: '💰 Retrait approuvé',
        message: `💰 Votre demande de retrait de ${req.amount.toLocaleString('fr-FR')}€ a été approuvée.`,
        type: 'success',
        link: '/wallet',
      });
    }

    // Sync wallet
    await supabase.rpc('sync_wallet_balance', { p_partner_id: req.partner_id });

    sonnerToast.success('Retrait approuvé');
    fetchData();
  };

  const handleReject = async (req: WithdrawalRequest) => {
    const { error } = await supabase.from('withdrawal_requests').update({
      status: 'rejected',
      processed_at: new Date().toISOString(),
    } as Record<string, unknown>).eq('id', req.id);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }

    const partner = getPartner(req.partner_id);
    if (partner?.user_id) {
      await supabase.from('notifications').insert({
        user_id: partner.user_id,
        title: '❌ Retrait refusé',
        message: `❌ Votre demande de retrait de ${req.amount.toLocaleString('fr-FR')}€ a été refusée.`,
        type: 'error',
        link: '/wallet',
      });
    }

    await supabase.rpc('sync_wallet_balance', { p_partner_id: req.partner_id });
    sonnerToast.info('Retrait refusé');
    fetchData();
  };

  const handlePrintVoucher = async (req: WithdrawalRequest) => {
    const partner = getPartner(req.partner_id);
    if (!partner) return;

    // Fetch lead details
    let leads: LeadInfo[] = [];
    if (req.lead_ids.length > 0) {
      const { data } = await supabase.from('leads').select('id, first_name, last_name, contract_type, commission_final, commission_estimated').in('id', req.lead_ids);
      if (data) leads = data as unknown as LeadInfo[];
    }

    const isPro = partner.partner_type === 'professional';
    const docTitle = isPro ? 'Note d\'Honoraires' : 'Fiche de Versement';
    const refNumber = `WD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

    const rows = leads.map(l => {
      const comm = l.commission_final || l.commission_estimated || 0;
      return `<tr>
        <td>${l.first_name} ${l.last_name}</td>
        <td>${l.contract_type ? (CONTRACT_TYPE_LABELS as Record<string, string>)[l.contract_type] || l.contract_type : '—'}</td>
        <td class="mono">${comm.toLocaleString('fr-FR')} €</td>
      </tr>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>${docTitle} ${refNumber}</title>
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
        .mono { font-variant-numeric: tabular-nums; font-family: 'SF Mono', 'Fira Code', monospace; }
        .total { border-top: 2px solid #e5e7eb; padding-top: 16px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; }
        .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
        @media print { body { padding: 24px; } }
      </style>
    </head><body>
      <div class="header">
        <div>
          <div class="logo">Hyla<span>${docTitle}</span></div>
        </div>
        <div class="meta">
          <strong>${refNumber}</strong>
          ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
      <div class="info-grid">
        <div class="info-box">
          <h3>Bénéficiaire</h3>
          <p><strong>${partner.display_name}</strong></p>
          <p>${partner.email}</p>
          <p>Type : ${isPro ? 'Professionnel' : 'Particulier'}</p>
        </div>
        <div class="info-box">
          <h3>Demande</h3>
          <p><strong>${leads.length} dossier${leads.length > 1 ? 's' : ''}</strong></p>
          <p>Créée le ${format(new Date(req.created_at), 'd MMMM yyyy', { locale: fr })}</p>
        </div>
      </div>
      <table>
        <thead><tr><th>Client</th><th>Produit</th><th>Commission</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total">
        <span>Total à verser</span>
        <span class="mono">${req.amount.toLocaleString('fr-FR')} €</span>
      </div>
      <div class="footer">Hyla — ${docTitle} — Réf. ${refNumber}</div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <AdminLayout title="Paiements">
      <div className="space-y-6">
        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending" className="text-sm">
              En attente
              {pendingCount > 0 && <Badge variant="destructive" className="ml-2 h-5 text-[10px]">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="processed" className="text-sm">Traitées</TabsTrigger>
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
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Partenaire</TableHead>
                  <TableHead className="text-xs">Montant</TableHead>
                  <TableHead className="text-xs">Dossiers</TableHead>
                  <TableHead className="text-xs">Statut</TableHead>
                  {tab === 'pending' && <TableHead className="text-xs w-40"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tab === 'pending' ? 6 : 5} className="text-center text-sm text-muted-foreground py-8">
                      {tab === 'pending' ? 'Aucune demande en attente' : 'Aucune demande traitée'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="text-sm">{format(new Date(req.created_at), 'd MMM yyyy', { locale: fr })}</TableCell>
                      <TableCell className="text-sm font-medium">{getPartnerName(req.partner_id)}</TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums">{req.amount.toLocaleString('fr-FR')} €</TableCell>
                      <TableCell className="text-sm">{req.lead_ids.length}</TableCell>
                      <TableCell>
                        <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                          {req.status === 'pending' ? 'En attente' : req.status === 'approved' ? 'Approuvé' : 'Refusé'}
                        </Badge>
                      </TableCell>
                      {tab === 'pending' && (
                        <TableCell>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleApprove(req)}>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approuver
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleReject(req)}>
                              <XCircle className="h-3 w-3 mr-1" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handlePrintVoucher(req)}>
                              <Printer className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
