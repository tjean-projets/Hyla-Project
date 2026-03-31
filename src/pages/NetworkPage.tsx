import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase, HYLA_NETWORK_TIERS, HYLA_NETWORK_COMMISSION } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Users, UserPlus, Star, Trophy, Crown, Award, ChevronUp, Zap, Trash2, Target, Copy, Mail, Edit3, CheckCircle, Clock, Sparkles, Link2, Share2, Eye, EyeOff, AlertTriangle, ChevronDown, ChevronRight, Network, DollarSign, ShoppingCart, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useNavigate } from 'react-router-dom';
import { useThemeSafe } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type TeamMember = Tables<'team_members'>;

function generateSlug(firstName: string, lastName: string): string {
  return `${firstName}-${lastName}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/* ── Tier badge Hyla: Conseillère → Manager ── */
const TIERS = [
  { ...HYLA_NETWORK_TIERS[0], color: 'from-blue-500 to-blue-400', text: 'text-blue-300', icon: Award },
  { ...HYLA_NETWORK_TIERS[1], color: 'from-amber-500 to-amber-400', text: 'text-amber-300', icon: Star },
];

function getTier(count: number) {
  return [...TIERS].reverse().find(t => count >= t.min) || TIERS[0];
}

function MemberForm({
  onSuccess,
  members,
  initialData,
  onDelete,
}: {
  onSuccess: () => void;
  members: TeamMember[];
  initialData?: TeamMember | null;
  onDelete?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    first_name: '', last_name: '', internal_id: '', phone: '', email: '',
    sponsor_id: '', role: 'conseillere', joined_at: '', notes: '',
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        first_name: initialData.first_name || '',
        last_name: initialData.last_name || '',
        internal_id: initialData.internal_id || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        sponsor_id: initialData.sponsor_id || '',
        role: initialData.level >= 2 ? 'manager' : 'conseillere',
        joined_at: initialData.joined_at || '',
        notes: initialData.notes || '',
      });
    }
  }, [initialData]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const payload = {
        user_id: user.id,
        first_name: form.first_name,
        last_name: form.last_name,
        internal_id: form.internal_id || null,
        phone: form.phone || null,
        email: form.email || null,
        sponsor_id: form.sponsor_id || null,
        level: form.role === 'manager' ? 2 : 1,
        joined_at: form.joined_at || null,
        notes: form.notes || null,
        matching_names: [`${form.first_name} ${form.last_name}`.toLowerCase()],
      };
      if (isEdit && initialData) {
        const { error } = await supabase
          .from('team_members')
          .update(payload)
          .eq('id', initialData.id);
        if (error) throw error;
        // Also update linked contact if exists
        if (initialData.contact_id) {
          await supabase.from('contacts').update({
            first_name: form.first_name,
            last_name: form.last_name,
            phone: form.phone || null,
            email: form.email || null,
          }).eq('id', initialData.contact_id);
        }
      } else {
        // Create contact first, then link team_member to it
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            first_name: form.first_name,
            last_name: form.last_name,
            phone: form.phone || null,
            email: form.email || null,
            source: 'Réseau',
            status: 'actif' as any,
          })
          .select('id')
          .single();
        if (contactError) throw contactError;
        // Find a unique slug by appending a suffix if needed
        const baseSlug = generateSlug(form.first_name, form.last_name);
        let slug = baseSlug;
        let suffix = 1;
        while (true) {
          const { data: existing } = await supabase
            .from('team_members').select('id').eq('slug', slug).maybeSingle();
          if (!existing) break;
          suffix++;
          slug = `${baseSlug}-${suffix}`;
        }
        // Generate Hyla ID if not manually set
        let hylaId = form.internal_id || '';
        if (!hylaId) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          do {
            hylaId = 'HYL-' + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            const { data: dup } = await supabase.from('team_members').select('id').eq('internal_id', hylaId).maybeSingle();
            if (!dup) break;
          } while (true);
        }

        const { error } = await supabase.from('team_members').insert({
          ...payload,
          contact_id: newContact.id,
          linked_user_id: linkedProfile?.id || null,
          slug,
          internal_id: hylaId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: isEdit ? 'Membre modifié' : 'Membre ajouté' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!initialData) return;
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', initialData.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Membre supprimé' });
      onDelete?.();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const [hylaIdSearch, setHylaIdSearch] = useState('');
  const [linkedProfile, setLinkedProfile] = useState<{ id: string; full_name: string; email: string } | null>(null);
  const [searching, setSearching] = useState(false);

  const searchByHylaId = async () => {
    if (!hylaIdSearch.trim()) return;
    setSearching(true);
    setLinkedProfile(null);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, invite_code')
      .eq('invite_code', hylaIdSearch.trim().toLowerCase())
      .maybeSingle();
    if (data) {
      setLinkedProfile({ id: data.id, full_name: data.full_name || '', email: data.email || '' });
      const [first, ...rest] = (data.full_name || '').split(' ');
      setForm(f => ({ ...f, first_name: first || '', last_name: rest.join(' ') || '', email: data.email || f.email }));
      toast({ title: `${data.full_name} trouvé !` });
    } else {
      toast({ title: 'ID non trouvé', description: 'Vérifiez l\'ID Hyla Assistant', variant: 'destructive' });
    }
    setSearching(false);
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      // If linked via Hyla ID, pass linked_user_id
      if (linkedProfile && !isEdit) {
        // We'll add linked_user_id in the mutation
      }
      mutation.mutate();
    }} className="space-y-4">
      {/* Search by Hyla ID */}
      {!isEdit && (
        <div className="bg-blue-50 rounded-xl p-3 space-y-2">
          <Label className="text-xs text-blue-700 font-semibold">🔗 Lier un compte Hyla Assistant (optionnel)</Label>
          <div className="flex gap-2">
            <Input
              className="h-10 flex-1 bg-white text-sm font-mono uppercase"
              placeholder="ID Hyla Assistant"
              value={hylaIdSearch}
              onChange={(e) => setHylaIdSearch(e.target.value)}
            />
            <button type="button" onClick={searchByHylaId} disabled={searching}
              className="px-4 h-10 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
              {searching ? '...' : 'Rechercher'}
            </button>
          </div>
          {linkedProfile && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-xs text-green-700 font-medium">{linkedProfile.full_name} — compte lié</span>
            </div>
          )}
          <p className="text-[10px] text-blue-500">L'ID se trouve dans Paramètres du membre. Permet d'éviter les homonymes.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Prénom *</Label><Input className="h-11" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
        <div><Label>Nom *</Label><Input className="h-11" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Téléphone</Label><Input className="h-11" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input className="h-11" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>ID interne</Label><Input className="h-11" value={form.internal_id} onChange={(e) => setForm({ ...form, internal_id: e.target.value })} placeholder="Matricule Hyla" /></div>
        <div>
          <Label>Rôle</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="conseillere">Conseiller(ère)</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Sponsor direct</Label>
          <Select value={form.sponsor_id || '__none__'} onValueChange={(v) => setForm({ ...form, sponsor_id: v === '__none__' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Aucun (directe)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Aucun</SelectItem>
              {members.filter(m => m.id !== initialData?.id).map(m => (
                <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Date d'entrée</Label><Input className="h-11" type="date" value={form.joined_at} onChange={(e) => setForm({ ...form, joined_at: e.target.value })} /></div>
      </div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50 active:bg-[#3b82f6]/80"
      >
        {mutation.isPending ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : 'Ajouter au réseau'}
      </button>
      {isEdit && (
        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 text-white font-semibold rounded-xl disabled:opacity-50 active:bg-red-600"
        >
          <Trash2 className="h-4 w-4" />
          {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
        </button>
      )}
    </form>
  );
}

/* ── Hyla Assistant Panel ── */
function AssistantPanel({ member }: { member: TeamMember }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const slug = (member as any).slug || generateSlug(member.first_name, member.last_name);
  const inscriptionUrl = `${window.location.origin}/inscription/${slug}`;

  // Ensure slug is saved on the member
  const ensureSlug = useMutation({
    mutationFn: async () => {
      if ((member as any).slug) return;
      await supabase.from('team_members').update({ slug } as any).eq('id', member.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
  });

  useEffect(() => {
    ensureSlug.mutate();
  }, [member.id]);

  const copyLink = () => {
    navigator.clipboard.writeText(inscriptionUrl);
    toast({ title: 'Lien copié !' });
  };

  const sendEmail = () => {
    const subject = encodeURIComponent('Crée ton espace Hyla Assistant');
    const body = encodeURIComponent(
      `Salut ${member.first_name} !\n\n` +
      `Je t'invite à créer ton propre espace Hyla Assistant pour gérer ton activité :\n\n` +
      `${inscriptionUrl}\n\n` +
      `Tu pourras y suivre tes contacts, ventes, commissions et ton réseau.\n\n` +
      `À bientôt !`
    );
    const email = member.email || '';
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl p-4 text-center">
        <Sparkles className="h-8 w-8 text-violet-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-gray-900">
          Invite {member.first_name} à créer son espace
        </p>
        <p className="text-xs text-gray-500 mt-1">
          En s'inscrivant, {member.first_name} aura accès à son propre CRM Hyla avec tous les outils (contacts, ventes, réseau, commissions, tâches...).
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1.5">Lien d'inscription</label>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-600 truncate border">
            {inscriptionUrl}
          </div>
          <button onClick={copyLink} className="px-3 py-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            <Copy className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl text-xs active:scale-[0.98]"
        >
          <Link2 className="h-3.5 w-3.5" />
          Copier le lien
        </button>
        <button
          onClick={sendEmail}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl text-xs active:scale-[0.98]"
        >
          <Mail className="h-3.5 w-3.5" />
          Envoyer par email
        </button>
      </div>
    </div>
  );
}

/* ── Objectifs View (with notes) ── */
function ObjectifsView({ objective, member, formUrl, hasContent, onCopyLink, onSendEmail, onEdit }: {
  objective: any; member: TeamMember; formUrl: string; hasContent: boolean;
  onCopyLink: () => void; onSendEmail: () => void; onEdit: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({
    notes_mois: objective.notes_mois || '',
    notes_3mois: objective.notes_3mois || '',
    notes_1an: objective.notes_1an || '',
  });
  const [savingNotes, setSavingNotes] = useState(false);

  // Load custom questions
  const { data: formConfig } = useQuery({
    queryKey: ['form-config-view', objective.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('objectif_form_config')
        .select('questions')
        .eq('user_id', objective.user_id)
        .maybeSingle();
      return data;
    },
  });

  const customQuestions = (formConfig?.questions || []) as { id: string; label: string }[];
  const customAnswers = (objective.custom_answers || {}) as Record<string, string>;

  const saveNotes = async () => {
    setSavingNotes(true);
    await supabase.from('member_objectives').update(notes).eq('id', objective.id);
    queryClient.invalidateQueries({ queryKey: ['member-objective', member.id] });
    toast({ title: 'Notes sauvegardées' });
    setSavingNotes(false);
  };

  return (
    <div className="space-y-3 max-h-[65vh] overflow-y-auto">
      {/* Status */}
      {objective.filled_by_member && objective.filled_at && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl text-xs text-green-700">
          <CheckCircle className="h-3.5 w-3.5" />
          Rempli par {member.first_name} le {new Date(objective.filled_at).toLocaleDateString('fr-FR')}
        </div>
      )}
      {!hasContent && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl text-xs text-amber-700">
          <Clock className="h-3.5 w-3.5" />
          En attente — envoie le formulaire à {member.first_name}
        </div>
      )}

      {/* Objectifs cards with notes */}
      {[
        { key: 'mois', noteKey: 'notes_mois', label: 'Ce mois-ci', color: 'blue', text: objective.objectif_mois, v: objective.ventes_objectif_mois, r: objective.recrues_objectif_mois },
        { key: '3mois', noteKey: 'notes_3mois', label: 'Dans 3 mois', color: 'amber', text: objective.objectif_3mois, v: objective.ventes_objectif_3mois, r: objective.recrues_objectif_3mois },
        { key: '1an', noteKey: 'notes_1an', label: 'Dans 1 an', color: 'emerald', text: objective.objectif_1an, v: objective.ventes_objectif_1an, r: objective.recrues_objectif_1an },
      ].map(({ key, noteKey, label, color, text, v, r }) => (
        <div key={key} className="border rounded-xl overflow-hidden">
          <div className={`p-3 bg-${color}-50/50 border-b border-${color}-100`}>
            <p className={`text-[10px] font-bold text-${color}-600 uppercase mb-1`}>{label}</p>
            <p className="text-sm text-gray-800">{text || <span className="text-gray-400 italic">Non renseigné</span>}</p>
            {(v > 0 || r > 0) && (
              <div className="flex gap-4 mt-1.5">
                {v > 0 && <span className="text-[10px] text-gray-500">{v} ventes</span>}
                {r > 0 && <span className="text-[10px] text-gray-500">{r} recrues</span>}
              </div>
            )}
          </div>
          <div className="p-2 bg-white">
            <textarea
              value={notes[noteKey]}
              onChange={(e) => setNotes({ ...notes, [noteKey]: e.target.value })}
              placeholder={`Notes de suivi ${label.toLowerCase()}...`}
              rows={2}
              className="w-full text-xs text-gray-600 border-0 bg-gray-50 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      ))}

      {objective.actions && (
        <div className="border rounded-xl p-3 border-violet-200 bg-violet-50/50">
          <p className="text-[10px] font-bold text-violet-600 uppercase mb-1">Actions</p>
          <p className="text-sm text-gray-800 whitespace-pre-line">{objective.actions}</p>
        </div>
      )}

      {/* Custom answers */}
      {customQuestions.length > 0 && Object.keys(customAnswers).length > 0 && (
        <div className="border rounded-xl p-3 border-gray-200 bg-gray-50/50">
          <p className="text-[10px] font-bold text-gray-600 uppercase mb-2">Réponses complémentaires</p>
          <div className="space-y-1.5">
            {customQuestions.map((q) => customAnswers[q.id] ? (
              <div key={q.id}>
                <p className="text-[10px] text-gray-500">{q.label}</p>
                <p className="text-xs text-gray-800">{customAnswers[q.id]}</p>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* Save notes button */}
      <button onClick={saveNotes} disabled={savingNotes}
        className="w-full flex items-center justify-center gap-1.5 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl text-xs disabled:opacity-50">
        {savingNotes ? 'Sauvegarde...' : 'Sauvegarder les notes'}
      </button>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={onCopyLink} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl text-xs active:scale-[0.98]">
          <Copy className="h-3.5 w-3.5" /> Copier le lien
        </button>
        <button onClick={onSendEmail} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl text-xs active:scale-[0.98]">
          <Mail className="h-3.5 w-3.5" /> Envoyer par email
        </button>
      </div>
      <button onClick={onEdit} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-xs">
        <Edit3 className="h-3.5 w-3.5" /> Modifier les objectifs
      </button>
    </div>
  );
}

/* ── Objectifs Dialog ── */
function ObjectifsPanel({ member, userId }: { member: TeamMember; userId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: objective, isLoading } = useQuery({
    queryKey: ['member-objective', member.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('member_objectives')
        .select('*')
        .eq('team_member_id', member.id)
        .maybeSingle();
      return data;
    },
  });

  // Generate token for new objective
  const generateToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const createObjective = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('member_objectives').insert({
        team_member_id: member.id,
        user_id: userId,
        token: generateToken(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-objective', member.id] });
      toast({ title: 'Fiche objectifs créée' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const [editForm, setEditForm] = useState({
    objectif_mois: '', objectif_3mois: '', objectif_1an: '', actions: '',
    ventes_objectif_mois: 0, ventes_objectif_3mois: 0, ventes_objectif_1an: 0,
    recrues_objectif_mois: 0, recrues_objectif_3mois: 0, recrues_objectif_1an: 0,
  });

  useEffect(() => {
    if (objective && editing) {
      setEditForm({
        objectif_mois: objective.objectif_mois || '',
        objectif_3mois: objective.objectif_3mois || '',
        objectif_1an: objective.objectif_1an || '',
        actions: objective.actions || '',
        ventes_objectif_mois: objective.ventes_objectif_mois || 0,
        ventes_objectif_3mois: objective.ventes_objectif_3mois || 0,
        ventes_objectif_1an: objective.ventes_objectif_1an || 0,
        recrues_objectif_mois: objective.recrues_objectif_mois || 0,
        recrues_objectif_3mois: objective.recrues_objectif_3mois || 0,
        recrues_objectif_1an: objective.recrues_objectif_1an || 0,
      });
    }
  }, [objective, editing]);

  const saveObjective = useMutation({
    mutationFn: async () => {
      if (!objective) return;
      const { error } = await supabase.from('member_objectives')
        .update({ ...editForm, updated_at: new Date().toISOString() })
        .eq('id', objective.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-objective', member.id] });
      setEditing(false);
      toast({ title: 'Objectifs mis à jour' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const formUrl = objective ? `${window.location.origin}/objectifs/${objective.token}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(formUrl);
    toast({ title: 'Lien copié !' });
  };

  const sendEmail = () => {
    const subject = encodeURIComponent('Remplis tes objectifs Hyla');
    const body = encodeURIComponent(`Salut ${member.first_name} !\n\nRemplis tes objectifs ici :\n${formUrl}\n\nÀ bientôt !`);
    const email = member.email || '';
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  if (isLoading) return <div className="py-8 text-center text-gray-400 text-sm">Chargement...</div>;

  if (!objective) {
    return (
      <div className="py-8 text-center">
        <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 mb-4">Aucun objectif défini pour {member.first_name}</p>
        <button
          onClick={() => createObjective.mutate()}
          disabled={createObjective.isPending}
          className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
        >
          Créer la fiche objectifs
        </button>
      </div>
    );
  }

  const hasContent = objective.objectif_mois || objective.objectif_3mois || objective.objectif_1an;

  if (editing) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); saveObjective.mutate(); }} className="space-y-4 max-h-[60vh] overflow-y-auto">
        {[
          { key: 'mois', label: 'Ce mois-ci', color: 'blue' },
          { key: '3mois', label: 'Dans 3 mois', color: 'amber' },
          { key: '1an', label: 'Dans 1 an', color: 'emerald' },
        ].map(({ key, label, color }) => (
          <div key={key} className="space-y-2">
            <p className={`text-xs font-bold text-${color}-600 uppercase`}>{label}</p>
            <textarea
              value={(editForm as any)[`objectif_${key}`]}
              onChange={(e) => setEditForm({ ...editForm, [`objectif_${key}`]: e.target.value })}
              placeholder="Objectif..."
              rows={2}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500">Ventes</label>
                <Input type="number" min="0" className="h-9"
                  value={(editForm as any)[`ventes_objectif_${key}`]}
                  onChange={(e) => setEditForm({ ...editForm, [`ventes_objectif_${key}`]: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Recrues</label>
                <Input type="number" min="0" className="h-9"
                  value={(editForm as any)[`recrues_objectif_${key}`]}
                  onChange={(e) => setEditForm({ ...editForm, [`recrues_objectif_${key}`]: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
        ))}
        <div>
          <p className="text-xs font-bold text-violet-600 uppercase mb-1">Actions</p>
          <textarea
            value={editForm.actions}
            onChange={(e) => setEditForm({ ...editForm, actions: e.target.value })}
            placeholder="Actions menées..."
            rows={2}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saveObjective.isPending}
            className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
            {saveObjective.isPending ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
          <button type="button" onClick={() => setEditing(false)}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl text-sm">
            Annuler
          </button>
        </div>
      </form>
    );
  }

  return (
    <ObjectifsView
      objective={objective}
      member={member}
      formUrl={formUrl}
      hasContent={hasContent}
      onCopyLink={copyLink}
      onSendEmail={sendEmail}
      onEdit={() => setEditing(true)}
    />
  );
}

/* ── Simple KPI card ── */
function KpiCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 uppercase font-semibold mt-0.5">{label}</p>
    </div>
  );
}

/* ── Invite Link Dialog ── */
function InviteLinkDialog({ open, onOpenChange, inviteCode }: { open: boolean; onOpenChange: (open: boolean) => void; inviteCode: string | null }) {
  const { toast } = useToast();
  const inviteUrl = inviteCode ? `${window.location.origin}/rejoindre/${inviteCode}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast({ title: 'Lien copié !' });
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Rejoins mon réseau Hyla', text: 'Je t\'invite à rejoindre mon réseau Hyla !', url: inviteUrl });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-blue-600" />
            Inviter un partenaire
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Partagez ce lien pour inviter un nouveau partenaire à rejoindre votre réseau Hyla.</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-600 truncate border">
              {inviteUrl || 'Aucun code d\'invitation'}
            </div>
            <button onClick={copyLink} disabled={!inviteCode} className="px-3 py-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">
              <Copy className="h-4 w-4 text-gray-600" />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={copyLink} disabled={!inviteCode}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50 active:scale-[0.98]">
              <Copy className="h-3.5 w-3.5" /> Copier le lien
            </button>
            <button onClick={shareLink} disabled={!inviteCode}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-violet-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50 active:scale-[0.98]">
              <Share2 className="h-3.5 w-3.5" /> Partager
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Manager Stats Panel ── */
function ManagerStatsPanel({ userId, memberName, open, onOpenChange }: { userId: string; memberName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['manager-stats', userId],
    queryFn: async () => {
      // Fetch deals
      const { data: deals } = await supabase
        .from('deals')
        .select('id, amount, commission_direct, status')
        .eq('user_id', userId);
      const signedDeals = (deals || []).filter(d => d.status === 'signee' || d.status === 'livree');
      const totalVentes = signedDeals.length;
      const totalCA = signedDeals.reduce((s, d) => s + (d.amount || 0), 0);

      // Fetch commissions
      const { data: commissions } = await supabase
        .from('commissions')
        .select('amount')
        .eq('user_id', userId);
      const totalCommissions = (commissions || []).reduce((s, c) => s + (c.amount || 0), 0);

      // Fetch team size
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', userId);
      const teamSize = (teamMembers || []).length;

      return { totalVentes, totalCA, totalCommissions, teamSize };
    },
    enabled: open && !!userId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-blue-600" />
            Stats — {memberName}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-gray-400 text-sm">Chargement...</div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <ShoppingCart className="h-5 w-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{stats.totalVentes}</p>
              <p className="text-xs text-gray-500">Ventes</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <DollarSign className="h-5 w-5 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{stats.totalCA.toLocaleString('fr-FR')} &euro;</p>
              <p className="text-xs text-gray-500">CA total</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <DollarSign className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{stats.totalCommissions.toLocaleString('fr-FR')} &euro;</p>
              <p className="text-xs text-gray-500">Commissions</p>
            </div>
            <div className="bg-violet-50 rounded-xl p-4 text-center">
              <Users className="h-5 w-5 text-violet-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{stats.teamSize}</p>
              <p className="text-xs text-gray-500">Equipe</p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ── Delete Account Double Confirmation ── */
function DeleteAccountDialog({
  open, onOpenChange, memberName, onConfirm, isPending,
}: {
  open: boolean; onOpenChange: (open: boolean) => void;
  memberName: string; onConfirm: () => void; isPending: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => {
    if (!open) { setStep(1); setConfirmName(''); }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {step === 1 ? 'Supprimer le compte' : 'Confirmation finale'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {step === 1
              ? `Etes-vous sur de vouloir supprimer le compte de ${memberName} ? Cette action est irreversible.`
              : `Confirmer la suppression : tapez le nom complet de la personne pour confirmer.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {step === 2 && (
          <div className="py-2">
            <Input
              placeholder={memberName}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="h-11"
            />
            {confirmName.length > 0 && confirmName !== memberName && (
              <p className="text-xs text-red-500 mt-1">Le nom ne correspond pas</p>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-red-600 text-white hover:bg-red-700"
            >
              Continuer
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={confirmName !== memberName || isPending}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? 'Suppression...' : 'Supprimer definitivement'}
            </button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── Fiche Membre Détaillée ── */
function FicheMembre({
  member,
  open,
  onClose,
  onEdit,
  onImpersonate,
}: {
  member: TeamMember;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onImpersonate?: () => void;
}) {
  const effectiveId = useEffectiveUserId();

  // Fetch commissions for this member (réseau commissions in owner's space)
  const { data: commissions = [] } = useQuery({
    queryKey: ['member-commissions', member.id, effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('commissions')
        .select('*')
        .eq('user_id', effectiveId)
        .eq('team_member_id', member.id)
        .eq('status', 'validee')
        .order('period', { ascending: false });
      return data || [];
    },
    enabled: open && !!effectiveId,
  });

  // Fetch deals sold by this member
  const { data: deals = [] } = useQuery({
    queryKey: ['member-deals', member.id, effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('deals')
        .select('*')
        .eq('user_id', effectiveId)
        .eq('sold_by', member.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: open && !!effectiveId,
  });

  const totalCommissions = commissions.reduce((s: number, c: any) => s + c.amount, 0);
  const dealsSignes = deals.filter((d: any) => d.status === 'signee').length;
  const dealsEnCours = deals.filter((d: any) => d.status === 'en_cours' || d.status === 'en_attente').length;

  const tier = member.level >= 2 ? 'Manager' : 'Conseillère';
  const joined = member.joined_at
    ? new Date(member.joined_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Non renseigné';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] px-6 pt-6 pb-8">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-white font-bold text-xl">{member.first_name.charAt(0)}{member.last_name.charAt(0)}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{member.first_name} {member.last_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-lg">{tier}</span>
                {member.internal_id && (
                  <span className="text-xs font-mono bg-white/10 text-white/70 px-2 py-0.5 rounded-lg">{member.internal_id}</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-lg ${
                  member.status === 'actif' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/10 text-white/50'
                }`}>{member.status === 'actif' ? 'Actif' : 'Inactif'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="px-6 -mt-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl shadow-sm border p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{totalCommissions.toLocaleString('fr-FR')}€</p>
              <p className="text-[10px] text-gray-400">Commissions</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{dealsSignes}</p>
              <p className="text-[10px] text-gray-400">Ventes signées</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{dealsEnCours}</p>
              <p className="text-[10px] text-gray-400">En cours</p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-4 space-y-3">
          <div className="space-y-2 text-sm">
            {member.phone && <div className="flex justify-between"><span className="text-gray-400">Téléphone</span><span className="text-gray-900">{member.phone}</span></div>}
            {member.email && <div className="flex justify-between"><span className="text-gray-400">Email</span><span className="text-gray-900 truncate ml-4">{member.email}</span></div>}
            <div className="flex justify-between"><span className="text-gray-400">Depuis le</span><span className="text-gray-900">{joined}</span></div>
          </div>

          {/* Recent commissions */}
          {commissions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Dernières commissions</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {commissions.slice(0, 5).map((c: any) => (
                  <div key={c.id} className="flex justify-between text-xs py-1 border-b border-gray-50">
                    <span className="text-gray-500">{new Date(c.period + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                    <span className="font-semibold text-gray-900">{c.amount.toLocaleString('fr-FR')} €</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onEdit}
              className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Modifier
            </button>
            {onImpersonate && (
              <button
                onClick={onImpersonate}
                className="flex-1 py-2.5 text-sm font-semibold bg-[#3b82f6] text-white rounded-xl hover:bg-[#2563eb] transition-colors flex items-center justify-center gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                Voir son espace
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Org Chart Tree Node (recursive) ── */
interface OrgNode {
  id: string;
  name: string;
  initials: string;
  status: string;
  children: OrgNode[];
}

function buildOrgTree(
  members: TeamMember[],
): OrgNode[] {
  const byParent = new Map<string, TeamMember[]>();
  const roots: TeamMember[] = [];

  members.forEach(m => {
    if (m.sponsor_id) {
      if (!byParent.has(m.sponsor_id)) byParent.set(m.sponsor_id, []);
      byParent.get(m.sponsor_id)!.push(m);
    } else {
      roots.push(m);
    }
  });

  function toNode(m: TeamMember): OrgNode {
    const children = (byParent.get(m.id) || []).map(toNode);
    return {
      id: m.id,
      name: `${m.first_name} ${m.last_name}`,
      initials: `${m.first_name.charAt(0)}${m.last_name.charAt(0)}`,
      status: m.status || 'actif',
      children,
    };
  }

  return roots.map(toNode);
}

function OrgTreeNode({ node, isLast = false }: { node: OrgNode; isLast?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className="relative">
      {/* Node */}
      <div className="flex items-center gap-2 py-1.5">
        <div
          className={`h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-indigo-500/30 flex items-center justify-center flex-shrink-0 ${hasChildren ? 'cursor-pointer' : ''}`}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          <span className="text-white font-bold text-[10px]">{node.initials}</span>
        </div>
        <span className="text-sm text-white font-medium truncate">{node.name}</span>
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
          node.status === 'actif' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-400'
        }`}>
          {node.status === 'actif' ? 'Actif' : 'Inactif'}
        </span>
        {hasChildren && (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-white ml-auto">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Children with tree lines */}
      {hasChildren && expanded && (
        <div className="ml-4 border-l border-white/10 pl-4 space-y-0">
          {node.children.map((child, i) => (
            <OrgTreeNode key={child.id} node={child} isLast={i === node.children.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Organigramme simple ── */
function DownlineSection({ currentUserId, members }: { currentUserId: string; members: TeamMember[] }) {
  const orgTree = buildOrgTree(members);

  if (members.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Network className="h-4 w-4 text-violet-500" />
        <h3 className="text-sm font-semibold text-gray-900">Organigramme</h3>
        <span className="ml-auto text-xs text-gray-400">{members.length} membre{members.length > 1 ? 's' : ''}</span>
      </div>

      {/* Moi */}
      <div className="flex flex-col items-center mb-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md mb-1">
          <Star className="h-6 w-6 text-white" />
        </div>
        <p className="text-xs font-bold text-gray-900">Moi</p>
        {orgTree.length > 0 && <div className="w-px h-5 bg-gray-200 mt-1.5" />}
      </div>

      {/* Membres */}
      {orgTree.length > 0 && (
        <>
          {orgTree.length > 1 && (
            <div className="flex justify-center">
              <div className="h-px bg-gray-200 w-full max-w-[80%]" />
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-4 mt-0">
            {orgTree.map((node) => (
              <div key={node.id} className="flex flex-col items-center w-20">
                <div className="w-px h-4 bg-gray-200 mb-1.5" />
                <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center mb-1">
                  <span className="text-violet-700 font-bold text-[10px]">{node.initials}</span>
                </div>
                <p className="text-[11px] font-medium text-gray-800 text-center leading-tight">{node.name}</p>
                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full mt-1 ${
                  node.status === 'actif' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {node.status === 'actif' ? 'Actif' : 'Inactif'}
                </span>
                {node.children.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="w-px h-3 bg-gray-200 mx-auto" />
                    {node.children.map((child) => (
                      <div key={child.id} className="flex flex-col items-center">
                        <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center mb-0.5">
                          <span className="text-blue-600 font-bold text-[8px]">{child.initials}</span>
                        </div>
                        <p className="text-[9px] text-gray-500 text-center leading-tight">{child.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Sub-Team Tree: recursive cascade visibility ── */
function SubTeamTree({
  userId,
  parentMemberName,
  depth = 1,
  onEditSubMember,
}: {
  userId: string;
  parentMemberName: string;
  depth?: number;
  onEditSubMember?: (member: TeamMember, parentName: string) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // TODO: Need RLS policy for manager read access
  // The existing 004_mlm_system.sql migration adds manager_read_downline_team
  // which should allow this query if the user is in the downline chain.
  const { data: subMembers = [], isLoading } = useQuery({
    queryKey: ['sub-team-members', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', userId)
        .order('level', { ascending: true });
      return (data || []) as TeamMember[];
    },
    enabled: !!userId,
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="pl-4 py-2">
        <p className="text-[11px] text-gray-500 animate-pulse">Chargement de l'équipe...</p>
      </div>
    );
  }

  if (subMembers.length === 0) {
    return (
      <div className="pl-4 py-2">
        <p className="text-[11px] text-gray-500 italic">Aucun membre dans cette équipe</p>
      </div>
    );
  }

  return (
    <div className="relative ml-3 mt-1 mb-1">
      {/* Vertical tree line */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10" />

      <div className="space-y-1.5 pl-4">
        {subMembers.map((sub) => {
          const hasLinkedUser = !!(sub as any).linked_user_id;
          const isExpanded = expandedIds.has(sub.id);
          const isManager = sub.level >= 2;

          return (
            <div key={sub.id}>
              {/* Horizontal branch connector */}
              <div className="relative">
                <div className="absolute -left-4 top-4 w-3 h-px bg-white/10" />

                <div className="bg-white/[0.03] rounded-xl border border-white/5 overflow-hidden">
                  <div className="flex items-center gap-2 p-2.5">
                    {/* Avatar */}
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-gray-500/30 to-gray-600/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-[10px]">
                        {sub.first_name.charAt(0)}{sub.last_name.charAt(0)}
                      </span>
                    </div>

                    {/* Info */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onEditSubMember?.(sub, parentMemberName)}
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-white/90 truncate">
                          {sub.first_name} {sub.last_name}
                        </p>
                        {/* Depth badge */}
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 flex-shrink-0">
                          N{depth}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-500">
                          {isManager ? 'Manager' : 'Conseillère'}
                        </span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                          sub.status === 'actif'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-white/5 text-gray-500'
                        }`}>
                          {sub.status === 'actif' ? 'Actif' : 'Inactif'}
                        </span>
                        {hasLinkedUser && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                            Connecté
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand button if has linked account */}
                    {hasLinkedUser && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(sub.id); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/15 hover:bg-violet-500/20 transition-colors flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        Équipe
                      </button>
                    )}
                  </div>

                  {/* Recursively render sub-team */}
                  {hasLinkedUser && isExpanded && (
                    <div className="border-t border-white/5">
                      <SubTeamTree
                        userId={(sub as any).linked_user_id}
                        parentMemberName={`${sub.first_name} ${sub.last_name}`}
                        depth={depth + 1}
                        onEditSubMember={onEditSubMember}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Confirmation dialog for editing sub-member data ── */
function SubMemberEditConfirmDialog({
  open,
  onOpenChange,
  parentName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentName: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Modifier un sous-membre
          </AlertDialogTitle>
          <AlertDialogDescription>
            Vous allez modifier les données de l'équipe de {parentName}. Continuer ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Continuer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function NetworkPage() {
  const { user, profile } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { startImpersonation } = useImpersonation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [objectifsMember, setObjectifsMember] = useState<TeamMember | null>(null);
  const [assistantMember, setAssistantMember] = useState<TeamMember | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());
  const [subMemberToEdit, setSubMemberToEdit] = useState<{ member: TeamMember; parentName: string } | null>(null);
  const [showSubMemberConfirm, setShowSubMemberConfirm] = useState(false);
  const [promoteMember, setPromoteMember] = useState<TeamMember | null>(null);
  const [showMemberList, setShowMemberList] = useState(true);

  const toggleTeamExpand = (memberId: string) => {
    setExpandedTeamIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleSubMemberEdit = (member: TeamMember, parentName: string) => {
    setSubMemberToEdit({ member, parentName });
    setShowSubMemberConfirm(true);
  };

  const confirmSubMemberEdit = () => {
    if (subMemberToEdit) {
      setEditingMember(subMemberToEdit.member);
      setShowForm(true);
    }
    setShowSubMemberConfirm(false);
    setSubMemberToEdit(null);
  };

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', effectiveId)
        .order('level', { ascending: true });
      if (!data) return [];
      // Fetch linked profiles to get role
      const linkedIds = data.filter(m => m.linked_user_id).map(m => m.linked_user_id!);
      if (linkedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, role')
          .in('id', linkedIds);
        const roleMap: Record<string, string> = {};
        profiles?.forEach(p => { roleMap[p.id] = (p as any).role || 'conseillere'; });
        return data.map(m => ({
          ...m,
          role: m.linked_user_id ? roleMap[m.linked_user_id] || 'conseillere' : undefined,
        }));
      }
      return data;
    },
    enabled: !!effectiveId,
  });

  const filtered = members.filter(m =>
    !search || `${m.first_name} ${m.last_name} ${m.internal_id || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const actifs = members.filter(m => m.status === 'actif').length;
  const inactifs = members.length - actifs;
  const maxLevel = members.reduce((max, m) => Math.max(max, m.level), 0);

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingMember(null);
  };

  const [fichemembre, setFichemembre] = useState<TeamMember | null>(null);

  const handleOpenEdit = (member: TeamMember) => {
    setFichemembre(member);
  };

  return (
    <AppLayout
      title="Mon Réseau"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInviteDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-semibold rounded-xl text-sm hover:bg-violet-700"
          >
            <Share2 className="h-4 w-4" />
            Inviter
          </button>
          <button
            onClick={() => { setEditingMember(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white font-semibold rounded-xl text-sm hover:bg-[#2563eb]"
          >
            <UserPlus className="h-4 w-4" />
            Ajouter
          </button>
        </div>
      }
    >
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleCloseForm(); else setShowForm(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Modifier le membre' : 'Nouveau membre'}</DialogTitle>
          </DialogHeader>
          <MemberForm
            onSuccess={handleCloseForm}
            members={members}
            initialData={editingMember}
            onDelete={handleCloseForm}
          />
        </DialogContent>
      </Dialog>

      {/* Objectifs dialog */}
      <Dialog open={!!objectifsMember} onOpenChange={(open) => { if (!open) setObjectifsMember(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Objectifs — {objectifsMember?.first_name} {objectifsMember?.last_name}
            </DialogTitle>
          </DialogHeader>
          {objectifsMember && user && (
            <ObjectifsPanel member={objectifsMember} userId={effectiveId!} />
          )}
        </DialogContent>
      </Dialog>

      {/* Hyla Assistant dialog */}
      <Dialog open={!!assistantMember} onOpenChange={(open) => { if (!open) setAssistantMember(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Hyla Assistant — {assistantMember?.first_name} {assistantMember?.last_name}
            </DialogTitle>
          </DialogHeader>
          {assistantMember && <AssistantPanel member={assistantMember} />}
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard value={members.length} label="Total" color="text-gray-900" />
          <KpiCard value={actifs} label="Actifs" color="text-emerald-600" />
        </div>

        {/* ── Tier badge ── */}
        {(() => {
          const tier = getTier(members.length);
          const TierIcon = tier.icon;
          const nextTier = TIERS[TIERS.indexOf(tier) + 1];
          const progress = nextTier
            ? Math.round(((members.length - tier.min) / (nextTier.min - tier.min)) * 100)
            : 100;
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                  <TierIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${tier.text}`}>{tier.label}</span>
                    {nextTier && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <ChevronUp className="h-3 w-3" />
                        {nextTier.label} à {nextTier.min} partenaires
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-all duration-700`} style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {members.length} partenaire{members.length > 1 ? 's' : ''} • {tier.min >= 4
                      ? `${HYLA_NETWORK_COMMISSION.manager.recrue_directe}€/vente recrue • ${HYLA_NETWORK_COMMISSION.manager.reseau}€/vente réseau`
                      : `${HYLA_NETWORK_COMMISSION.conseillere.recrue_directe}€/vente recrue directe`}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Search + Toggle ── */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher un membre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <button
            onClick={() => setShowMemberList(!showMemberList)}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
            title={showMemberList ? 'Masquer' : 'Afficher'}
          >
            {showMemberList ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* ── Member list ── */}
        {showMemberList && (
          <div className="space-y-2">
            {filtered.map((member) => {
              const tier = getTier(member.level);
              const TierIcon = tier.icon;
              return (
                <div
                  key={member.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:border-gray-200 transition-all"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleOpenEdit(member)}>
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white font-bold text-sm">
                        {member.first_name.charAt(0)}{member.last_name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">{member.first_name} {member.last_name}</p>
                        <TierIcon className={`h-3.5 w-3.5 flex-shrink-0 ${tier.text}`} />
                        {member.internal_id && (
                          <span className="text-[9px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{member.internal_id}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {member.joined_at && (
                          <span className="text-[10px] text-gray-400">
                            Depuis {new Date(member.joined_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          member.status === 'actif' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {member.status === 'actif' ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setObjectifsMember(member); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 active:scale-[0.97] transition-colors"
                    >
                      <Target className="h-3.5 w-3.5" />
                      Objectifs
                    </button>
                    {(member as any).linked_user_id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startImpersonation((member as any).linked_user_id, `${member.first_name} ${member.last_name}`, 'individual');
                          navigate('/');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 active:scale-[0.97] transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Voir son espace
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setAssistantMember(member); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold bg-violet-50 text-violet-600 border border-violet-100 hover:bg-violet-100 active:scale-[0.97] transition-colors"
                      >
                      <Sparkles className="h-3.5 w-3.5" />
                      Hyla Assistant
                    </button>
                  )}
                </div>

                {/* Promote to Manager */}
                  {(member as any).linked_user_id && (member as any).role !== 'manager' && (member as any).role !== 'admin' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPromoteMember(member); }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 rounded-xl text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-colors active:scale-[0.98]"
                    >
                      <Crown className="h-3.5 w-3.5" />
                      Passer Manager
                    </button>
                  )}
                  {(member as any).linked_user_id && ((member as any).role === 'manager' || (member as any).role === 'admin') && (
                    <span className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-2 text-[10px] font-semibold text-amber-600">
                      <Crown className="h-3 w-3" /> Manager
                    </span>
                  )}

                  {/* Expand sub-team */}
                  {(member as any).linked_user_id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTeamExpand(member.id); }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 rounded-xl text-[11px] font-semibold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors active:scale-[0.98]"
                    >
                      {expandedTeamIds.has(member.id) ? (
                        <><ChevronDown className="h-3.5 w-3.5" /> Masquer l'équipe</>
                      ) : (
                        <><ChevronRight className="h-3.5 w-3.5" /> Voir l'équipe</>
                      )}
                    </button>
                  )}

                  {/* Sub-team */}
                  {(member as any).linked_user_id && expandedTeamIds.has(member.id) && (
                    <SubTeamTree
                      userId={(member as any).linked_user_id}
                      parentMemberName={`${member.first_name} ${member.last_name}`}
                      depth={1}
                      onEditSubMember={handleSubMemberEdit}
                    />
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  {isLoading ? 'Chargement...' : 'Aucun membre dans le réseau'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Organigramme ── */}
        {effectiveId && <DownlineSection currentUserId={effectiveId} members={members} />}
      </div>

      {/* Sub-member edit confirmation dialog */}
      <SubMemberEditConfirmDialog
        open={showSubMemberConfirm}
        onOpenChange={(open) => {
          setShowSubMemberConfirm(open);
          if (!open) setSubMemberToEdit(null);
        }}
        parentName={subMemberToEdit?.parentName || ''}
        onConfirm={confirmSubMemberEdit}
      />

      {/* Promote to Manager Dialog */}
      <AlertDialog open={!!promoteMember} onOpenChange={(open) => { if (!open) setPromoteMember(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Passer en Manager
            </AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous passer <strong>{promoteMember?.first_name} {promoteMember?.last_name}</strong> en Manager ?
              Cette personne aura accès à l'onglet Réseau et pourra gérer sa propre équipe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600"
              onClick={async () => {
                if (!promoteMember?.linked_user_id) return;
                const { error } = await supabase
                  .from('profiles')
                  .update({ role: 'manager' })
                  .eq('id', promoteMember.linked_user_id);
                if (error) {
                  toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                } else {
                  toast({ title: `${promoteMember.first_name} est maintenant Manager !` });
                  queryClient.invalidateQueries({ queryKey: ['team-members'] });
                }
                setPromoteMember(null);
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite Link Dialog */}
      <InviteLinkDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        inviteCode={profile?.invite_code || null}
      />

      {/* Fiche membre détaillée */}
      {fichemembre && (
        <FicheMembre
          member={fichemembre}
          open={!!fichemembre}
          onClose={() => setFichemembre(null)}
          onEdit={() => {
            setEditingMember(fichemembre);
            setFichemembre(null);
            setShowForm(true);
          }}
          onImpersonate={(fichemembre as any).linked_user_id ? () => {
            startImpersonation((fichemembre as any).linked_user_id, `${fichemembre.first_name} ${fichemembre.last_name}`, 'individual');
            navigate('/');
          } : undefined}
        />
      )}
    </AppLayout>
  );
}
