import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, HYLA_NETWORK_TIERS, HYLA_NETWORK_COMMISSION } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Users, UserPlus, Star, Trophy, Crown, Award, ChevronUp, Zap, Trash2, Target, Copy, Mail, Edit3, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type TeamMember = Tables<'team_members'>;

/* ── Tier badge Hyla: Conseillère → Manager → Senior → Elite ── */
const TIERS = [
  { ...HYLA_NETWORK_TIERS[0], color: 'from-blue-500 to-blue-400', text: 'text-blue-300', icon: Award },
  { ...HYLA_NETWORK_TIERS[1], color: 'from-amber-500 to-amber-400', text: 'text-amber-300', icon: Star },
  { ...HYLA_NETWORK_TIERS[2], color: 'from-yellow-500 to-yellow-300', text: 'text-yellow-200', icon: Trophy },
  { ...HYLA_NETWORK_TIERS[3], color: 'from-violet-500 to-indigo-400', text: 'text-violet-200', icon: Crown },
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
    sponsor_id: '', level: '1', joined_at: '', notes: '',
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
        level: String(initialData.level || 1),
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
        level: parseInt(form.level) || 1,
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
        const { error } = await supabase.from('team_members').insert({
          ...payload,
          contact_id: newContact.id,
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

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
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
          <Label>Niveau</Label>
          <Input className="h-11" type="number" min="1" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
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
    <div className="space-y-4">
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

      {/* Objectifs cards */}
      {[
        { key: 'mois', label: 'Ce mois-ci', color: 'blue', text: objective.objectif_mois, v: objective.ventes_objectif_mois, r: objective.recrues_objectif_mois },
        { key: '3mois', label: 'Dans 3 mois', color: 'amber', text: objective.objectif_3mois, v: objective.ventes_objectif_3mois, r: objective.recrues_objectif_3mois },
        { key: '1an', label: 'Dans 1 an', color: 'emerald', text: objective.objectif_1an, v: objective.ventes_objectif_1an, r: objective.recrues_objectif_1an },
      ].map(({ key, label, color, text, v, r }) => (
        <div key={key} className={`border rounded-xl p-3 border-${color}-200 bg-${color}-50/50`}>
          <p className={`text-[10px] font-bold text-${color}-600 uppercase mb-1`}>{label}</p>
          <p className="text-sm text-gray-800">{text || <span className="text-gray-400 italic">Non renseigné</span>}</p>
          {(v > 0 || r > 0) && (
            <div className="flex gap-4 mt-1.5">
              {v > 0 && <span className="text-[10px] text-gray-500">{v} ventes</span>}
              {r > 0 && <span className="text-[10px] text-gray-500">{r} recrues</span>}
            </div>
          )}
        </div>
      ))}

      {objective.actions && (
        <div className="border rounded-xl p-3 border-violet-200 bg-violet-50/50">
          <p className="text-[10px] font-bold text-violet-600 uppercase mb-1">Actions</p>
          <p className="text-sm text-gray-800 whitespace-pre-line">{objective.actions}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={copyLink} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl text-xs active:scale-[0.98]">
          <Copy className="h-3.5 w-3.5" /> Copier le lien
        </button>
        <button onClick={sendEmail} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl text-xs active:scale-[0.98]">
          <Mail className="h-3.5 w-3.5" /> Envoyer par email
        </button>
      </div>
      <button onClick={() => setEditing(true)} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-xs">
        <Edit3 className="h-3.5 w-3.5" /> Modifier les objectifs
      </button>
    </div>
  );
}

/* ── Progress bar (mockup 3 style) ── */
function ProgressRing({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${pct}, 100`}
            strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-white">{value}</span>
        </div>
      </div>
      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function NetworkPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [objectifsMember, setObjectifsMember] = useState<TeamMember | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', user.id)
        .order('level', { ascending: true });
      return data || [];
    },
    enabled: !!user,
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

  const handleOpenEdit = (member: TeamMember) => {
    setEditingMember(member);
    setShowForm(true);
  };

  return (
    <AppLayout
      title="Mon Réseau"
      variant="dark"
      actions={
        <button
          onClick={() => { setEditingMember(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white font-semibold rounded-xl active:bg-[#3b82f6]/80"
        >
          <UserPlus className="h-4 w-4" />
          Ajouter
        </button>
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
            <ObjectifsPanel member={objectifsMember} userId={user.id} />
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* ── Hero stats (mockup 3: dark glassmorphism cards with progress rings) ── */}
        <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="h-5 w-5 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-white">Performance réseau</h3>
          </div>
          <div className="flex justify-around">
            <ProgressRing value={members.length} max={Math.max(20, members.length)} label="Total" color="#3b82f6" />
            <ProgressRing value={actifs} max={Math.max(members.length, 1)} label="Actifs" color="#22c55e" />
            <ProgressRing value={inactifs} max={Math.max(members.length, 1)} label="Inactifs" color="#ef4444" />
            <ProgressRing value={maxLevel} max={5} label="Niveaux" color="#a855f7" />
          </div>
        </div>

        {/* ── Tier badge Hyla ── */}
        {(() => {
          const tier = getTier(members.length);
          const TierIcon = tier.icon;
          const nextTier = TIERS[TIERS.indexOf(tier) + 1];
          const progress = nextTier
            ? Math.round(((members.length - tier.min) / (nextTier.min - tier.min)) * 100)
            : 100;
          return (
            <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 p-5">
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center shadow-lg`}>
                  <TierIcon className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-bold ${tier.text}`}>{tier.label}</span>
                    {nextTier && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                        <ChevronUp className="h-3 w-3" />
                        {nextTier.label} à {nextTier.min} partenaires
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-all duration-700`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{members.length} partenaire{members.length > 1 ? 's' : ''} • {HYLA_NETWORK_COMMISSION.recrue_directe}€/vente directe recrue • {HYLA_NETWORK_COMMISSION.reseau}€/vente réseau</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            placeholder="Rechercher un membre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 transition-all"
          />
        </div>

        {/* ── Leaderboard / Members (mockup 3: dark cards with rank, stars) ── */}
        <div className="space-y-2">
          {filtered.map((member, index) => {
            const tier = getTier(member.level);
            const TierIcon = tier.icon;
            return (
              <div
                key={member.id}
                onClick={() => handleOpenEdit(member)}
                className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 p-4 hover:border-white/20 transition-all cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  {/* Rank number */}
                  <div className="text-center min-w-[32px]">
                    <span className={`text-lg font-bold ${index < 3 ? 'text-yellow-400' : 'text-gray-600'}`}>
                      {index + 1}
                    </span>
                  </div>

                  {/* Avatar */}
                  <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <span className="text-white font-bold text-sm">
                      {member.first_name.charAt(0)}{member.last_name.charAt(0)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{member.first_name} {member.last_name}</p>
                      <TierIcon className={`h-3.5 w-3.5 flex-shrink-0 ${tier.text}`} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {member.internal_id && (
                        <span className="text-[10px] text-gray-500">ID: {member.internal_id}</span>
                      )}
                      <span className="text-[10px] text-gray-500">Niv. {member.level}</span>
                      {member.joined_at && (
                        <span className="text-[10px] text-gray-500">
                          Depuis {new Date(member.joined_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Objectifs + Status + Stars */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setObjectifsMember(member); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-colors"
                    >
                      <Target className="h-3 w-3" />
                      Objectifs
                    </button>
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(member.level, 5) }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${
                      member.status === 'actif'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/5 text-gray-500 border border-white/10'
                    }`}>
                      {member.status === 'actif' ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Users className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {isLoading ? 'Chargement...' : 'Aucun membre dans le réseau'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
