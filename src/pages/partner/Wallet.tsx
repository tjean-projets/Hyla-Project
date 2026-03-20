import { useState, useEffect, useMemo } from 'react';
import { Wallet, Send, FileCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { MobileNav } from '@/components/MobileNav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase, type Lead, type PartnerTier, CONTRACT_TYPE_LABELS } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WalletData {
  available_balance: number;
  pending_balance: number;
  total_balance: number;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function PartnerWallet() {
  const { partnerId, partnerRate } = useAuth();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [kycValid, setKycValid] = useState(false);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (partnerId) fetchAll();
  }, [partnerId]);

  const fetchAll = async () => {
    // Sync wallet first
    await supabase.rpc('sync_wallet_balance', { p_partner_id: partnerId });

    const [walletRes, leadsRes, withdrawRes, docsRes, allWithdrawRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('partner_id', partnerId!).maybeSingle(),
      supabase.from('leads').select('*')
        .eq('partner_id', partnerId!)
        .eq('status', 'SIGNE')
        .eq('paiement_compagnie_recu', true)
        .eq('is_paid', false)
        .order('created_at', { ascending: false }),
      supabase.from('withdrawal_requests').select('*').eq('partner_id', partnerId!).order('created_at', { ascending: false }).limit(20),
      supabase.from('partner_documents').select('document_type, validation_status').eq('partner_id', partnerId!),
      supabase.from('withdrawal_requests').select('amount').eq('partner_id', partnerId!).eq('status', 'approved'),
    ]);

    if (walletRes.data) setWallet(walletRes.data as unknown as WalletData);
    if (leadsRes.data) setAvailableLeads(leadsRes.data as unknown as Lead[]);
    if (withdrawRes.data) setWithdrawals(withdrawRes.data as unknown as WithdrawalRequest[]);
    if (allWithdrawRes.data) {
      const total = (allWithdrawRes.data as { amount: number }[]).reduce((s, w) => s + w.amount, 0);
      setTotalWithdrawn(total);
    }

    // Check KYC: need at least CNI + RIB + contract all validated
    if (docsRes.data) {
      const docs = docsRes.data as unknown as { document_type: string; validation_status: string }[];
      const validated = docs.filter(d => d.validation_status === 'validated');
      const hasId = validated.some(d => d.document_type === 'cni');
      const hasRib = validated.some(d => ['rib', 'rib_pro'].includes(d.document_type));
      const hasContract = validated.some(d => d.document_type === 'signed_contract');
      setKycValid(hasId && hasRib && hasContract);
    }

    setIsLoading(false);
  };

  const toggleLead = (leadId: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const selectedAmount = useMemo(() => {
    const rate = partnerRate / 100;
    return availableLeads
      .filter(l => selectedLeads.has(l.id))
      .reduce((s, l) => s + (l.commission_final || l.commission_estimated || 0) * rate, 0);
  }, [selectedLeads, availableLeads, partnerRate]);

  const handleWithdraw = async () => {
    if (selectedLeads.size === 0 || !partnerId) return;
    setIsSubmitting(true);

    const { error } = await supabase.from('withdrawal_requests').insert([{
      partner_id: partnerId,
      amount: selectedAmount,
      lead_ids: Array.from(selectedLeads),
    }]);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      sonnerToast.success(`Demande de retrait de ${selectedAmount.toLocaleString('fr-FR')}€ envoyée`);
      setSelectedLeads(new Set());
      fetchAll();
    }
    setIsSubmitting(false);
  };

  const statusLabel = (s: string) => {
    if (s === 'pending') return { label: 'En attente', variant: 'secondary' as const };
    if (s === 'approved') return { label: 'Approuvé', variant: 'default' as const };
    if (s === 'rejected') return { label: 'Refusé', variant: 'destructive' as const };
    return { label: s, variant: 'secondary' as const };
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Portefeuille" />

      <main className="container py-4 space-y-6">
        {/* Balance Card */}
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : (
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Solde disponible</p>
                <p className="text-3xl font-bold tracking-tight">{((wallet?.available_balance || 0) * partnerRate / 100).toLocaleString('fr-FR')} €</p>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">En cours</p>
                <p className="font-semibold">{((wallet?.pending_balance || 0) * partnerRate / 100).toLocaleString('fr-FR')} €</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total généré</p>
                <p className="font-semibold">{((wallet?.total_balance || 0) * partnerRate / 100).toLocaleString('fr-FR')} €</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Retiré</p>
                <p className="font-semibold text-emerald-600">{totalWithdrawn.toLocaleString('fr-FR')} €</p>
              </div>
            </div>
          </div>
        )}

        {/* KYC Warning */}
        {!isLoading && !kycValid && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Documents manquants</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Vos documents (CNI, RIB, Contrat) doivent être validés avant de pouvoir demander un retrait.
              </p>
            </div>
          </div>
        )}

        {/* Available Leads */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Dossiers disponibles</h2>
          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : availableLeads.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground rounded-lg border bg-card">
              Aucun dossier disponible pour retrait
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-xs">Client</TableHead>
                    <TableHead className="text-xs">Produit</TableHead>
                    <TableHead className="text-xs">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableLeads.map((lead) => {
                    const comm = (lead.commission_final || lead.commission_estimated || 0) * partnerRate / 100;
                    return (
                      <TableRow key={lead.id} className="cursor-pointer" onClick={() => toggleLead(lead.id)}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLeads.has(lead.id)}
                            onCheckedChange={() => toggleLead(lead.id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{lead.first_name} {lead.last_name}</TableCell>
                        <TableCell className="text-sm">{lead.contract_type ? CONTRACT_TYPE_LABELS[lead.contract_type] : '—'}</TableCell>
                        <TableCell className="text-sm font-semibold tabular-nums">{comm.toLocaleString('fr-FR')} €</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Withdraw action */}
          {availableLeads.length > 0 && (
            <div className="flex items-center justify-between mt-4 p-4 rounded-lg border bg-card">
              <div>
                <p className="text-xs text-muted-foreground">Montant sélectionné</p>
                <p className="text-xl font-bold">{selectedAmount.toLocaleString('fr-FR')} €</p>
              </div>
              <Button
                onClick={handleWithdraw}
                disabled={selectedLeads.size === 0 || !kycValid || isSubmitting}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Demander le virement
              </Button>
            </div>
          )}
        </div>

        {/* Withdrawal History */}
        {withdrawals.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-3">Historique des retraits</h2>
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Montant</TableHead>
                    <TableHead className="text-xs">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => {
                    const s = statusLabel(w.status);
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="text-sm">{format(new Date(w.created_at), 'd MMM yyyy', { locale: fr })}</TableCell>
                        <TableCell className="text-sm font-semibold tabular-nums">{w.amount.toLocaleString('fr-FR')} €</TableCell>
                        <TableCell><Badge variant={s.variant} className="text-xs">{s.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
