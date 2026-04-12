import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, isSuperAdmin } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Users, Search, ChevronDown, ChevronRight, Eye, UserMinus,
  TrendingUp, ShoppingBag, DollarSign, AlertTriangle, Loader2, Network,
  BookOpen, GraduationCap,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { useImpersonation } from '@/hooks/useImpersonation';

type PlanType = 'legacy' | 'trial' | 'conseillere' | 'manager' | 'expired';

interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  sponsor_user_id: string | null;
  invite_code: string | null;
  created_at: string;
  plan?: PlanType | null;
}

const PLAN_BADGE: Record<PlanType, { label: string; className: string }> = {
  legacy:     { label: 'Legacy',     className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  trial:      { label: 'Essai',      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  conseillere:{ label: 'Conseillère',className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  manager:    { label: 'Manager',    className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
  expired:    { label: 'Expiré',     className: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
};

interface UserStats {
  deals: number;
  ca: number;
  commissions: number;
  team: number;
  contacts: number;
}

// Composant toggle générique
function AdminToggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-300'} disabled:opacity-50`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

// Sub-component for user feature settings
function UserFeatureSettings({ userId, onToggle, updating }: {
  userId: string;
  onToggle: (field: 'respire_academie_access' | 'can_grant_academie_access' | 'challenges_disabled', currentValue: boolean) => void;
  updating: string | null;
}) {
  const { data: settings } = useQuery({
    queryKey: ['admin-user-settings', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('respire_academie_access, can_grant_academie_access, challenges_disabled')
        .eq('user_id', userId)
        .maybeSingle();
      return data;
    },
    staleTime: 0,
  });

  const hasAccess = settings?.respire_academie_access === true;
  const canGrant = settings?.can_grant_academie_access === true;
  const challengesDisabled = settings?.challenges_disabled === true;

  return (
    <div className="space-y-2">
      {/* Respire Académie */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900/30">
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-2 font-semibold uppercase flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5" />
          Respire Académie
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Accès Académie</p>
              <p className="text-[10px] text-gray-500">Voir Formation et Carte</p>
            </div>
            <AdminToggle on={hasAccess} onClick={() => onToggle('respire_academie_access', hasAccess)} disabled={updating === userId + 'respire_academie_access'} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Peut accorder l'accès</p>
              <p className="text-[10px] text-gray-500">Admin Académie</p>
            </div>
            <AdminToggle on={canGrant} onClick={() => onToggle('can_grant_academie_access', canGrant)} disabled={updating === userId + 'can_grant_academie_access'} />
          </div>
        </div>
      </div>

      {/* Challenges */}
      <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-100 dark:border-amber-900/30">
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-2 font-semibold uppercase flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          Challenges Hyla
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium">Désactiver les challenges</p>
            <p className="text-[10px] text-gray-500">Masque Countdown et Rookie</p>
          </div>
          <AdminToggle on={challengesDisabled} onClick={() => onToggle('challenges_disabled', challengesDisabled)} disabled={updating === userId + 'challenges_disabled'} />
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);
  const [confirmName, setConfirmName] = useState('');
  const [academieUpdating, setAcademieUpdating] = useState<string | null>(null);

  const isAdmin = isSuperAdmin(user?.email);

  // Fetch all profiles — enabled seulement quand l'admin est authentifié
  const { data: profiles = [], isLoading, error: profilesError } = useQuery({
    queryKey: ['admin-all-profiles', user?.id],
    queryFn: async () => {
      console.log('[AdminPanel] Fetching profiles, user:', user?.email);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, sponsor_user_id, invite_code, created_at')
        .order('created_at', { ascending: false });
      console.log('[AdminPanel] Result:', { count: data?.length, error });
      if (error) throw error;
      return (data || []) as UserProfile[];
    },
    enabled: !!user && isAdmin,
    staleTime: 0,
    retry: false,
  });

  // Attendre que l'auth soit chargée avant de vérifier les droits
  if (authLoading) {
    return (
      <AppLayout title="Admin" hideBanner>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </AppLayout>
    );
  }

  // Check admin access — après tous les hooks ET après que l'auth soit résolue
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  async function updateUserPlan(userId: string, newPlan: PlanType) {
    await supabase
      .from('profiles')
      .update({
        plan: newPlan,
        plan_status: newPlan === 'expired' ? 'expired' : 'active',
      })
      .eq('id', userId);
    queryClient.invalidateQueries({ queryKey: ['admin-all-profiles'] });
    toast({ title: 'Plan mis à jour' });
  }

  async function toggleAcademieAccess(userId: string, field: 'respire_academie_access' | 'can_grant_academie_access' | 'challenges_disabled', currentValue: boolean) {
    setAcademieUpdating(userId + field);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, [field]: !currentValue }, { onConflict: 'user_id' });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['admin-user-settings', userId] });
      // Invalide aussi le cache du hook useRespireAcademie pour que le bouton disparaisse immédiatement
      queryClient.invalidateQueries({ queryKey: ['respire-academie-access', userId] });
      const label = field === 'challenges_disabled'
        ? (!currentValue ? 'Challenges désactivés' : 'Challenges réactivés')
        : (!currentValue ? 'Accès accordé' : 'Accès retiré');
      toast({ title: label });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
    setAcademieUpdating(null);
  }

  const filtered = profiles.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(s) ||
      p.email?.toLowerCase().includes(s) ||
      p.invite_code?.toLowerCase().includes(s)
    );
  });

  async function loadUserStats(userId: string) {
    setLoadingStats(true);
    try {
      const [deals, commissions, team, contacts] = await Promise.all([
        supabase.from('deals').select('amount, status').eq('user_id', userId),
        supabase.from('commissions').select('amount').eq('user_id', userId),
        supabase.from('team_members').select('id').eq('user_id', userId),
        supabase.from('contacts').select('id').eq('user_id', userId),
      ]);

      const signedDeals = deals.data?.filter(d => d.status === 'signee') || [];
      setUserStats({
        deals: signedDeals.length,
        ca: signedDeals.reduce((s, d) => s + (d.amount || 0), 0),
        commissions: commissions.data?.reduce((s, c) => s + (c.amount || 0), 0) || 0,
        team: team.data?.length || 0,
        contacts: contacts.data?.length || 0,
      });
    } catch {
      setUserStats(null);
    }
    setLoadingStats(false);
  }

  function openUserDetail(profile: UserProfile) {
    setSelectedUser(profile);
    setUserStats(null);
    loadUserStats(profile.id);
  }

  async function deactivateUser() {
    if (!deleteTarget) return;

    // Unlink all team_members that point to this user
    await supabase
      .from('team_members')
      .update({ linked_user_id: null, status: 'inactif' })
      .eq('linked_user_id', deleteTarget.id);

    toast({ title: 'Compte désactivé', description: `${deleteTarget.full_name} a été désactivé.` });
    setDeleteTarget(null);
    setDeleteStep(0);
    setConfirmName('');
    queryClient.invalidateQueries({ queryKey: ['admin-all-profiles'] });
  }

  function viewAsUser(profile: UserProfile) {
    startImpersonation(profile.id, profile.full_name || 'Utilisateur', 'individual');
    toast({ title: 'Mode visualisation', description: `Vous voyez le compte de ${profile.full_name}` });
    navigate('/dashboard');
  }

  const sponsorName = (sponsorId: string | null) => {
    if (!sponsorId) return '—';
    const s = profiles.find(p => p.id === sponsorId);
    return s?.full_name || 'Inconnu';
  };

  return (
    <AppLayout title="Admin" hideBanner>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Administration Hyla</h2>
            <p className="text-xs text-gray-500">{profiles.length} utilisateurs inscrits</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par nom, email ou code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <Users className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-black text-blue-700">{profiles.length}</p>
            <p className="text-[10px] text-blue-500">Utilisateurs</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <Network className="h-4 w-4 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-black text-green-700">
              {profiles.filter(p => p.sponsor_user_id).length}
            </p>
            <p className="text-[10px] text-green-500">Parrainés</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <TrendingUp className="h-4 w-4 text-purple-500 mx-auto mb-1" />
            <p className="text-lg font-black text-purple-700">
              {new Set(profiles.map(p => p.sponsor_user_id).filter(Boolean)).size}
            </p>
            <p className="text-[10px] text-purple-500">Parrains actifs</p>
          </div>
        </div>

        {/* User list */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((profile) => (
              <div
                key={profile.id}
                className="bg-white rounded-xl border p-4 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => openUserDetail(profile)}
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {profile.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{profile.full_name || 'Sans nom'}</p>
                  <p className="text-xs text-gray-500 truncate">{profile.email || '—'}</p>
                  {profile.sponsor_user_id && (
                    <p className="text-[10px] text-blue-500">Parrainé par {sponsorName(profile.sponsor_user_id)}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <p className="text-[10px] text-gray-400">{new Date(profile.created_at).toLocaleDateString('fr-FR')}</p>
                  {profile.plan && (
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${PLAN_BADGE[profile.plan]?.className || ''}`}>
                      {PLAN_BADGE[profile.plan]?.label || profile.plan}
                    </span>
                  )}
                </div>
                {profile.id !== user?.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); viewAsUser(profile); }}
                    className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 hover:bg-blue-100 active:scale-95 transition-all flex-shrink-0"
                    title={`Voir le compte de ${profile.full_name}`}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* User detail dialog */}
        <Dialog open={!!selectedUser} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
          <DialogContent className="max-w-md">
            {selectedUser && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedUser.full_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Info */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-gray-400">Email</p>
                      <p className="font-medium text-xs truncate">{selectedUser.email || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-gray-400">Téléphone</p>
                      <p className="font-medium text-xs">{selectedUser.phone || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-gray-400">Code invitation</p>
                      <p className="font-medium text-xs font-mono">{selectedUser.invite_code || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-gray-400">Parrain</p>
                      <p className="font-medium text-xs">{sponsorName(selectedUser.sponsor_user_id)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 col-span-2">
                      <p className="text-[10px] text-gray-400">Inscrit le</p>
                      <p className="font-medium text-xs">{new Date(selectedUser.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>

                  {/* Fonctionnalités */}
                  <UserFeatureSettings
                    userId={selectedUser.id}
                    onToggle={(field, current) => toggleAcademieAccess(selectedUser.id, field, current)}
                    updating={academieUpdating}
                  />

                  {/* Plan */}
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 mb-2 font-semibold uppercase">Plan d'abonnement</p>
                    <div className="flex items-center gap-3">
                      {selectedUser.plan && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_BADGE[selectedUser.plan]?.className || ''}`}>
                          {PLAN_BADGE[selectedUser.plan]?.label || selectedUser.plan}
                        </span>
                      )}
                      <Select
                        value={selectedUser.plan || 'trial'}
                        onValueChange={(v) => updateUserPlan(selectedUser.id, v as PlanType)}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Changer le plan..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="legacy">Legacy</SelectItem>
                          <SelectItem value="trial">Essai</SelectItem>
                          <SelectItem value="conseillere">Conseillère</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="expired">Expiré</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Stats */}
                  {loadingStats ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : userStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                        <ShoppingBag className="h-3.5 w-3.5 text-blue-500 mx-auto mb-0.5" />
                        <p className="text-sm font-black text-blue-700">{userStats.deals}</p>
                        <p className="text-[9px] text-blue-500">Ventes</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2.5 text-center">
                        <TrendingUp className="h-3.5 w-3.5 text-green-500 mx-auto mb-0.5" />
                        <p className="text-sm font-black text-green-700">{userStats.ca.toLocaleString()}€</p>
                        <p className="text-[9px] text-green-500">CA Total</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                        <DollarSign className="h-3.5 w-3.5 text-purple-500 mx-auto mb-0.5" />
                        <p className="text-sm font-black text-purple-700">{userStats.commissions.toLocaleString()}€</p>
                        <p className="text-[9px] text-purple-500">Commissions</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                        <Users className="h-3.5 w-3.5 text-amber-500 mx-auto mb-0.5" />
                        <p className="text-sm font-black text-amber-700">{userStats.team}</p>
                        <p className="text-[9px] text-amber-500">Équipe</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5 text-center col-span-2">
                        <Users className="h-3.5 w-3.5 text-gray-500 mx-auto mb-0.5" />
                        <p className="text-sm font-black text-gray-700">{userStats.contacts}</p>
                        <p className="text-[9px] text-gray-500">Contacts</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 space-y-2">
                    {selectedUser.id !== user?.id && (
                      <button
                        onClick={() => { setSelectedUser(null); viewAsUser(selectedUser); }}
                        className="w-full py-2.5 bg-blue-50 text-blue-600 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <Eye className="h-4 w-4" />
                        Voir son compte
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedUser(null);
                        setDeleteTarget(selectedUser);
                        setDeleteStep(1);
                      }}
                      className="w-full py-2.5 bg-red-50 text-red-600 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <UserMinus className="h-4 w-4" />
                      Désactiver ce compte
                    </button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirmation - Step 1 */}
        <Dialog open={deleteStep === 1} onOpenChange={(open) => { if (!open) { setDeleteStep(0); setDeleteTarget(null); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Désactiver le compte
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Êtes-vous sûr de vouloir désactiver le compte de <span className="font-bold">{deleteTarget?.full_name}</span> ?
              Cette personne ne pourra plus se connecter.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setDeleteStep(0); setDeleteTarget(null); }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-semibold text-sm rounded-xl"
              >
                Annuler
              </button>
              <button
                onClick={() => setDeleteStep(2)}
                className="flex-1 py-2.5 bg-red-500 text-white font-semibold text-sm rounded-xl"
              >
                Continuer
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation - Step 2 */}
        <Dialog open={deleteStep === 2} onOpenChange={(open) => { if (!open) { setDeleteStep(0); setDeleteTarget(null); setConfirmName(''); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-red-600">Confirmation finale</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Tapez le nom complet <span className="font-bold">{deleteTarget?.full_name}</span> pour confirmer :
            </p>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Nom complet..."
              className="h-11"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteStep(0); setDeleteTarget(null); setConfirmName(''); }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-semibold text-sm rounded-xl"
              >
                Annuler
              </button>
              <button
                onClick={deactivateUser}
                disabled={confirmName.trim().toLowerCase() !== deleteTarget?.full_name?.toLowerCase()}
                className="flex-1 py-2.5 bg-red-500 text-white font-semibold text-sm rounded-xl disabled:opacity-30"
              >
                Désactiver définitivement
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
