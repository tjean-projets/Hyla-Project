import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS, HYLA_PRODUCTS, HYLA_COMMISSION_SCALE, getHylaCommission } from '@/lib/supabase';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Clock, TrendingUp, Download, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import { SkeletonTable, SkeletonRow } from '@/components/ui/skeleton-card';
import { DealDrawer } from '@/components/DealDrawer';

type Deal = Tables<'deals'>;

const KANBAN_COLS = [
  { status: 'en_cours',   label: 'En cours',   bg: 'bg-blue-50 dark:bg-blue-950/30',    text: 'text-blue-700 dark:text-blue-300' },
  { status: 'en_attente', label: 'En attente', bg: 'bg-amber-50 dark:bg-amber-950/30',  text: 'text-amber-700 dark:text-amber-300' },
  { status: 'signee',     label: 'Signée',      bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300' },
  { status: 'livree',     label: 'Livrée',      bg: 'bg-teal-50 dark:bg-teal-950/30',   text: 'text-teal-700 dark:text-teal-300' },
  { status: 'annulee',    label: 'Annulée',     bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-700 dark:text-red-300' },
];

function DealForm({ onSuccess, contacts, teamMembers, initialData, onDelete }: {
  onSuccess: () => void;
  contacts: Tables<'contacts'>[];
  teamMembers: any[];
  initialData?: any | null;
  onDelete?: () => void;
}) {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    contact_id: '', amount: '', product: '', deal_type: '', status: 'en_cours' as Deal['status'], notes: '', sold_by: '',
    loss_reason: '', loss_reason_category: '',
    payment_type: 'comptant' as 'comptant' | 'mensualites',
    payment_months: '',
    bank_fees_offered: false,
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        contact_id: initialData.contact_id || '',
        amount: initialData.amount?.toString() || '',
        product: initialData.product || '',
        deal_type: initialData.deal_type || '',
        status: initialData.status || 'en_cours',
        notes: initialData.notes || '',
        sold_by: initialData.sold_by || '',
        loss_reason: initialData.loss_reason || '',
        loss_reason_category: initialData.loss_reason_category || '',
        payment_type: initialData.payment_type || 'comptant',
        payment_months: initialData.payment_months?.toString() || '',
        bank_fees_offered: initialData.bank_fees_offered || false,
      });
    }
  }, [initialData]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) e.amount = 'Montant invalide';
    if (!form.status) e.status = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');

      const wasSignedBefore = isEdit && initialData.signed_at;
      let dealId = isEdit ? initialData.id : null;

      const paymentFields = {
        payment_type: form.payment_type,
        payment_months: form.payment_type === 'mensualites' ? (parseInt(form.payment_months) || null) : null,
        bank_fees_offered: form.payment_type === 'mensualites' ? form.bank_fees_offered : false,
      };

      if (isEdit) {
        const updateData: any = {
          contact_id: form.contact_id || null,
          amount: parseFloat(form.amount) || 0,
          product: form.product || null,
          deal_type: form.deal_type || null,
          status: form.status,
          notes: form.notes || null,
          sold_by: form.sold_by || null,
          loss_reason: form.status === 'annulee' ? (form.loss_reason || null) : null,
          loss_reason_category: form.status === 'annulee' ? (form.loss_reason_category || null) : null,
          ...paymentFields,
        };
        if (form.status === 'signee' && !initialData.signed_at) {
          updateData.signed_at = new Date().toISOString();
        }
        const { error } = await supabase.from('deals').update(updateData).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { data: newDeal, error } = await supabase.from('deals').insert({
          user_id: effectiveId,
          contact_id: form.contact_id || null,
          amount: parseFloat(form.amount) || 0,
          product: form.product || null,
          deal_type: form.deal_type || null,
          status: form.status,
          notes: form.notes || null,
          sold_by: form.sold_by || null,
          signed_at: form.status === 'signee' ? new Date().toISOString() : null,
          loss_reason: form.status === 'annulee' ? (form.loss_reason || null) : null,
          loss_reason_category: form.status === 'annulee' ? (form.loss_reason_category || null) : null,
          ...paymentFields,
        }).select('id').single();
        if (error) throw error;
        dealId = newDeal?.id;
      }

      // Auto-create commission when deal becomes "signée"
      if (form.status === 'signee' && !wasSignedBefore && dealId) {
        const amount = parseFloat(form.amount) || 0;
        const period = new Date().toISOString().slice(0, 7); // YYYY-MM
        // Check if commission already exists for this deal
        const { data: existing } = await supabase
          .from('commissions').select('id').eq('deal_id', dealId).maybeSingle();
        if (!existing) {
          await supabase.from('commissions').insert({
            user_id: effectiveId,
            period,
            type: 'directe',
            amount,
            source: 'vente',
            deal_id: dealId,
            status: 'validee',
            notes: form.product ? `Vente ${form.product}` : null,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      const wasJustSigned = form.status === 'signee' && !(isEdit && initialData?.signed_at);
      toast({
        title: isEdit ? 'Vente modifiée' : 'Vente créée',
        description: wasJustSigned ? `Commission de ${parseFloat(form.amount).toLocaleString('fr-FR')}€ créée automatiquement` : undefined,
      });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!validate()) return; mutation.mutate(); }} className="space-y-4">
      <div>
        <Label>Cliente</Label>
        <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
          <SelectContent>
            {contacts.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Montant (€) *</Label>
          <Input
            className={`h-11 ${errors.amount ? 'border-red-400 dark:border-red-600 focus:border-red-400' : ''}`}
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => { setForm({ ...form, amount: e.target.value }); if (errors.amount) setErrors(prev => ({ ...prev, amount: '' })); }}
          />
          {errors.amount && <p className="text-[10px] text-red-500 mt-1">{errors.amount}</p>}
        </div>
        <div>
          <Label>Statut</Label>
          <Select value={form.status} onValueChange={(v) => { setForm({ ...form, status: v as Deal['status'] }); if (errors.status) setErrors(prev => ({ ...prev, status: '' })); }}>
            <SelectTrigger className={`h-11 ${errors.status ? 'border-red-400 dark:border-red-600' : ''}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DEAL_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.status && <p className="text-[10px] text-red-500 mt-1">{errors.status}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Produit / Pack</Label>
          <Select value={form.product} onValueChange={(v) => setForm({ ...form, product: v })}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
            <SelectContent>
              {HYLA_PRODUCTS.map(p => (
                <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Type de vente</Label>
          <Select value={form.deal_type} onValueChange={(v) => setForm({ ...form, deal_type: v })}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="directe">Vente directe</SelectItem>
              <SelectItem value="parrainage">Parrainage</SelectItem>
              <SelectItem value="salon">Salon / Foire</SelectItem>
              <SelectItem value="en_ligne">Vente en ligne</SelectItem>
              <SelectItem value="reseau_social">Réseau social</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {teamMembers.length > 0 && (
        <div>
          <Label>Vendu par (membre réseau)</Label>
          <Select value={form.sold_by || '__moi__'} onValueChange={(v) => setForm({ ...form, sold_by: v === '__moi__' ? '' : v })}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Moi-même" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__moi__">👤 Moi-même</SelectItem>
              {teamMembers.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">Permet d'estimer les commissions réseau avant l'import</p>
        </div>
      )}
      {/* ── Mode de paiement ── */}
      <div className="space-y-2.5">
        <Label>Mode de paiement</Label>
        <div className="flex gap-2">
          {(['comptant', 'mensualites'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setForm({ ...form, payment_type: type, payment_months: '', bank_fees_offered: false })}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                form.payment_type === type
                  ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                  : 'bg-card text-muted-foreground border-border hover:border-blue-300'
              }`}
            >
              {type === 'comptant' ? '💳 Comptant' : '📅 Mensualités'}
            </button>
          ))}
        </div>
        {form.payment_type === 'mensualites' && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3 space-y-3">
            <div>
              <Label className="text-xs text-blue-800 dark:text-blue-300">Durée (mois) *</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={10}
                  max={72}
                  placeholder="ex : 36"
                  value={form.payment_months}
                  onChange={e => setForm({ ...form, payment_months: e.target.value })}
                  className="h-10 w-28 text-sm"
                />
                <div className="flex gap-1 flex-wrap">
                  {[12, 24, 36, 48, 60, 72].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm({ ...form, payment_months: m.toString() })}
                      className={`text-[11px] px-2 py-1 rounded-lg font-medium transition-colors ${
                        form.payment_months === m.toString()
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">Des frais bancaires s'appliquent sur les paiements en plusieurs fois</p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                onClick={() => setForm({ ...form, bank_fees_offered: !form.bank_fees_offered })}
                className={`h-5 w-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
                  form.bank_fees_offered
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-blue-300 bg-white dark:bg-blue-950 group-hover:border-blue-500'
                }`}
              >
                {form.bank_fees_offered && <span className="text-white text-[10px] font-bold">✓</span>}
              </div>
              <span className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                Frais bancaires offerts par la conseillère
              </span>
            </label>
            {form.bank_fees_offered && (
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1.5 rounded-lg">
                ✓ La conseillère prend en charge les frais bancaires — le client ne paie que le prix du produit
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
      {(form.status === 'annulee') && (
        <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800">
          <Label className="text-red-700 dark:text-red-400">Raison de l'annulation</Label>
          <Select value={form.loss_reason_category} onValueChange={(v) => setForm({...form, loss_reason_category: v})}>
            <SelectTrigger><SelectValue placeholder="Catégorie..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="prix">💰 Prix trop élevé</SelectItem>
              <SelectItem value="concurrent">🏢 Parti à la concurrence</SelectItem>
              <SelectItem value="pas_interesse">❌ Pas intéressé</SelectItem>
              <SelectItem value="pas_de_reponse">📵 Plus de réponse</SelectItem>
              <SelectItem value="besoin_reflechi">🤔 Besoin de réflexion</SelectItem>
              <SelectItem value="autre">💬 Autre</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Détails (optionnel)..."
            value={form.loss_reason}
            onChange={(e) => setForm({...form, loss_reason: e.target.value})}
            className="text-sm"
          />
        </div>
      )}
      {form.status === 'signee' && parseFloat(form.amount) > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <span className="text-emerald-600 text-xs font-medium">Commission auto :</span>
          <span className="text-emerald-700 text-sm font-bold">{parseFloat(form.amount).toLocaleString('fr-FR')} €</span>
          <span className="text-emerald-500 text-[10px]">sera créée à la validation</span>
        </div>
      )}
      <button type="submit" disabled={mutation.isPending} className="w-full py-3 bg-[#3b82f6] text-white font-semibold rounded-xl hover:bg-[#3b82f6]/90 disabled:opacity-50">
        {mutation.isPending ? (isEdit ? 'Enregistrement...' : 'Création...') : (isEdit ? 'Enregistrer' : 'Créer la vente')}
      </button>
      {isEdit && onDelete && (
        <button type="button" onClick={onDelete} className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700">
          Supprimer
        </button>
      )}
    </form>
  );
}

function exportToCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(';'),
    ...rows.map(row => headers.map(h => {
      const val = row[h] ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(';') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    }).join(';'))
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Deals() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any | null>(null);
  const [view, setView] = useState<'list' | 'kanban'>('list');

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const [drawerDeal, setDrawerDeal] = useState<any | null>(null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('deals')
        .select('*, contacts(first_name, last_name), seller:team_members!sold_by(id, first_name, last_name)')
        .eq('user_id', effectiveId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-list', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('contacts').select('id, first_name, last_name').eq('user_id', effectiveId).order('first_name');
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-deals', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('team_members').select('id, first_name, last_name').eq('user_id', effectiveId).eq('status', 'actif').order('first_name');
      return data || [];
    },
    enabled: !!effectiveId,
    staleTime: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await supabase.from('deals').delete().eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({ title: 'Vente supprimée' });
      setEditingDeal(null);
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const handleStatusChange = async (dealId: string, status: string) => {
    await supabase.from('deals').update({ status }).eq('id', dealId);
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    setDrawerDeal(null);
  };

  const selectedPeriod = `${selectedYear}-${selectedMonth}`;

  const filtered = deals.filter((d: any) => {
    const name = d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : '';
    const matchesSearch = !search || `${name} ${d.product || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    // Filtre par mois : basé sur signed_at ou created_at
    const dateStr = d.signed_at || d.created_at;
    const matchesPeriod = dateStr && dateStr.startsWith(selectedPeriod);
    return matchesSearch && matchesStatus && matchesPeriod;
  });

  // 'signee' = estimé (manuel) + 'livree' = confirmé par TRV
  const signedInPeriod = deals.filter((d: any) => {
    if (d.status !== 'signee' && d.status !== 'livree') return false;
    const dateStr = d.signed_at || d.created_at;
    return dateStr && dateStr.startsWith(selectedPeriod);
  });

  const totalMois = signedInPeriod.reduce((sum: number, d: any) => sum + d.amount, 0);
  const nbSignees = signedInPeriod.length;
  const commissionEstimee = getHylaCommission(nbSignees);

  // Pending deals with sold_by → commission réseau estimée
  const pendingDeals = deals.filter((d: any) => d.status === 'en_cours' || d.status === 'en_attente');
  const pendingWithSeller = pendingDeals.filter((d: any) => d.sold_by);
  const pendingReseauEstim = pendingWithSeller.length * 30;

  return (
    <AppLayout
      title="Ventes"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(
              filtered.map((deal: any) => ({
                Contact: deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : '',
                Produit: deal.product || '',
                Montant: deal.amount || 0,
                Statut: DEAL_STATUS_LABELS[deal.status as keyof typeof DEAL_STATUS_LABELS] || deal.status,
                'Vendu par': deal.sold_by || '',
                Notes: deal.notes || '',
                'Créé le': new Date(deal.created_at).toLocaleDateString('fr-FR'),
                'Signé le': deal.signed_at ? new Date(deal.signed_at).toLocaleDateString('fr-FR') : '',
              })),
              `ventes-${new Date().toISOString().slice(0,10)}.csv`
            )}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground font-semibold rounded-xl border border-border hover:bg-muted/80 active:scale-[0.98] transition-all"
          >
            <Download className="h-4 w-4" />
            Exporter
          </button>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <button className="inline-flex items-center px-4 py-2 bg-[#3b82f6] text-white font-semibold rounded-xl hover:bg-[#3b82f6]/90 text-sm">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle vente
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nouvelle vente</DialogTitle></DialogHeader>
              <DealForm onSuccess={() => setShowForm(false)} contacts={contacts} teamMembers={teamMembers} />
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {/* Edit dialog */}
      <Dialog open={!!editingDeal} onOpenChange={(open) => { if (!open) setEditingDeal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier la vente</DialogTitle></DialogHeader>
          {editingDeal && (
            <DealForm
              onSuccess={() => setEditingDeal(null)}
              contacts={contacts}
              teamMembers={teamMembers}
              initialData={editingDeal}
              onDelete={() => deleteMutation.mutate(editingDeal.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {/* KPI row */}
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Machines vendues — {MONTHS_FR[parseInt(selectedMonth) - 1]} {selectedYear}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{nbSignees}</p>
          </div>
          <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-2xl p-4 text-white">
            <p className="text-[10px] uppercase font-semibold opacity-80">Commission estimée</p>
            <p className="text-2xl font-bold mt-1">{commissionEstimee.toLocaleString('fr-FR')} €</p>
          </div>
        </div>

        {/* Barème Hyla */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
          <p className="text-xs font-semibold text-foreground mb-2">Barème commissions ventes</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {HYLA_COMMISSION_SCALE.map((s, i) => (
              <div key={i} className={`flex-shrink-0 text-center px-2.5 py-1.5 rounded-lg text-[10px] font-medium border ${
                nbSignees >= s.machines ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-muted border-border text-muted-foreground'
              }`}>
                <div className="font-bold text-xs">{s.commission}€</div>
                <div>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">CA total</p>
            <p className="text-lg font-bold text-foreground mt-1">{totalMois.toLocaleString('fr-FR')} €</p>
          </div>
          <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">En cours</p>
            <p className="text-lg font-bold text-amber-600 mt-1">{pendingDeals.length}</p>
          </div>
        </div>

        {/* Estimation commissions réseau en cours */}
        {pendingWithSeller.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">Commissions réseau en attente</p>
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">estimation</span>
            </div>
            <div className="space-y-2">
              {pendingWithSeller.map((d: any) => {
                const seller = d.team_members;
                return (
                  <div key={d.id} className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {seller ? `${seller.first_name} ${seller.last_name}` : 'Membre réseau'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {d.product || 'Sans produit'} • {d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-700">+30 €</p>
                      <p className="text-[10px] text-muted-foreground">réseau</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">{pendingWithSeller.length} vente(s) en cours</span>
              </div>
              <span className="text-sm font-bold text-amber-800">~{pendingReseauEstim} € estimés</span>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* Filtres mois/année pour les KPIs */}
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS_FR.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(DEAL_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setView('list')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Liste</button>
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'kanban' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Kanban</button>
          </div>
        </div>

        {/* Table */}
        {view === 'list' && isLoading && <SkeletonTable rows={4} />}
        {view === 'list' && !isLoading && (
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Produit</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Montant</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Vendu par</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((deal: any) => (
                  <tr key={deal.id} className="hover:bg-muted cursor-pointer" onClick={() => setDrawerDeal(deal)}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{deal.product || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-foreground">{deal.amount.toLocaleString('fr-FR')} €</span>
                      {(deal as any).payment_type === 'mensualites' && (
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[10px] text-blue-500">
                            {(deal as any).payment_months ? `${(deal as any).payment_months}×` : 'Mens.'}
                          </span>
                          {(deal as any).bank_fees_offered && <span className="text-[10px] text-emerald-500" title="Frais offerts">🎁</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${DEAL_STATUS_COLORS[deal.status as keyof typeof DEAL_STATUS_COLORS]}`}>
                        {DEAL_STATUS_LABELS[deal.status as keyof typeof DEAL_STATUS_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {(deal as any).seller ? (
                        <span className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                          {(deal as any).seller.first_name} {(deal as any).seller.last_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(deal.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Aucune vente</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Kanban */}
        {view === 'kanban' && isLoading && (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="min-w-[220px] flex-shrink-0 space-y-2">
                <div className="h-8 rounded-xl bg-muted animate-pulse" />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ))}
          </div>
        )}
        {view === 'kanban' && !isLoading && (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {KANBAN_COLS.map(col => {
              const colDeals = filtered.filter((d: any) => d.status === col.status);
              return (
                <div key={col.status}
                  className="min-w-[220px] flex-shrink-0"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const dealId = e.dataTransfer.getData('dealId');
                    if (dealId) {
                      await supabase.from('deals').update({ status: col.status }).eq('id', dealId);
                      queryClient.invalidateQueries({ queryKey: ['deals'] });
                    }
                  }}
                >
                  <div className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-xl ${col.bg}`}>
                    <span className={`text-xs font-bold ${col.text}`}>{col.label}</span>
                    <span className={`ml-auto text-xs font-semibold ${col.text} opacity-70`}>{colDeals.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colDeals.map((deal: any) => (
                      <div key={deal.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('dealId', deal.id); (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).dataset.dragging = 'true'; }}
                        onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; delete (e.currentTarget as HTMLElement).dataset.dragging; }}
                        onClick={(e) => { if ((e.currentTarget as HTMLElement).dataset.dragging) return; setDrawerDeal(deal); }}
                        className="bg-card rounded-xl border border-border p-3 cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <p className="text-sm font-semibold text-foreground truncate">
                          {deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : 'Sans contact'}
                        </p>
                        {deal.product && <p className="text-xs text-muted-foreground mt-0.5 truncate">{deal.product}</p>}
                        <p className="text-sm font-bold text-[#3b82f6] mt-1">{(deal.amount || 0).toLocaleString('fr-FR')} €</p>
                        {(deal as any).seller && (
                          <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1 mt-1 w-fit">
                            <Users className="h-2.5 w-2.5" />
                            {(deal as any).seller.first_name}
                          </span>
                        )}
                        {deal.signed_at && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Signé le {new Date(deal.signed_at).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    ))}
                    {colDeals.length === 0 && (
                      <div className="border-2 border-dashed border-border rounded-xl p-4 text-center text-xs text-muted-foreground">
                        Aucune vente
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <DealDrawer
        deal={drawerDeal}
        onClose={() => setDrawerDeal(null)}
        onEdit={(d) => { setEditingDeal(d); setShowForm(true); }}
        onDelete={(id) => deleteMutation.mutate(id)}
        onStatusChange={handleStatusChange}
      />
    </AppLayout>
  );
}
