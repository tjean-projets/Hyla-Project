import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Users, UserPlus, Star, Trophy, Crown, Award, ChevronUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type TeamMember = Tables<'team_members'>;

/* ── Tier badge (mockup 3: Bronze / Silver / Gold / Platinum) ── */
const TIERS = [
  { min: 0, label: 'Bronze', color: 'from-amber-700 to-amber-500', text: 'text-amber-300', icon: Award },
  { min: 3, label: 'Argent', color: 'from-gray-400 to-gray-300', text: 'text-gray-200', icon: Star },
  { min: 8, label: 'Or', color: 'from-yellow-500 to-yellow-300', text: 'text-yellow-200', icon: Trophy },
  { min: 15, label: 'Platine', color: 'from-violet-500 to-indigo-400', text: 'text-violet-200', icon: Crown },
];

function getTier(level: number) {
  return [...TIERS].reverse().find(t => level >= t.min) || TIERS[0];
}

function MemberForm({ onSuccess, members }: { onSuccess: () => void; members: TeamMember[] }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    first_name: '', last_name: '', internal_id: '', phone: '', email: '',
    sponsor_id: '', level: '1', joined_at: '', notes: '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const { error } = await supabase.from('team_members').insert({
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Membre ajouté' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Prénom *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
        <div><Label>Nom *</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>ID interne</Label><Input value={form.internal_id} onChange={(e) => setForm({ ...form, internal_id: e.target.value })} placeholder="Matricule Hyla" /></div>
        <div>
          <Label>Niveau</Label>
          <Input type="number" min="1" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Sponsor direct</Label>
          <Select value={form.sponsor_id} onValueChange={(v) => setForm({ ...form, sponsor_id: v })}>
            <SelectTrigger><SelectValue placeholder="Aucun (directe)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Aucun</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Date d'entrée</Label><Input type="date" value={form.joined_at} onChange={(e) => setForm({ ...form, joined_at: e.target.value })} /></div>
      </div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      <Button type="submit" disabled={mutation.isPending} className="w-full bg-[#3b82f6] hover:bg-[#3b82f6]/90">
        {mutation.isPending ? 'Ajout...' : 'Ajouter au réseau'}
      </Button>
    </form>
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

  return (
    <AppLayout
      title="Mon Réseau"
      variant="dark"
      actions={
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white border-0">
              <UserPlus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nouveau membre</DialogTitle></DialogHeader>
            <MemberForm onSuccess={() => setShowForm(false)} members={members} />
          </DialogContent>
        </Dialog>
      }
    >
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

        {/* ── Tier badge (mockup 3: current rank) ── */}
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
                        {nextTier.label} à {nextTier.min} membres
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-all duration-700`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{members.length} membre{members.length > 1 ? 's' : ''} recrutés</p>
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
                className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 p-4 hover:border-white/20 transition-all"
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

                  {/* Status + Stars */}
                  <div className="flex items-center gap-3 flex-shrink-0">
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
