import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase, CONTACT_STATUS_LABELS, CONTACT_STATUS_COLORS, PRIORITY_COLORS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, Phone, Mail, MoreHorizontal, GripVertical, Network, Trash2, Settings } from 'lucide-react';
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

function ContactForm({ onSuccess, stages, initialData, onDelete, teamMembers, onAddToNetwork }: {
  onSuccess: () => void;
  stages: Tables<'pipeline_stages'>[];
  initialData?: Contact | null;
  onDelete?: () => void;
  teamMembers?: any[];
  onAddToNetwork?: (contact: Contact) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  // Check if this contact is already in the network
  const isInNetwork = isEdit && teamMembers?.some(m => m.contact_id === initialData?.id);

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
      {isEdit && !isInNetwork && onAddToNetwork && (
        <button
          type="button"
          onClick={() => onAddToNetwork(initialData)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl"
        >
          <Network className="h-4 w-4" />
          Ajouter au réseau
        </button>
      )}
      {isEdit && isInNetwork && (
        <div className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 font-medium rounded-xl border border-emerald-200">
          <Network className="h-4 w-4" />
          Déjà dans le réseau
        </div>
      )}
      {isEdit && (
        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
        </button>
      )}
    </form>
  );
}

export default function Contacts() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [view, setView] = useState<'list' | 'pipeline'>('list');
  const [showStageManager, setShowStageManager] = useState(false);
  const [editStages, setEditStages] = useState<{id?: string, name: string, color: string, position: number}[]>([]);
  const [draggingContact, setDraggingContact] = useState<Contact | null>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', effectiveId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('user_id', effectiveId)
        .order('position');
      return data || [];
    },
    enabled: !!effectiveId,
  });

  // Fetch team_members to know which contacts are already in the network
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('team_members')
        .select('id, contact_id, first_name, last_name')
        .eq('user_id', effectiveId);
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const addToNetwork = useMutation({
    mutationFn: async (contact: Contact) => {
      if (!user) throw new Error('Non connecté');
      const baseSlug = `${contact.first_name}-${contact.last_name}`
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      // Find a unique slug by appending a suffix if needed
      let slug = baseSlug;
      let suffix = 1;
      while (true) {
        const { data: existing } = await supabase
          .from('team_members').select('id').eq('slug', slug).maybeSingle();
        if (!existing) break;
        suffix++;
        slug = `${baseSlug}-${suffix}`;
      }
      // Generate unique Hyla ID (HYL-XXXXX)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let hylaId = '';
      do {
        hylaId = 'HYL-' + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const { data: dup } = await supabase.from('team_members').select('id').eq('internal_id', hylaId).maybeSingle();
        if (!dup) break;
      } while (true);

      const { error } = await supabase.from('team_members').insert({
        user_id: user.id,
        contact_id: contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone: contact.phone || null,
        email: contact.email || null,
        level: 1,
        joined_at: new Date().toISOString().split('T')[0],
        matching_names: [`${contact.first_name} ${contact.last_name}`.toLowerCase()],
        slug,
        status: 'actif',
        internal_id: hylaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Membre ajouté au réseau' });
      setEditingContact(null);
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  // Set of contact_ids that are already in the network
  const networkContactIds = new Set(teamMembers.filter(m => m.contact_id).map(m => m.contact_id));

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
        <button
          onClick={() => { setEditingContact(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white font-semibold rounded-xl active:bg-[#3b82f6]/80"
        >
          <Plus className="h-4 w-4" />
          Nouveau contact
        </button>
      }
    >
      {/* New contact dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau contact</DialogTitle></DialogHeader>
          <ContactForm onSuccess={() => setShowForm(false)} stages={stages} teamMembers={teamMembers} />
        </DialogContent>
      </Dialog>

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
            {view === 'pipeline' && (
              <button
                onClick={() => { setEditStages(stages.map(s => ({...s}))); setShowStageManager(true); }}
                className="px-2 py-1.5 text-gray-400 hover:text-gray-600"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
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
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{contact.first_name} {contact.last_name}</span>
                        {networkContactIds.has(contact.id) && (
                          <Network className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        )}
                      </div>
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
          <>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {contactsByStage.map((stage) => (
                <div
                  key={stage.id}
                  className="min-w-[200px] max-w-[260px] flex-shrink-0 rounded-2xl border-2 border-transparent transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('bg-blue-50', 'border-blue-300');
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300');
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300');
                    const contactId = e.dataTransfer.getData('contactId');
                    if (contactId) {
                      await supabase.from('contacts').update({ pipeline_stage_id: stage.id }).eq('id', contactId);
                      queryClient.invalidateQueries({ queryKey: ['contacts'] });
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm font-semibold text-gray-700">{stage.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{stage.contacts.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stage.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('contactId', contact.id);
                          e.dataTransfer.setData('fromStageId', stage.id);
                          (e.currentTarget as HTMLElement).style.opacity = '0.5';
                        }}
                        onDragEnd={(e) => {
                          (e.currentTarget as HTMLElement).style.opacity = '1';
                        }}
                        onTouchStart={() => setDraggingContact(contact)}
                        className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          if (!draggingContact) setEditingContact(contact);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                          <p className="font-medium text-sm text-gray-900">{contact.first_name} {contact.last_name}</p>
                          {networkContactIds.has(contact.id) && (
                            <Network className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                          )}
                        </div>
                        {contact.phone && <p className="text-xs text-gray-400 mt-1 ml-5">{contact.phone}</p>}
                        <div className="flex items-center gap-2 mt-2 ml-5">
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

            {/* Touch drag indicator */}
            {draggingContact && (
              <div className="fixed bottom-20 left-4 right-4 bg-white rounded-2xl shadow-xl border p-3 z-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 text-center flex-1">Déplacer {draggingContact.first_name} vers :</p>
                  <button onClick={() => setDraggingContact(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2">✕</button>
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {stages.map(s => (
                    <button
                      key={s.id}
                      onClick={async () => {
                        await supabase.from('contacts').update({ pipeline_stage_id: s.id }).eq('id', draggingContact.id);
                        queryClient.invalidateQueries({ queryKey: ['contacts'] });
                        setDraggingContact(null);
                      }}
                      className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border"
                      style={{ borderColor: s.color, color: s.color }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
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
              teamMembers={teamMembers}
              onAddToNetwork={(contact) => addToNetwork.mutate(contact)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Stage Manager Dialog */}
      <Dialog open={showStageManager} onOpenChange={setShowStageManager}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gérer les étapes du pipeline</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {editStages.sort((a, b) => a.position - b.position).map((stage, idx) => (
              <div key={stage.id || idx} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />
                <div
                  className="h-4 w-4 rounded-full flex-shrink-0 cursor-pointer"
                  style={{ backgroundColor: stage.color }}
                  onClick={() => {
                    const colors = ['#3b82f6','#f59e0b','#8b5cf6','#ec4899','#22c55e','#ef4444','#f97316','#06b6d4'];
                    const currentIdx = colors.indexOf(stage.color);
                    const nextColor = colors[(currentIdx + 1) % colors.length];
                    const updated = [...editStages];
                    updated[idx] = {...updated[idx], color: nextColor};
                    setEditStages(updated);
                  }}
                />
                <Input
                  className="h-8 text-sm flex-1"
                  value={stage.name}
                  onChange={(e) => {
                    const updated = [...editStages];
                    updated[idx] = {...updated[idx], name: e.target.value};
                    setEditStages(updated);
                  }}
                />
                <button
                  onClick={() => setEditStages(editStages.filter((_, i) => i !== idx))}
                  className="p-1 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setEditStages([...editStages, { name: '', color: '#3b82f6', position: editStages.length + 1 }])}
            className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300"
          >
            + Ajouter une étape
          </button>
          <button
            onClick={async () => {
              if (!user) return;
              // Delete removed stages
              const existingIds = stages.map(s => s.id);
              const keptIds = editStages.filter(s => s.id).map(s => s.id!);
              const toDelete = existingIds.filter(id => !keptIds.includes(id));
              for (const id of toDelete) {
                // Move contacts from deleted stage to first kept stage
                if (keptIds.length > 0) {
                  await supabase.from('contacts').update({ pipeline_stage_id: keptIds[0] }).eq('pipeline_stage_id', id);
                }
                await supabase.from('pipeline_stages').delete().eq('id', id);
              }
              // Upsert remaining
              for (let i = 0; i < editStages.length; i++) {
                const s = editStages[i];
                if (s.id) {
                  await supabase.from('pipeline_stages').update({ name: s.name, color: s.color, position: i + 1 }).eq('id', s.id);
                } else {
                  await supabase.from('pipeline_stages').insert({ user_id: user.id, name: s.name, color: s.color, position: i + 1 });
                }
              }
              queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
              setShowStageManager(false);
              toast({ title: 'Pipeline mis à jour' });
            }}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl"
          >
            Sauvegarder
          </button>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
