import { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout, ALL_MOBILE_TABS } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, HYLA_LEVELS, type HylaLevel } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, GripVertical, FileText, Smartphone, Link2, Copy, Share2, Check, Users, AlertTriangle, Fingerprint, Eye, Target, CreditCard, TrendingUp, MoreHorizontal } from 'lucide-react';
import { useRespireAcademie } from '@/hooks/useRespireAcademie';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useThemeSafe } from '@/hooks/useTheme';
import { useEffectiveUserId, useEffectiveProfile } from '@/hooks/useEffectiveUser';
import { usePlan } from '@/hooks/usePlan';

interface FormQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  options?: string[]; // for select type
  required: boolean;
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function InviteLinkSection({ inviteCode, fullName }: { inviteCode?: string | null; fullName?: string | null }) {
  const [copied, setCopied] = useState(false);
  const inviteLink = inviteCode ? `${window.location.origin}/rejoindre/${inviteCode}` : '';

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Rejoins Hyla Assistant',
          text: `${fullName || 'Un partenaire'} t'invite à rejoindre Hyla Assistant !`,
          url: inviteLink,
        });
      } catch {}
    } else {
      copyLink();
    }
  };

  if (!inviteCode) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="h-4 w-4 text-blue-600" />
        <h3 className="text-base font-semibold text-foreground">Lien d'invitation</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Partagez ce lien pour inviter un autre manager ou conseiller à créer son espace Hyla Assistant. Aucun lien de subordination n'est créé — la personne aura son propre espace indépendant.
      </p>
      <div className="bg-card rounded-xl border border-blue-200 p-3 flex items-center gap-2">
        <code className="flex-1 text-xs text-blue-700 truncate font-mono">{inviteLink}</code>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-card border border-blue-200 text-blue-700 font-semibold text-sm rounded-xl active:scale-[0.98] transition-transform"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copié !' : 'Copier le lien'}
        </button>
        <button
          onClick={shareLink}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl active:scale-[0.98] transition-transform"
        >
          <Share2 className="h-4 w-4" />
          Partager
        </button>
      </div>
    </div>
  );
}

function ContactLinksSection({ inviteCode, userId }: { inviteCode?: string | null; userId?: string }) {
  const [copiedBio, setCopiedBio] = useState(false);
  const [copiedStory, setCopiedStory] = useState(false);
  const [copiedDirect, setCopiedDirect] = useState(false);

  const bioLink = inviteCode ? `${window.location.origin}/p/${inviteCode}?src=bio` : '';
  const storyLink = inviteCode ? `${window.location.origin}/p/${inviteCode}?src=story` : '';
  const directLink = inviteCode ? `${window.location.origin}/p/${inviteCode}` : '';

  const { data: leadCounts } = useQuery({
    queryKey: ['lead-counts', userId],
    queryFn: async () => {
      if (!userId) return { bio: 0, story: 0, direct: 0 };
      const { data } = await (supabase as any)
        .from('public_leads')
        .select('source')
        .eq('profile_id', userId);
      const counts = { bio: 0, story: 0, direct: 0 };
      (data || []).forEach((l: any) => {
        if (l.source === 'bio') counts.bio++;
        else if (l.source === 'story') counts.story++;
        else counts.direct++;
      });
      return counts;
    },
    enabled: !!userId,
    staleTime: 60000,
  });

  const copyLink = async (link: string, type: 'bio' | 'story' | 'direct') => {
    await navigator.clipboard.writeText(link);
    if (type === 'bio') {
      setCopiedBio(true);
      setTimeout(() => setCopiedBio(false), 2000);
    } else if (type === 'story') {
      setCopiedStory(true);
      setTimeout(() => setCopiedStory(false), 2000);
    } else {
      setCopiedDirect(true);
      setTimeout(() => setCopiedDirect(false), 2000);
    }
  };

  if (!inviteCode) return null;

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-4 w-4 text-green-600" />
        <h3 className="text-base font-semibold text-foreground">Page de contact</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Partagez ces liens sur vos réseaux sociaux. Les personnes intéressées rempliront un formulaire et seront ajoutées automatiquement à vos contacts.
      </p>

      {/* Bio link */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-foreground">Lien Bio (permanent)</span>
          {leadCounts && leadCounts.bio > 0 && (
            <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
              {leadCounts.bio} lead{leadCounts.bio > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <code className="flex-1 bg-card rounded-lg border border-green-200 px-3 py-2 text-[11px] text-green-700 truncate font-mono">
            {bioLink}
          </code>
          <button
            onClick={() => copyLink(bioLink, 'bio')}
            className="px-3 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg active:scale-[0.97]"
          >
            {copiedBio ? <Check className="h-3.5 w-3.5" /> : 'Copier'}
          </button>
        </div>
      </div>

      {/* Story link */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-foreground">Lien Story (tracking)</span>
          {leadCounts && leadCounts.story > 0 && (
            <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
              {leadCounts.story} lead{leadCounts.story > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <code className="flex-1 bg-card rounded-lg border border-purple-200 px-3 py-2 text-[11px] text-purple-700 truncate font-mono">
            {storyLink}
          </code>
          <button
            onClick={() => copyLink(storyLink, 'story')}
            className="px-3 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg active:scale-[0.97]"
          >
            {copiedStory ? <Check className="h-3.5 w-3.5" /> : 'Copier'}
          </button>
        </div>
      </div>

      {/* Direct link */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-foreground">Lien Direct (message privé)</span>
          {leadCounts && leadCounts.direct > 0 && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {leadCounts.direct} lead{leadCounts.direct > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <code className="flex-1 bg-card rounded-lg border border-blue-200 px-3 py-2 text-[11px] text-blue-700 truncate font-mono">
            {directLink}
          </code>
          <button
            onClick={() => copyLink(directLink, 'direct')}
            className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg active:scale-[0.97]"
          >
            {copiedDirect ? <Check className="h-3.5 w-3.5" /> : 'Copier'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { profile, isImpersonating } = useEffectiveProfile();
  const effectiveUserId = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const themeCtx = useThemeSafe();
  const { plan, isTrial, trialDaysLeft, trialEndsAt, planStatus } = usePlan();

  const goToCheckout = async (selectedPlan: 'conseillere' | 'manager') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ plan: selectedPlan, return_url: window.location.origin + '/settings' }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (e) {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [challengeStartDate, setChallengeStartDate] = useState('');
  const [savingChallengeDate, setSavingChallengeDate] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [showPurge, setShowPurge] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [purging, setPurging] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [monthlySalesTarget, setMonthlySalesTarget] = useState('');
  const [monthlyCaTarget, setMonthlyCaTarget] = useState('');
  const [savingObjectives, setSavingObjectives] = useState(false);
  const [hylaLevel, setHylaLevel] = useState<HylaLevel>('manager');
  const [savingLevel, setSavingLevel] = useState(false);

  // Mobile nav customization
  const { hasAccess: hasAcademieAccess } = useRespireAcademie();
  const availableTabs = ALL_MOBILE_TABS.filter(t => !(t as any).academieOnly || hasAcademieAccess);

  const getInitialTabs = () => {
    try {
      const saved = localStorage.getItem('hyla_mobile_tabs');
      if (saved) {
        const paths = JSON.parse(saved) as string[];
        // Filtre les onglets qui n'existent plus dans la liste disponible
        return paths.filter(p => availableTabs.some(t => t.to === p));
      }
    } catch {}
    return availableTabs.slice(0, 5).map(t => t.to);
  };
  const [selectedTabs, setSelectedTabs] = useState<string[]>(getInitialTabs);
  const [navDragOver, setNavDragOver] = useState<number | null>(null);

  // Touch drag-to-reorder (long press iOS-style)
  const touchDragRef = useRef<{ index: number; startY: number; itemHeightPx: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [touchDragOverIndex, setTouchDragOverIndex] = useState<number | null>(null);
  const navListRef = useRef<HTMLDivElement>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((index: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const itemEl = e.currentTarget as HTMLElement;
    const itemRect = itemEl.getBoundingClientRect();
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      // Haptic feedback si disponible
      navigator.vibrate?.(40);
      touchDragRef.current = { index, startY: touch.clientY, itemHeightPx: itemRect.height + 6 };
      setActiveDragIndex(index);
      setTouchDragOverIndex(index);
    }, 450);
  }, [cancelLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchDragRef.current) {
      // Pas encore en mode drag → annuler le long press si on bouge trop
      cancelLongPress();
      return;
    }
    // e.preventDefault() géré par le listener natif non-passif
    const touch = e.touches[0];
    const delta = touch.clientY - touchDragRef.current.startY;
    const steps = Math.round(delta / touchDragRef.current.itemHeightPx);
    const newIdx = Math.max(0, Math.min(selectedTabs.length - 1, touchDragRef.current.index + steps));
    setTouchDragOverIndex(newIdx);
  }, [cancelLongPress, selectedTabs.length]);

  const handleTouchEnd = useCallback(() => {
    cancelLongPress();
    if (touchDragRef.current !== null && touchDragOverIndex !== null) {
      const from = touchDragRef.current.index;
      const to = touchDragOverIndex;
      if (from !== to) {
        const arr = [...selectedTabs];
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        setSelectedTabs(arr);
        saveNav(arr);
      }
    }
    touchDragRef.current = null;
    setActiveDragIndex(null);
    setTouchDragOverIndex(null);
  }, [cancelLongPress, selectedTabs, touchDragOverIndex]);

  // Non-passive touchmove listener pour bloquer le scroll pendant le drag
  useEffect(() => {
    const el = navListRef.current;
    if (!el) return;
    const onNativeTouchMove = (e: TouchEvent) => {
      if (!touchDragRef.current) return;
      e.preventDefault();
    };
    el.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onNativeTouchMove);
  }, []);

  // Sauvegarde + application immédiate (pas de rechargement)
  const saveNav = (tabs: string[]) => {
    localStorage.setItem('hyla_mobile_tabs', JSON.stringify(tabs));
    window.dispatchEvent(new Event('hyla_nav_updated'));
  };

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone((profile as any).phone || '');
      if ((profile as any).challenge_start_date) {
        setChallengeStartDate((profile as any).challenge_start_date);
      }
    }
  }, [profile]);

  // Load form config (uses effective user ID — shows impersonated user's form config)
  const { data: formConfig } = useQuery({
    queryKey: ['form-config', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      const { data } = await supabase
        .from('objectif_form_config')
        .select('*')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      return data;
    },
    enabled: !!effectiveUserId,
    staleTime: 60000,
  });

  useEffect(() => {
    if (formConfig?.questions) {
      setQuestions(formConfig.questions as unknown as FormQuestion[]);
    }
  }, [formConfig]);

  const { data: userSettings } = useQuery({
    queryKey: ['user-settings', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      const { data } = await supabase
        .from('user_settings')
        .select('monthly_sales_target, monthly_ca_target, hyla_level')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      return data;
    },
    enabled: !!effectiveUserId,
    staleTime: 60000,
  });

  useEffect(() => {
    if (userSettings) {
      setMonthlySalesTarget(String((userSettings as any).monthly_sales_target ?? ''));
      setMonthlyCaTarget(String((userSettings as any).monthly_ca_target ?? ''));
      if ((userSettings as any).hyla_level) {
        setHylaLevel((userSettings as any).hyla_level as HylaLevel);
      }
    }
  }, [userSettings]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error, count } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone })
        .eq('id', effectiveUserId)
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      if (count === 0) throw new Error('Mise à jour bloquée (permissions insuffisantes)');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impersonated-profile', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile-onboarding', effectiveUserId] });
      toast({ title: 'Profil mis à jour' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const saveFormConfig = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('objectif_form_config')
        .upsert({
          user_id: effectiveUserId,
          questions: questions as unknown as Record<string, unknown>[],
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-config'] });
      toast({ title: 'Formulaire sauvegardé' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const addQuestion = () => {
    setQuestions([...questions, { id: generateId(), label: '', type: 'text', required: false }]);
  };

  const updateQuestion = (index: number, updates: Partial<FormQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const saveChallengeDate = async () => {
    if (!effectiveUserId) return;
    setSavingChallengeDate(true);
    const { error } = await supabase
      .from('profiles')
      .update({ challenge_start_date: challengeStartDate || null } as any)
      .eq('id', effectiveUserId);
    setSavingChallengeDate(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['profile-date'] });
      queryClient.invalidateQueries({ queryKey: ['profile-date-dash'] });
      toast({ title: 'Date sauvegardée', description: 'Tes challenges sont recalculés à partir de cette date.' });
    }
  };

  const saveLevel = async (level: HylaLevel) => {
    if (!user) return;
    setSavingLevel(true);
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: effectiveUserId, hyla_level: level, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (!error) {
      // Synchroniser aussi le niveau dans team_members (où ce compte est membre d'une équipe)
      await supabase
        .from('team_members')
        .update({ hyla_level: level })
        .eq('linked_user_id', effectiveUserId);
    }
    setSavingLevel(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setHylaLevel(level);
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['team-members-dash'] });
      toast({ title: 'Niveau mis à jour', description: `Niveau ${HYLA_LEVELS.find(l => l.value === level)?.label} enregistré.` });
    }
  };

  const saveObjectives = async () => {
    if (!user) return;
    setSavingObjectives(true);
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: effectiveUserId,
        monthly_sales_target: parseInt(monthlySalesTarget, 10) || 0,
        monthly_ca_target: parseInt(monthlyCaTarget, 10) || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    setSavingObjectives(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      toast({ title: 'Objectifs sauvegardés', description: 'Ils apparaîtront sur ton Dashboard.' });
    }
  };

  return (
    <AppLayout title="Paramètres">
      <div className="max-w-2xl space-y-8">

        {/* Impersonation banner */}
        {isImpersonating && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Eye className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium break-words">
              Vue en lecture — profil de <strong>{profile?.full_name || 'ce partenaire'}</strong>. Les modifications ne sont pas disponibles en mode impersonation.
            </p>
          </div>
        )}

        {/* Abonnement */}
        {!isImpersonating && (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-base font-semibold text-foreground">Mon abonnement</h3>
              {plan === 'legacy' && (
                <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">Accès partenaire</span>
              )}
              {isTrial && (
                <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Essai gratuit</span>
              )}
              {plan === 'conseillere' && !isTrial && (
                <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">Conseillère — 9,99€/mois</span>
              )}
              {plan === 'manager' && !isTrial && (
                <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">Manager — 29,99€/mois</span>
              )}
              {(plan === 'expired' || (!isTrial && planStatus === 'expired')) && plan !== 'legacy' && plan !== 'conseillere' && plan !== 'manager' && (
                <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600">Expiré</span>
              )}
            </div>

            {/* Trial actif */}
            {isTrial && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Il te reste <strong className="text-amber-600">{trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''}</strong> d'essai gratuit
                  {trialEndsAt && (
                    <> (jusqu'au {trialEndsAt.toLocaleDateString('fr-FR')})</>
                  )}.
                </p>
                <p className="text-xs text-muted-foreground">Choisis ton plan pour continuer à accéder à toutes les fonctionnalités après la période d'essai.</p>
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  <button
                    onClick={() => goToCheckout('conseillere')}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl active:scale-[0.98] transition-transform"
                  >
                    Conseillère — 9,99€/mois
                  </button>
                  <button
                    onClick={() => goToCheckout('manager')}
                    className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl active:scale-[0.98] transition-transform"
                  >
                    Manager — 29,99€/mois
                  </button>
                </div>
              </div>
            )}

            {/* Abonnement actif */}
            {(plan === 'conseillere' || plan === 'manager') && planStatus === 'active' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Ton abonnement <strong>{plan === 'manager' ? 'Manager' : 'Conseillère'}</strong> est actif.
                </p>
                <button
                  onClick={() => toast({ title: 'Bientôt disponible', description: 'La gestion du portail Stripe sera disponible prochainement.' })}
                  className="w-full py-2.5 bg-muted hover:bg-muted/70 text-foreground text-sm font-semibold rounded-xl transition-colors"
                >
                  Gérer mon abonnement
                </button>
              </div>
            )}

            {/* Legacy */}
            {plan === 'legacy' && (
              <p className="text-sm text-muted-foreground">Tu bénéficies d'un accès partenaire illimité. Aucun abonnement requis.</p>
            )}

            {/* Expiré */}
            {plan === 'expired' && (
              <div className="space-y-3">
                <p className="text-sm text-red-600 font-medium">Ton accès a expiré. Souscris à un plan pour réactiver l'application.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => goToCheckout('conseillere')}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl active:scale-[0.98] transition-transform"
                  >
                    Conseillère — 9,99€/mois
                  </button>
                  <button
                    onClick={() => goToCheckout('manager')}
                    className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl active:scale-[0.98] transition-transform"
                  >
                    Manager — 29,99€/mois
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">{isImpersonating ? 'Profil du partenaire' : 'Mon profil'}</h3>
          <div className="space-y-4">
            {/* ID Hyla Assistant */}
            {profile?.invite_code && (
              <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-3">
                <Fingerprint className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Mon ID Hyla Assistant</p>
                  <p className="text-sm font-bold text-blue-700 font-mono">{profile.invite_code.toUpperCase()}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(profile.invite_code!.toUpperCase());
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white text-[11px] font-semibold rounded-lg active:scale-[0.97]"
                >
                  {copiedId ? '✓ Copié' : 'Copier'}
                </button>
              </div>
            )}
            <div>
              <Label className="text-xs">Nom complet</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
            </div>
            <div>
              <Label className="text-xs">Email actuel</Label>
              <Input value={isImpersonating ? (profile as any)?.email || '' : user?.email || ''} disabled className="bg-muted h-11 text-muted-foreground" />
            </div>
            {!isImpersonating && (
              <div>
                <Label className="text-xs">Changer d'email</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Nouvelle adresse email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-11 flex-1"
                  />
                  <button
                    onClick={async () => {
                      if (!newEmail || newEmail === user?.email) return;
                      setEmailSaving(true);
                      const { error } = await supabase.auth.updateUser({ email: newEmail });
                      setEmailSaving(false);
                      if (error) {
                        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                      } else {
                        toast({ title: 'Email de confirmation envoyé', description: 'Vérifie ta nouvelle adresse email pour confirmer le changement.' });
                        setNewEmail('');
                      }
                    }}
                    disabled={emailSaving || !newEmail || newEmail === user?.email}
                    className="px-4 h-11 bg-muted hover:bg-muted/70 text-foreground font-semibold text-sm rounded-xl disabled:opacity-30 transition-colors whitespace-nowrap"
                  >
                    {emailSaving ? '...' : 'Modifier'}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Un email de confirmation sera envoyé aux deux adresses.</p>
              </div>
            )}
            <div>
              <Label className="text-xs">Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
            </div>
            <button
              onClick={() => saveProfile.mutate()}
              disabled={saveProfile.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isImpersonating ? `Sauvegarder le profil de ${profile?.full_name?.split(' ')[0] || 'ce compte'}` : 'Sauvegarder'}
            </button>
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">Apparence</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Mode sombre</p>
              <p className="text-xs text-muted-foreground">Basculer entre le thème clair et sombre</p>
            </div>
            <button
              onClick={() => themeCtx?.toggleTheme()}
              className={`relative w-12 h-7 rounded-full transition-colors ${themeCtx?.isDark ? 'bg-[#3b82f6]' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-card shadow transition-transform ${themeCtx?.isDark ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>

        {/* Challenges */}
        {!isImpersonating && (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-5">
            <h3 className="text-base font-semibold text-foreground mb-1">Mes challenges</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Date de départ de tes challenges Hyla (Compte à Rebours &amp; Rookie). Par défaut, la date de création de ton compte est utilisée.
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Date de départ des challenges</Label>
                <Input
                  type="date"
                  value={challengeStartDate}
                  onChange={(e) => setChallengeStartDate(e.target.value)}
                  className="h-11"
                />
              </div>
              <button
                onClick={saveChallengeDate}
                disabled={savingChallengeDate}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingChallengeDate ? 'Enregistrement...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        )}

        {/* Mes objectifs personnels */}
        {!isImpersonating && (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-blue-600" />
              <h3 className="text-base font-semibold text-foreground">Mes objectifs personnels</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Définis tes objectifs mensuels. Ils apparaîtront sur ton Dashboard comme barre de progression.
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Objectif ventes / mois</Label>
                <Input
                  type="number"
                  min="0"
                  value={monthlySalesTarget}
                  onChange={(e) => setMonthlySalesTarget(e.target.value)}
                  placeholder="Ex : 4"
                  className="h-11"
                />
              </div>
              <div>
                <Label className="text-xs">Objectif CA / mois (€)</Label>
                <Input
                  type="number"
                  min="0"
                  value={monthlyCaTarget}
                  onChange={(e) => setMonthlyCaTarget(e.target.value)}
                  placeholder="Ex : 3000"
                  className="h-11"
                />
              </div>
              <button
                onClick={saveObjectives}
                disabled={savingObjectives}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingObjectives ? 'Enregistrement...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        )}

        {/* Niveau Hyla */}
        {!isImpersonating && (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-violet-600" />
              <h3 className="text-base font-semibold text-foreground">Mon niveau Hyla</h3>
              <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Attribué par Hyla</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Ton niveau est attribué par Hyla lorsque les conditions sont remplies sur 3 mois consécutifs. Il calibre tous les calculs de commissions dans l'outil.
            </p>

            {/* Niveau actuel — mis en avant */}
            {(() => {
              const current = HYLA_LEVELS.find(l => l.value === hylaLevel);
              const currentIdx = HYLA_LEVELS.findIndex(l => l.value === hylaLevel);
              const next = HYLA_LEVELS[currentIdx + 1] || null;
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-violet-500 bg-violet-50 dark:bg-violet-950/30">
                    <div className={`h-3 w-3 rounded-full bg-gradient-to-br ${current?.color} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{current?.label}</p>
                      <p className="text-[11px] text-violet-500">{current?.conditions}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-base font-bold text-violet-600">{current?.recruteCommission}€</p>
                      <p className="text-[9px] text-violet-400">/ recrue</p>
                    </div>
                    <Check className="h-4 w-4 text-violet-600 flex-shrink-0" />
                  </div>

                  {/* Niveaux suivants — grisés */}
                  {HYLA_LEVELS.filter((_, i) => i > currentIdx).map((lvl) => (
                    <div key={lvl.value} className="flex items-center gap-3 p-3 rounded-xl border border-border opacity-50">
                      <div className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${lvl.color} flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{lvl.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{lvl.conditions}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-bold text-muted-foreground">{lvl.recruteCommission}€</p>
                        <p className="text-[10px] text-muted-foreground">/ recrue</p>
                      </div>
                    </div>
                  ))}

                  {/* Message prochain niveau */}
                  {next && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">
                      Prochain niveau : <span className="font-semibold text-violet-600">{next.label}</span> — vois ta progression sur le Dashboard
                    </p>
                  )}

                  {/* Override admin */}
                  {savingLevel && <p className="text-xs text-muted-foreground animate-pulse text-center">Enregistrement...</p>}
                  <details className="mt-2">
                    <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      ⚙ Forcer le niveau manuellement (admin)
                    </summary>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 pt-2 border-t border-border">
                      {HYLA_LEVELS.map((lvl) => (
                        <button
                          key={lvl.value}
                          onClick={() => saveLevel(lvl.value)}
                          disabled={savingLevel || hylaLevel === lvl.value}
                          className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all ${
                            hylaLevel === lvl.value
                              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 font-semibold'
                              : 'hover:bg-muted text-muted-foreground disabled:opacity-40'
                          }`}
                        >
                          <div className={`h-2 w-2 rounded-full bg-gradient-to-br ${lvl.color} flex-shrink-0`} />
                          {lvl.label}
                          {hylaLevel === lvl.value && <Check className="h-3 w-3 ml-auto text-violet-600" />}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              );
            })()}
          </div>
        )}

        {/* Invite Link */}
        <InviteLinkSection inviteCode={profile?.invite_code} fullName={profile?.full_name} />

        <ContactLinksSection inviteCode={profile?.invite_code} userId={effectiveUserId} />

        {/* Form Builder */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-blue-600" />
            <h3 className="text-base font-semibold text-foreground">Formulaire objectifs</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Configurez les questions envoyées à vos partenaires réseau. Elles apparaîtront dans le formulaire en plus des objectifs standard.
          </p>

          <div className="space-y-3 mb-4">
            {questions.map((q, index) => (
              <div key={q.id} className="bg-muted rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-gray-300 mt-2.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Input
                      value={q.label}
                      onChange={(e) => updateQuestion(index, { label: e.target.value })}
                      placeholder="Intitulé de la question..."
                      className="h-10 text-sm"
                    />
                    <div className="flex gap-2">
                      <Select value={q.type} onValueChange={(v) => updateQuestion(index, { type: v as FormQuestion['type'] })}>
                        <SelectTrigger className="h-9 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texte court</SelectItem>
                          <SelectItem value="textarea">Texte long</SelectItem>
                          <SelectItem value="number">Nombre</SelectItem>
                          <SelectItem value="select">Choix unique</SelectItem>
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                          className="rounded"
                        />
                        Obligatoire
                      </label>
                    </div>
                    {q.type === 'select' && (
                      <Input
                        value={(q.options || []).join(', ')}
                        onChange={(e) => updateQuestion(index, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="Options séparées par des virgules..."
                        className="h-9 text-xs"
                      />
                    )}
                  </div>
                  <button onClick={() => removeQuestion(index)} className="p-1.5 text-red-400 hover:text-red-600 mt-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {questions.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Aucune question personnalisée. Le formulaire standard sera envoyé.
              </div>
            )}
          </div>

          <button
            onClick={addQuestion}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-border text-muted-foreground font-medium rounded-xl text-xs hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter une question
          </button>

          {!isImpersonating && (
            <button
              onClick={() => saveFormConfig.mutate()}
              disabled={saveFormConfig.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 mt-4 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saveFormConfig.isPending ? 'Enregistrement...' : 'Sauvegarder le formulaire'}
            </button>
          )}
        </div>

        {/* Mobile Nav Customization */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-600" />
              <h3 className="text-base font-semibold text-foreground">Barre de navigation</h3>
            </div>
            {selectedTabs.length >= 2 && (
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">Appliqué ✓</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Active les onglets de ton choix. Sur mobile, <strong>reste appuyé</strong> sur un onglet puis glisse pour le réordonner.
          </p>

          {/* Live preview */}
          <div className="mb-4 rounded-2xl border border-border bg-muted/40 overflow-hidden">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase px-3 pt-2.5 pb-1.5">Aperçu de ta barre</p>
            <div className="flex items-center justify-around border-t border-border bg-card px-2 py-2">
              {selectedTabs.slice(0, 4).map((path) => {
                const tab = availableTabs.find(t => t.to === path);
                if (!tab) return null;
                const Icon = tab.icon;
                return (
                  <div key={path} className="flex flex-col items-center gap-0.5 px-2">
                    <div className="p-1.5 rounded-xl bg-[#3b82f6]/10">
                      <Icon className="h-4 w-4 text-[#3b82f6]" />
                    </div>
                    <span className="text-[9px] font-medium text-[#3b82f6]">{tab.label}</span>
                  </div>
                );
              })}
              {/* "Plus" slot si ≥ 5 tabs sélectionnés */}
              {selectedTabs.length >= 5 && (
                <div className="flex flex-col items-center gap-0.5 px-2">
                  <div className="p-1.5 rounded-xl">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-[9px] font-medium text-muted-foreground">Plus</span>
                </div>
              )}
              {/* Slots vides */}
              {Array.from({ length: Math.max(0, 4 - selectedTabs.length) }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 px-2 opacity-20">
                  <div className="p-1.5 rounded-xl border-2 border-dashed border-muted-foreground h-[34px] w-[34px]" />
                  <span className="text-[9px] text-muted-foreground">—</span>
                </div>
              ))}
            </div>
          </div>

          {/* Banner mode réorganisation actif */}
          {activeDragIndex !== null && (
            <div className="flex items-center justify-center gap-2 py-1.5 mb-2 bg-blue-500 text-white rounded-xl text-xs font-semibold animate-fade-in">
              <GripVertical className="h-3.5 w-3.5" />
              Glisse pour réordonner — relâche pour placer
            </div>
          )}

          {/* All tabs — actifs d'abord (drag), puis inactifs */}
          <div
            ref={navListRef}
            className="space-y-1.5"
            style={{ touchAction: 'auto' }}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Tous les onglets</p>

            {/* Actifs — draggables (desktop HTML5 + mobile long-press) */}
            {selectedTabs.map((path, index) => {
              const tab = availableTabs.find(t => t.to === path);
              if (!tab) return null;
              const Icon = tab.icon;
              const isInBar = index < 4;
              const isBeingDragged = activeDragIndex === index;
              const isDropTarget = touchDragOverIndex === index && activeDragIndex !== null && activeDragIndex !== index;
              return (
                <div
                  key={path}
                  /* ── Desktop drag ── */
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(index));
                    (e.currentTarget as HTMLElement).style.opacity = '0.4';
                  }}
                  onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; setNavDragOver(null); }}
                  onDragOver={(e) => { e.preventDefault(); setNavDragOver(index); }}
                  onDragLeave={() => setNavDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setNavDragOver(null);
                    const from = parseInt(e.dataTransfer.getData('text/plain'));
                    if (from === index) return;
                    const arr = [...selectedTabs];
                    const [moved] = arr.splice(from, 1);
                    arr.splice(index, 0, moved);
                    setSelectedTabs(arr);
                    saveNav(arr);
                  }}
                  /* ── Mobile long-press ── */
                  onTouchStart={(e) => handleTouchStart(index, e)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
                    isBeingDragged
                      ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500 shadow-lg scale-[1.02] z-10 relative'
                      : isDropTarget
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-400'
                      : navDragOver === index
                      ? 'bg-blue-100 dark:bg-blue-950/40 border-2 border-blue-400'
                      : 'bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <GripVertical className={`h-4 w-4 flex-shrink-0 ${isBeingDragged ? 'text-blue-500' : 'text-blue-300'}`} />
                  <span className={`text-[10px] font-bold w-4 flex-shrink-0 ${isInBar ? 'text-blue-500' : 'text-muted-foreground'}`}>
                    {index + 1}
                  </span>
                  <Icon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100 flex-1">{tab.label}</span>
                  {!isInBar && (
                    <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Plus</span>
                  )}
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      const arr = selectedTabs.filter(t => t !== path);
                      setSelectedTabs(arr);
                      saveNav(arr);
                    }}
                    className="p-1 text-blue-300 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Séparateur */}
            {availableTabs.some(t => !selectedTabs.includes(t.to)) && (
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[9px] text-muted-foreground uppercase font-semibold">Désactivés</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {/* Inactifs — tap pour ajouter */}
            {availableTabs.filter(t => !selectedTabs.includes(t.to)).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.to}
                  onClick={() => {
                    const arr = [...selectedTabs, tab.to];
                    setSelectedTabs(arr);
                    saveNav(arr);
                  }}
                  className="flex items-center gap-2.5 w-full bg-muted/50 border border-dashed border-border rounded-xl px-3 py-2.5 hover:bg-muted transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium text-muted-foreground">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {selectedTabs.length < 2 && (
            <p className="text-[11px] text-amber-600 text-center mt-3 font-medium">Active au moins 2 onglets</p>
          )}
        </div>
        {/* Purge Data — hidden when impersonating */}
        {!isImpersonating && <div className="bg-card rounded-2xl shadow-sm border border-red-100 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h3 className="text-base font-semibold text-red-600">Zone dangereuse</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Supprimez toutes vos données (contacts, ventes, tâches, commissions, réseau, leads). Votre compte sera conservé.
          </p>
          {!showPurge ? (
            <button
              onClick={() => setShowPurge(true)}
              className="w-full py-3 border-2 border-red-200 text-red-600 font-semibold rounded-xl text-sm hover:bg-red-50 transition-colors"
            >
              Supprimer toutes mes données
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-xs text-red-700 font-medium mb-1">⚠️ Cette action est irréversible !</p>
                <p className="text-[11px] text-red-600">
                  Tapez <strong>SUPPRIMER</strong> pour confirmer la suppression de toutes vos données.
                </p>
              </div>
              <Input
                value={purgeConfirm}
                onChange={(e) => setPurgeConfirm(e.target.value)}
                placeholder="Tapez SUPPRIMER"
                className="h-11 border-red-200 focus:ring-red-500/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowPurge(false); setPurgeConfirm(''); }}
                  className="flex-1 py-2.5 bg-muted text-foreground font-semibold rounded-xl text-sm"
                >
                  Annuler
                </button>
                <button
                  disabled={purgeConfirm !== 'SUPPRIMER' || purging}
                  onClick={async () => {
                    if (!user || !effectiveUserId) return;
                    if (isImpersonating) {
                      toast({ title: 'Action bloquée', description: 'Impossible de purger les données en mode impersonation.', variant: 'destructive' });
                      return;
                    }
                    setPurging(true);
                    try {
                      // Delete in order (foreign keys)
                      await supabase.from('commission_import_rows').delete().filter('import_id', 'in', `(select id from commission_imports where user_id='${effectiveUserId}')`);
                      await supabase.from('commission_imports').delete().eq('user_id', effectiveUserId);
                      await supabase.from('commissions').delete().eq('user_id', effectiveUserId);
                      await supabase.from('deals').delete().eq('user_id', effectiveUserId);
                      await supabase.from('tasks').delete().eq('user_id', effectiveUserId);
                      await supabase.from('member_objectives').delete().filter('member_id', 'in', `(select id from team_members where user_id='${effectiveUserId}')`);
                      await supabase.from('team_members').delete().eq('user_id', effectiveUserId);
                      await supabase.from('contacts').delete().eq('user_id', effectiveUserId);
                      await supabase.from('pipeline_stages').delete().eq('user_id', effectiveUserId);
                      await supabase.from('public_leads').delete().eq('profile_id', effectiveUserId);
                      await supabase.from('calendar_events').delete().eq('user_id', effectiveUserId);
                      queryClient.invalidateQueries();
                      toast({ title: 'Données supprimées', description: 'Toutes vos données ont été effacées.' });
                      setShowPurge(false);
                      setPurgeConfirm('');
                    } catch (err: any) {
                      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
                    }
                    setPurging(false);
                  }}
                  className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-sm disabled:opacity-30"
                >
                  {purging ? 'Suppression...' : 'Confirmer'}
                </button>
              </div>
            </div>
          )}
        </div>}
      </div>
    </AppLayout>
  );
}
