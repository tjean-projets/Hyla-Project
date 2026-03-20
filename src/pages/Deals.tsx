import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'>;

function DealForm({ onSuccess, contacts, initialData, onDelete }: {
  onSuccess: () => void;
  contacts: Tables<'contacts'>[];
  initialData?: any | null;
  onDelete?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    contact_id: '', amount: '', product: '', deal_type: '', status: 'en_cours' as Deal['status'], notes: '',
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
      });
    }
  }, [initialData]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');

      if (isEdit) {
        const updateData: any = {
          contact_id: form.contact_id || null,
          amount: parseFloat(form.amount) || 0,
          product: form.product || null,
          deal_type: form.deal_type || null,
          status: form.status,
          notes: form.notes || null,
        };
        // Set signed_at if status changed to 'signee' and it wasn't already set
        if (form.status === 'signee' && !initialData.signed_at) {
          updateData.signed_at = new Date().toISOString();
        }
        const { error } = await supabase.from('deals').update(updateData).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('deals').insert({
          user_id: user.id,
          contact_id: form.contact_id || null,
          amount: parseFloat(form.amount) || 0,
          product: form.product || null,
          deal_type: form.deal_type || null,
          status: form.status,
          notes: form.notes || null,
          signed_at: form.status === 'signee' ? new Date().toISOString() : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({ title: isEdit ? 'Vente modifiée' : 'Vente créée' });
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
          <Input className="h-11" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
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
          <Input className="h-11" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
        </div>
        <div>
          <Label>Type de vente</Label>
          <Input className="h-11" placeholder="Directe, Parrainage..." value={form.deal_type} onChange={(e) => setForm({ ...form, deal_type: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any | null>(null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('deals')
        .select('*, contacts(first_name, last_name), team_members:sold_by(first_name, last_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-list', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('contacts').select('id, first_name, last_name').eq('user_id', user.id).order('first_name');
      return data || [];
    },
    enabled: !!user,
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
            <DealForm onSuccess={() => setShowForm(false)} contacts={contacts} />
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
              initialData={editingDeal}
              onDelete={() => deleteMutation.mutate(editingDeal.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-400 uppercase font-semibold">Total signées</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{totalMois.toLocaleString('fr-FR')} €</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-400 uppercase font-semibold">Nb ventes</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{deals.filter((d: any) => d.status === 'signee').length}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-400 uppercase font-semibold">En attente</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{deals.filter((d: any) => d.status === 'en_attente' || d.status === 'en_cours').length}</p>
          </div>
        </div>

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
                <th className="text-left px-4 py-3 font-medium text-gray-500">Produit</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Montant</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((deal: any) => (
                <tr key={deal.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setEditingDeal(deal)}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{deal.product || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{deal.amount.toLocaleString('fr-FR')} €</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${DEAL_STATUS_COLORS[deal.status as keyof typeof DEAL_STATUS_COLORS]}`}>
                      {DEAL_STATUS_LABELS[deal.status as keyof typeof DEAL_STATUS_LABELS]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {new Date(deal.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">{isLoading ? 'Chargement...' : 'Aucune vente'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
