import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase, CONTACT_STATUS_LABELS, CONTACT_STATUS_COLORS, PRIORITY_COLORS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, Phone, Mail, MoreHorizontal, GripVertical, Trash2, Settings, Download, CalendarPlus, ClipboardList, AlertTriangle, UserPlus, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import { SkeletonTable } from '@/components/ui/skeleton-card';

type Contact = Tables<'contacts'>;

// ── Fuzzy name matching (local copy from Imports.tsx) ──
function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function matchScore(a: string, b: string): number {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 85;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 100;
  let matches = 0;
  for (let i = 0; i < Math.min(na.length, nb.length); i++) {
    if (na[i] === nb[i]) matches++;
  }
  return Math.round((matches / maxLen) * 100);
}

function ContactForm({ onSuccess, stages, initialData, onDelete, isInTeam, onAddToTeam }: {
  onSuccess: () => void;
  stages: Tables<'pipeline_stages'>[];
  initialData?: Contact | null;
  onDelete?: () => void;
  isInTeam?: boolean;
  onAddToTeam?: (contact: Contact) => void;
}) {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  // ── Form state — doit être déclaré AVANT le useEffect qui l'utilise ──
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

  // ── Duplicate detection (creation mode only) ──
  const [duplicates, setDuplicates] = useState<{ id: string; first_name: string; last_name: string; phone: string | null; email: string | null }[]>([]);

  useEffect(() => {
    if (isEdit) return;
    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    if (!firstName || !lastName) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (!user) return;
      const fullName = `${firstName} ${lastName}`;
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone, email')
        .eq('user_id', effectiveId)
        .ilike('last_name', `%${lastName}%`)
        .limit(3);
      if (!data) return;
      const matches = data.filter(d => {
        const existing = `${d.first_name} ${d.last_name}`;
        return matchScore(fullName, existing) >= 75;
      });
      setDuplicates(matches);
    }, 600);
    return () => clearTimeout(timer);
  }, [form.first_name, form.last_name, isEdit, user]);

  const [showRdvForm, setShowRdvForm] = useState(false);
  const [rdvForm, setRdvForm] = useState({ title: '', type: 'rdv', date: '', duration: '60', location: '' });

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', type: 'relance', due_date: '', notes: '' });

  const createRdv = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const { error } = await supabase.from('appointments').insert({
        user_id: effectiveId,
        contact_id: initialData!.id,
        title: rdvForm.title,
        type: rdvForm.type as any,
        date: rdvForm.date,
        duration: parseInt(rdvForm.duration) || 60,
        location: rdvForm.location || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'RDV créé', description: `RDV planifié avec ${initialData?.first_name}` });
      setShowRdvForm(false);
      setRdvForm({ title: '', type: 'rdv', date: '', duration: '60', location: '' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const createTask = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const { error } = await supabase.from('tasks').insert({
        user_id: effectiveId,
        contact_id: initialData!.id,
        title: taskForm.title,
        type: taskForm.type as any,
        due_date: taskForm.due_date || null,
        notes: taskForm.notes || null,
        status: 'a_faire',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Tâche créée', description: `Tâche liée à ${initialData?.first_name}` });
      setShowTaskForm(false);
      setTaskForm({ title: '', type: 'relance', due_date: '', notes: '' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = 'Requis';
    if (!form.last_name.trim()) e.last_name = 'Requis';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Format invalide';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

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
          user_id: effectiveId,
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
    <form onSubmit={(e) => { e.preventDefault(); if (!validate()) return; mutation.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prénom *</Label>
          <Input
            className={`h-11 ${errors.first_name ? 'border-red-400 dark:border-red-600 focus:border-red-400' : ''}`}
            value={form.first_name}
            onChange={(e) => { setForm({ ...form, first_name: e.target.value }); if (errors.first_name) setErrors(prev => ({ ...prev, first_name: '' })); }}
          />
          {errors.first_name && <p className="text-[10px] text-red-500 mt-1">{errors.first_name}</p>}
        </div>
        <div>
          <Label>Nom *</Label>
          <Input
            className={`h-11 ${errors.last_name ? 'border-red-400 dark:border-red-600 focus:border-red-400' : ''}`}
            value={form.last_name}
            onChange={(e) => { setForm({ ...form, last_name: e.target.value }); if (errors.last_name) setErrors(prev => ({ ...prev, last_name: '' })); }}
          />
          {errors.last_name && <p className="text-[10px] text-red-500 mt-1">{errors.last_name}</p>}
        </div>
      </div>
      {!isEdit && duplicates.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Contact similaire détecté</span>
          </div>
          {duplicates.map(dup => (
            <div key={dup.id} className="text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
              <span>{dup.first_name} {dup.last_name}</span>
              <span className="text-amber-500">{dup.phone || dup.email || ''}</span>
            </div>
          ))}
          <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-2">Tu peux continuer si c'est un contact différent.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Téléphone</Label>
          <Input className="h-11" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            className={`h-11 ${errors.email ? 'border-red-400 dark:border-red-600 focus:border-red-400' : ''}`}
            type="email"
            value={form.email}
            onChange={(e) => { setForm({ ...form, email: e.target.value }); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); }}
          />
          {errors.email && <p className="text-[10px] text-red-500 mt-1">{errors.email}</p>}
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
      {isEdit && !showRdvForm && (
        <button
          type="button"
          onClick={() => setShowRdvForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-xl"
        >
          <CalendarPlus className="h-4 w-4" />
          Planifier un RDV
        </button>
      )}
      {isEdit && showRdvForm && (
        <div className="bg-muted rounded-2xl p-4 space-y-3 border border-border">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Nouveau RDV avec {initialData?.first_name}</p>
            <button type="button" onClick={() => setShowRdvForm(false)} className="text-muted-foreground hover:text-foreground text-xs">Annuler</button>
          </div>
          <div>
            <Label className="text-xs">Titre *</Label>
            <Input className="h-10" value={rdvForm.title} onChange={(e) => setRdvForm({...rdvForm, title: e.target.value})} placeholder={`RDV ${initialData?.first_name}`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={rdvForm.type} onValueChange={(v) => setRdvForm({...rdvForm, type: v})}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rdv">Rendez-vous</SelectItem>
                  <SelectItem value="demo">Démonstration</SelectItem>
                  <SelectItem value="relance">Relance</SelectItem>
                  <SelectItem value="formation">Formation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date *</Label>
              <Input className="h-10" type="datetime-local" value={rdvForm.date} onChange={(e) => setRdvForm({...rdvForm, date: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Durée (min)</Label>
              <Input className="h-10" type="number" value={rdvForm.duration} onChange={(e) => setRdvForm({...rdvForm, duration: e.target.value})} />
            </div>
            <div>
              <Label className="text-xs">Lieu</Label>
              <Input className="h-10" value={rdvForm.location} onChange={(e) => setRdvForm({...rdvForm, location: e.target.value})} />
            </div>
          </div>
          <button
            type="button"
            disabled={!rdvForm.title || !rdvForm.date || createRdv.isPending}
            onClick={() => createRdv.mutate()}
            className="w-full py-2.5 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-xl text-sm disabled:opacity-40"
          >
            {createRdv.isPending ? 'Création...' : 'Créer le RDV'}
          </button>
        </div>
      )}
      {isEdit && !showTaskForm && (
        <button type="button" onClick={() => setShowTaskForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl">
          <ClipboardList className="h-4 w-4" />
          Créer une tâche
        </button>
      )}
      {isEdit && showTaskForm && (
        <div className="bg-muted rounded-2xl p-4 space-y-3 border border-border">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Nouvelle tâche — {initialData?.first_name}</p>
            <button type="button" onClick={() => setShowTaskForm(false)} className="text-muted-foreground hover:text-foreground text-xs">Annuler</button>
          </div>
          <div>
            <Label className="text-xs">Titre *</Label>
            <Input className="h-10" value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} placeholder="Relancer, envoyer devis..." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={taskForm.type} onValueChange={(v) => setTaskForm({...taskForm, type: v})}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relance">Relance</SelectItem>
                  <SelectItem value="rdv">Rendez-vous</SelectItem>
                  <SelectItem value="demo">Démonstration</SelectItem>
                  <SelectItem value="suivi">Suivi</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Échéance</Label>
              <Input className="h-10" type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({...taskForm, due_date: e.target.value})} />
            </div>
          </div>
          <button type="button"
            disabled={!taskForm.title || createTask.isPending}
            onClick={() => createTask.mutate()}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-sm disabled:opacity-40">
            {createTask.isPending ? 'Création...' : 'Créer la tâche'}
          </button>
        </div>
      )}
      {isEdit && onAddToTeam && !isInTeam && (
        <button
          type="button"
          onClick={() => onAddToTeam(initialData!)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Recruter dans mon équipe
        </button>
      )}
      {isEdit && isInTeam && (
        <div className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-700 font-medium rounded-xl border border-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          Déjà dans ton équipe
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

export default function Contacts() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [contactTab, setContactTab] = useState<'crm' | 'clients' | 'all'>('crm');
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
        .select('*, deals(id, sold_by, status)')
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

  // Fetch team_members pour savoir quels contacts sont déjà recrutés
  // Clé distincte de NetworkPage pour éviter les conflits de cache React Query
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-contacts', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('team_members')
        .select('id, contact_id')
        .eq('user_id', effectiveId);
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const teamContactIds = new Set(teamMembers.filter(m => m.contact_id).map(m => m.contact_id));

  const addToTeam = useMutation({
    mutationFn: async (contact: Contact) => {
      if (!user) throw new Error('Non connecté');
      const ownerId = effectiveId || user.id;
      // Génère un Hyla ID unique (HYL-XXXXX) avec retry
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let hylaId = '';
      for (let attempt = 0; attempt < 20; attempt++) {
        hylaId = 'HYL-' + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const { data: dup } = await supabase.from('team_members').select('id').eq('internal_id', hylaId).maybeSingle();
        if (!dup) break;
      }
      // Pas de slug → contourne la contrainte unique (WHERE slug IS NOT NULL)
      const { error } = await supabase.from('team_members').insert({
        user_id: ownerId,
        contact_id: contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone: contact.phone || null,
        email: contact.email || null,
        level: 1,
        joined_at: new Date().toISOString().split('T')[0],
        matching_names: [`${contact.first_name} ${contact.last_name}`.toLowerCase()],
        status: 'actif',
        internal_id: hylaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['team-members-contacts', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['team-count'] });
      queryClient.invalidateQueries({ queryKey: ['stats-members'] });
      toast({ title: '✅ Recruté dans l\'équipe !' });
      setEditingContact(null);
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  // Onglets CRM vs Clients TRV — déclarés AVANT filtered
  const crmContacts = contacts.filter(c => c.status !== 'cliente');
  // "Mes clients" = acheteurs ayant au moins une vente directe du titulaire (sold_by IS NULL)
  const clientContacts = contacts.filter(c =>
    c.status === 'cliente' &&
    (c as any).deals?.some((d: any) => d.sold_by === null || d.sold_by === undefined)
  );
  const tabContacts    = contactTab === 'crm' ? crmContacts : contactTab === 'clients' ? clientContacts : contacts;

  const filtered = tabContacts.filter((c) => {
    const matchesSearch = !search || `${c.first_name} ${c.last_name} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Auto-créer les étapes pipeline par défaut si aucune n'existe
  useEffect(() => {
    if (!effectiveId || stages.length > 0) return;
    const DEFAULT_STAGES = [
      { name: 'Nouveau prospect', color: '#6b7280', position: 1 },
      { name: 'Premier contact',  color: '#3b82f6', position: 2 },
      { name: 'Démo planifiée',   color: '#8b5cf6', position: 3 },
      { name: 'En réflexion',     color: '#f59e0b', position: 4 },
      { name: 'Gagné ✓',          color: '#10b981', position: 5 },
    ];
    supabase.from('pipeline_stages')
      .insert(DEFAULT_STAGES.map(s => ({ ...s, user_id: effectiveId })))
      .then(() => queryClient.invalidateQueries({ queryKey: ['pipeline-stages', effectiveId] }));
  }, [effectiveId, stages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group contacts by pipeline stage for Kanban view
  const contactsByStage = stages.map(stage => ({
    ...stage,
    contacts: crmContacts.filter(c => c.pipeline_stage_id === stage.id),
  }));

  return (
    <AppLayout
      title="Contacts"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(
              filtered.map(c => ({
                Prénom: c.first_name,
                Nom: c.last_name,
                Téléphone: c.phone || '',
                Email: c.email || '',
                Statut: CONTACT_STATUS_LABELS[c.status] || c.status,
                Source: c.source || '',
                Notes: c.notes || '',
                'Créé le': new Date(c.created_at).toLocaleDateString('fr-FR'),
              })),
              `contacts-${new Date().toISOString().slice(0,10)}.csv`
            )}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground font-semibold rounded-xl border border-border hover:bg-muted/80 active:scale-[0.98] transition-all"
          >
            <Download className="h-4 w-4" />
            Exporter
          </button>
          <button
            onClick={() => { setEditingContact(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white font-semibold rounded-xl active:bg-[#3b82f6]/80"
          >
            <Plus className="h-4 w-4" />
            Nouveau contact
          </button>
        </div>
      }
    >
      {/* New contact dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Nouveau contact</DialogTitle></DialogHeader>
          <ContactForm onSuccess={() => setShowForm(false)} stages={stages} teamMembers={teamMembers} />
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {/* Onglets CRM / Clients / Tous */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {([
            { key: 'crm',     label: 'CRM',     count: crmContacts.length,    desc: 'Prospects · Recrues' },
            { key: 'clients', label: 'Mes clients',  count: clientContacts.length, desc: 'Acheteurs importés TRV' },
            { key: 'all',     label: 'Tous',     count: contacts.length,       desc: '' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setContactTab(tab.key); setStatusFilter('all'); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                contactTab === tab.key
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                contactTab === tab.key ? 'bg-[#3b82f6] text-white' : 'bg-muted-foreground/20 text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {contactTab !== 'clients' && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(CONTACT_STATUS_LABELS)
                  .filter(([k]) => contactTab === 'crm' ? k !== 'cliente' : true)
                  .map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          {contactTab !== 'clients' && (
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
              >
                Liste
              </button>
              <button
                onClick={() => setView('pipeline')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'pipeline' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
              >
                Pipeline
              </button>
              {view === 'pipeline' && (
                <button
                  onClick={() => { setEditStages(stages.map(s => ({...s}))); setShowStageManager(true); }}
                  className="px-2 py-1.5 text-muted-foreground hover:text-gray-600"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* List view */}
        {view === 'list' && isLoading && <SkeletonTable rows={6} />}
        {view === 'list' && !isLoading && (
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Créé le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((contact) => (
                  <tr key={contact.id} className="hover:bg-muted cursor-pointer" onClick={() => setEditingContact(contact)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{contact.first_name} {contact.last_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
                        {contact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CONTACT_STATUS_COLORS[contact.status]}`}>
                        {CONTACT_STATUS_LABELS[contact.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{contact.source || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(contact.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      Aucun contact trouvé
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
                      toast({ title: `Contact déplacé vers "${stage.name}"` });
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm font-semibold text-foreground">{stage.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{stage.contacts.length}</span>
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
                        className="bg-card rounded-2xl border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          if (!draggingContact) setEditingContact(contact);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                          <p className="font-medium text-sm text-foreground">{contact.first_name} {contact.last_name}</p>
                        </div>
                        {contact.phone && <p className="text-xs text-muted-foreground mt-1 ml-5">{contact.phone}</p>}
                        <div className="flex items-center gap-2 mt-2 ml-5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${CONTACT_STATUS_COLORS[contact.status]}`}>
                            {CONTACT_STATUS_LABELS[contact.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                    {stage.contacts.length === 0 && (
                      <div className="bg-muted rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        Aucun contact
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Touch drag indicator */}
            {draggingContact && (
              <div className="fixed bottom-20 left-4 right-4 bg-card rounded-2xl shadow-xl border p-3 z-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground text-center flex-1">Déplacer {draggingContact.first_name} vers :</p>
                  <button onClick={() => setDraggingContact(null)} className="text-xs text-muted-foreground hover:text-gray-600 px-2">✕</button>
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Modifier le contact</DialogTitle></DialogHeader>
          {editingContact && (
            <ContactForm
              key={editingContact.id}
              initialData={editingContact}
              stages={stages}
              onSuccess={() => setEditingContact(null)}
              onDelete={() => setEditingContact(null)}
              isInTeam={teamContactIds.has(editingContact.id)}
              onAddToTeam={(contact) => addToTeam.mutate(contact)}
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
              <div key={stage.id || idx} className="flex items-center gap-2 bg-muted rounded-xl p-2">
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
            className="w-full py-2 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-blue-300"
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
                  await supabase.from('pipeline_stages').insert({ user_id: effectiveId, name: s.name, color: s.color, position: i + 1 });
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
