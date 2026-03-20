import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, CONTACT_STATUS_LABELS, CONTACT_STATUS_COLORS, PRIORITY_COLORS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, Phone, Mail, MoreHorizontal, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;

function ContactForm({ onSuccess, stages, initialData, onDelete }: {
  onSuccess: () => void;
  stages: Tables<'pipeline_stages'>[];
  initialData?: Contact | null;
  onDelete?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    address: initialData?.address || '',
    source: initialData?.source || '',
    status: (initialData?.status || 'prospect') as Contact['status'],
    priority: (initialData?.priority || 'normale') as Contact['priority'],
    pipeline_stage_id: initialData?.pipeline_stage_id || stages[0]?.id || '',
    notes: initialData?.notes || '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      if (isEdit) {
        const { error } = await supabase.from('contacts').update({
          ...form,
          pipeline_stage_id: form.pipeline_stage_id || null,
        }).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('contacts').insert({
          user_id: user.id,
          ...form,
          pipeline_stage_id: form.pipeline_stage_id || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: isEdit ? 'Contact modifié' : 'Contact créé' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!initialData) return;
      const { error } = await supabase.from('contacts').delete().eq('id', initialData.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: 'Contact supprimé' });
      onDelete?.();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prénom *</Label>
          <Input className="h-11" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
        </div>
        <div>
          <Label>Nom *</Label>
          <Input className="h-11" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Téléphone</Label>
          <Input className="h-11" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input className="h-11" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Adresse</Label>
        <Input className="h-11" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Statut</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Contact['status'] })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CONTACT_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Source</Label>
          <Input className="h-11" placeholder="Bouche-à-oreille, Facebook..." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-3 bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-semibold rounded-xl disabled:opacity-50"
      >
        {mutation.isPending ? (isEdit ? 'Enregistrement...' : 'Création...') : (isEdit ? 'Enregistrer les modifications' : 'Créer le contact')}
      </button>
      {isEdit && (
        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50"
        >
          {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
        </button>
      )}
    </form>
  );
}

export default function Contacts() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [view, setView] = useState<'list' | 'pipeline'>('list');

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('user_id', user.id)
        .order('position');
      return data || [];
    },
    enabled: !!user,
  });

  const filtered = contacts.filter((c) => {
    const matchesSearch = !search || `${c.first_name} ${c.last_name} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Group contacts by pipeline stage for Kanban view
  const contactsByStage = stages.map(stage => ({
    ...stage,
    contacts: contacts.filter(c => c.pipeline_stage_id === stage.id),
  }));

  return (
    <AppLayout
      title="Contacts"
      actions={
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="bg-[#3b82f6] hover:bg-[#3b82f6]/90">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nouveau contact</DialogTitle></DialogHeader>
            <ContactForm onSuccess={() => setShowForm(false)} stages={stages} />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher un contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(CONTACT_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
            >
              Liste
            </button>
            <button
              onClick={() => setView('pipeline')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'pipeline' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
            >
              Pipeline
            </button>
          </div>
        </div>

        {/* List view */}
        {view === 'list' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Créé le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setEditingContact(contact)}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{contact.first_name} {contact.last_name}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-3 text-gray-500">
                        {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
                        {contact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CONTACT_STATUS_COLORS[contact.status]}`}>
                        {CONTACT_STATUS_LABELS[contact.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{contact.source || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                      {new Date(contact.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                      {isLoading ? 'Chargement...' : 'Aucun contact trouvé'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pipeline / Kanban view */}
        {view === 'pipeline' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {contactsByStage.map((stage) => (
              <div key={stage.id} className="min-w-[260px] max-w-[280px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm font-semibold text-gray-700">{stage.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{stage.contacts.length}</span>
                </div>
                <div className="space-y-2">
                  {stage.contacts.map((contact) => (
                    <div key={contact.id} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setEditingContact(contact)}>
                      <p className="font-medium text-sm text-gray-900">{contact.first_name} {contact.last_name}</p>
                      {contact.phone && <p className="text-xs text-gray-400 mt-1">{contact.phone}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${CONTACT_STATUS_COLORS[contact.status]}`}>
                          {CONTACT_STATUS_LABELS[contact.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                  {stage.contacts.length === 0 && (
                    <div className="bg-gray-50 rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
                      Aucun contact
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit contact dialog */}
      <Dialog open={!!editingContact} onOpenChange={(open) => { if (!open) setEditingContact(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier le contact</DialogTitle></DialogHeader>
          {editingContact && (
            <ContactForm
              key={editingContact.id}
              initialData={editingContact}
              stages={stages}
              onSuccess={() => setEditingContact(null)}
              onDelete={() => setEditingContact(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
