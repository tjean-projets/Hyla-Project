import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS, HYLA_PRODUCTS, HYLA_COMMISSION_SCALE, getHylaCommission } from '@/lib/supabase';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Clock, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'>;

function DealForm({ onSuccess, contacts, teamMembers, initialData, onDelete }: {
  onSuccess: () => void;
  contacts: Tables<'contacts'>[];
  teamMembers: any[];
  initialData?: any | null;
  onDelete?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    contact_id: '', amount: '', product: '', deal_type: '', status: 'en_cours' as Deal['status'], notes: '', sold_by: '',
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
      });
    }
  }, [initialData]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');

      const wasSignedBefore = isEdit && initialData.signed_at;
      let dealId = isEdit ? initialData.id : null;

      if (isEdit) {
        const updateData: any = {
          contact_id: form.contact_id || null,
          amount: parseFloat(form.amount) || 0,
          product: form.product || null,
          deal_type: form.deal_type || null,
          status: form.status,
          notes: form.notes || null,
          sold_by: form.sold_by || null,
        };
        if (form.status === 'signee' && !initialData.signed_at) {
          updateData.signed_at = new Date().toISOString();
        }
        const { error } = await supabase.from('deals').update(updateData).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { data: newDeal, error } = await supabase.from('deals').insert({
          user_id: user.id,
          contact_id: form.contact_id || null,
          amount: parseFloat(form.amount) || 0,
          product: form.product || null,
          deal_type: form.deal_type || null,
          status: form.status,
          notes: form.notes || null,
          sold_by: form.sold_by || null,
          signed_at: form.status === 'signee' ? new Date().toISOString() : null,
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
            user_id: user.id,
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
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
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
          <Input className="h-11" type="number" step="0.01" placeholder="0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </div>
        <div>
          <Label>Statut</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Deal['status'] })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DEAL_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <p className="text-[10px] text-gray-400 mt-1">Permet d'estimer les commissions réseau avant l'import</p>
        </div>
      )}
      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
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

export default function Deals() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any | null>(null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('deals')
        .select('*, contacts(first_name, last_name), team_members:sold_by(first_name, last_name)')
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

  const filtered = deals.filter((d: any) => {
    const name = d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : '';
    const matchesSearch = !search || `${name} ${d.product || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalMois = deals.filter((d: any) => d.status === 'signee').reduce((sum: number, d: any) => sum + d.amount, 0);
  const nbSignees = deals.filter((d: any) => d.status === 'signee').length;
  const commissionEstimee = getHylaCommission(nbSignees);

  // Pending deals with sold_by → commission réseau estimée (30€/vente pour manager)
  const pendingDeals = deals.filter((d: any) => d.status === 'en_cours' || d.status === 'en_attente');
  const pendingWithSeller = pendingDeals.filter((d: any) => d.sold_by);
  const pendingReseauEstim = pendingWithSeller.length * 30; // 30€ réseau/vente manager

  return (
    <AppLayout
      title="Ventes"
      actions={
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-[10px] text-gray-400 uppercase font-semibold">Machines vendues</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{nbSignees}</p>
          </div>
          <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-2xl p-4 text-white">
            <p className="text-[10px] uppercase font-semibold opacity-80">Commission estimée</p>
            <p className="text-2xl font-bold mt-1">{commissionEstimee.toLocaleString('fr-FR')} €</p>
          </div>
        </div>

        {/* Barème Hyla */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-900 mb-2">Barème commissions ventes</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {HYLA_COMMISSION_SCALE.map((s, i) => (
              <div key={i} className={`flex-shrink-0 text-center px-2.5 py-1.5 rounded-lg text-[10px] font-medium border ${
                nbSignees >= s.machines ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-400'
              }`}>
                <div className="font-bold text-xs">{s.commission}€</div>
                <div>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-[10px] text-gray-400 uppercase font-semibold">CA total</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{totalMois.toLocaleString('fr-FR')} €</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-[10px] text-gray-400 uppercase font-semibold">En cours</p>
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
                      <p className="text-xs font-semibold text-gray-800">
                        {seller ? `${seller.first_name} ${seller.last_name}` : 'Membre réseau'}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {d.product || 'Sans produit'} • {d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-700">+30 €</p>
                      <p className="text-[10px] text-gray-400">réseau</p>
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
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Produit</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Montant</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Vendu par</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((deal: any) => (
                <tr key={deal.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setEditingDeal(deal)}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{deal.product || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{deal.amount.toLocaleString('fr-FR')} €</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${DEAL_STATUS_COLORS[deal.status as keyof typeof DEAL_STATUS_COLORS]}`}>
                      {DEAL_STATUS_LABELS[deal.status as keyof typeof DEAL_STATUS_LABELS]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {deal.team_members ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {deal.team_members.first_name} {deal.team_members.last_name}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {new Date(deal.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">{isLoading ? 'Chargement...' : 'Aucune vente'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
