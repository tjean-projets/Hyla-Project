import { useState, useEffect } from 'react';
import { AppLayout, ALL_MOBILE_TABS } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, GripVertical, FileText, Smartphone, Link2, Copy, Share2, Check, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

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
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="h-4 w-4 text-blue-600" />
        <h3 className="text-base font-semibold text-gray-900">Lien d'invitation</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Partagez ce lien pour inviter un autre manager ou conseiller à créer son espace Hyla Assistant. Aucun lien de subordination n'est créé — la personne aura son propre espace indépendant.
      </p>
      <div className="bg-white rounded-xl border border-blue-200 p-3 flex items-center gap-2">
        <code className="flex-1 text-xs text-blue-700 truncate font-mono">{inviteLink}</code>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-blue-200 text-blue-700 font-semibold text-sm rounded-xl active:scale-[0.98] transition-transform"
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

  const bioLink = inviteCode ? `${window.location.origin}/p/${inviteCode}?src=bio` : '';
  const storyLink = inviteCode ? `${window.location.origin}/p/${inviteCode}?src=story` : '';

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
  });

  const copyLink = async (link: string, type: 'bio' | 'story') => {
    await navigator.clipboard.writeText(link);
    if (type === 'bio') {
      setCopiedBio(true);
      setTimeout(() => setCopiedBio(false), 2000);
    } else {
      setCopiedStory(true);
      setTimeout(() => setCopiedStory(false), 2000);
    }
  };

  if (!inviteCode) return null;

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-4 w-4 text-green-600" />
        <h3 className="text-base font-semibold text-gray-900">Page de contact</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Partagez ces liens sur vos réseaux sociaux. Les personnes intéressées rempliront un formulaire et seront ajoutées automatiquement à vos contacts.
      </p>

      {/* Bio link */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-700">Lien Bio (permanent)</span>
          {leadCounts && leadCounts.bio > 0 && (
            <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
              {leadCounts.bio} lead{leadCounts.bio > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <code className="flex-1 bg-white rounded-lg border border-green-200 px-3 py-2 text-[11px] text-green-700 truncate font-mono">
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
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-700">Lien Story (tracking)</span>
          {leadCounts && leadCounts.story > 0 && (
            <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
              {leadCounts.story} lead{leadCounts.story > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <code className="flex-1 bg-white rounded-lg border border-purple-200 px-3 py-2 text-[11px] text-purple-700 truncate font-mono">
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
    </div>
  );
}

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);

  // Mobile nav customization
  const getInitialTabs = () => {
    try {
      const saved = localStorage.getItem('hyla_mobile_tabs');
      if (saved) return JSON.parse(saved) as string[];
    } catch {}
    return ALL_MOBILE_TABS.slice(0, 5).map(t => t.to);
  };
  const [selectedTabs, setSelectedTabs] = useState<string[]>(getInitialTabs);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  // Load form config
  const { data: formConfig } = useQuery({
    queryKey: ['form-config', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('objectif_form_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (formConfig?.questions) {
      setQuestions(formConfig.questions as unknown as FormQuestion[]);
    }
  }, [formConfig]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'Profil mis à jour' }),
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const saveFormConfig = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('objectif_form_config')
        .upsert({
          user_id: user.id,
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

  return (
    <AppLayout title="Paramètres">
      <div className="max-w-2xl space-y-8">
        {/* Profile */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Mon profil</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nom complet</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
            </div>
            <div>
              <Label className="text-xs">Email actuel</Label>
              <Input value={user?.email || ''} disabled className="bg-gray-50 h-11 text-gray-500" />
            </div>
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
                  className="px-4 h-11 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl disabled:opacity-30 transition-colors whitespace-nowrap"
                >
                  {emailSaving ? '...' : 'Modifier'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Un email de confirmation sera envoyé aux deux adresses.</p>
            </div>
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
              Sauvegarder
            </button>
          </div>
        </div>

        {/* Invite Link */}
        <InviteLinkSection inviteCode={profile?.invite_code} fullName={profile?.full_name} />

        <ContactLinksSection inviteCode={profile?.invite_code} userId={user?.id} />

        {/* Form Builder */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-blue-600" />
            <h3 className="text-base font-semibold text-gray-900">Formulaire objectifs</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Configurez les questions envoyées à vos partenaires réseau. Elles apparaîtront dans le formulaire en plus des objectifs standard.
          </p>

          <div className="space-y-3 mb-4">
            {questions.map((q, index) => (
              <div key={q.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
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
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
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
              <div className="text-center py-6 text-sm text-gray-400">
                Aucune question personnalisée. Le formulaire standard sera envoyé.
              </div>
            )}
          </div>

          <button
            onClick={addQuestion}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-gray-200 text-gray-500 font-medium rounded-xl text-xs hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter une question
          </button>

          <button
            onClick={() => saveFormConfig.mutate()}
            disabled={saveFormConfig.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 mt-4 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveFormConfig.isPending ? 'Enregistrement...' : 'Sauvegarder le formulaire'}
          </button>
        </div>

        {/* Mobile Nav Customization */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="h-4 w-4 text-blue-600" />
            <h3 className="text-base font-semibold text-gray-900">Barre de navigation</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Choisis 5 onglets et leur ordre pour la barre du bas sur mobile.
          </p>

          {/* Selected tabs (drag to reorder) */}
          <div className="space-y-1.5 mb-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase">Onglets actifs (maintiens et glisse)</p>
            {selectedTabs.map((path, index) => {
              const tab = ALL_MOBILE_TABS.find(t => t.to === path);
              if (!tab) return null;
              const Icon = tab.icon;
              return (
                <div
                  key={path}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(index)); (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
                  onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; }}
                  onDragLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#bfdbfe'; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).style.borderColor = '#bfdbfe';
                    const from = parseInt(e.dataTransfer.getData('text/plain'));
                    const to = index;
                    if (from === to) return;
                    const arr = [...selectedTabs];
                    const [moved] = arr.splice(from, 1);
                    arr.splice(to, 0, moved);
                    setSelectedTabs(arr);
                  }}
                  onTouchStart={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    const touch = e.touches[0];
                    const rect = el.getBoundingClientRect();
                    el.dataset.dragIndex = String(index);
                    el.dataset.startY = String(touch.clientY);
                    el.dataset.offsetY = String(touch.clientY - rect.top);
                    el.style.zIndex = '50';
                    el.style.transition = 'none';
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    const el = e.currentTarget as HTMLElement;
                    const touch = e.touches[0];
                    const parent = el.parentElement;
                    if (!parent) return;
                    const siblings = Array.from(parent.querySelectorAll('[draggable]')) as HTMLElement[];
                    const currentIdx = parseInt(el.dataset.dragIndex || '0');
                    // Find which sibling we're hovering over
                    for (let i = 0; i < siblings.length; i++) {
                      if (i === currentIdx) continue;
                      const sRect = siblings[i].getBoundingClientRect();
                      if (touch.clientY > sRect.top && touch.clientY < sRect.bottom) {
                        const arr = [...selectedTabs];
                        const [moved] = arr.splice(currentIdx, 1);
                        arr.splice(i, 0, moved);
                        setSelectedTabs(arr);
                        el.dataset.dragIndex = String(i);
                        break;
                      }
                    }
                  }}
                  onTouchEnd={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.zIndex = '';
                    el.style.transition = '';
                  }}
                  className="flex items-center gap-2 bg-blue-50 border-2 border-blue-200 rounded-xl px-3 py-3 cursor-grab active:cursor-grabbing select-none touch-none"
                >
                  <GripVertical className="h-4 w-4 text-blue-300 flex-shrink-0" />
                  <span className="text-xs text-blue-400 font-bold w-4">{index + 1}</span>
                  <Icon className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800 flex-1">{tab.label}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedTabs(selectedTabs.filter(t => t !== path)); }}
                    className="p-1.5 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Available tabs to add */}
          {selectedTabs.length < 5 && (
            <div className="space-y-1.5 mb-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Disponibles</p>
              {ALL_MOBILE_TABS.filter(t => !selectedTabs.includes(t.to)).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.to}
                    onClick={() => {
                      if (selectedTabs.length < 5) {
                        setSelectedTabs([...selectedTabs, tab.to]);
                      }
                    }}
                    className="flex items-center gap-2 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-100 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 text-gray-400" />
                    <Icon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => {
              localStorage.setItem('hyla_mobile_tabs', JSON.stringify(selectedTabs));
              toast({ title: 'Navigation sauvegardée', description: 'Recharge la page pour voir les changements.' });
            }}
            disabled={selectedTabs.length !== 5}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Sauvegarder la navigation
          </button>
          {selectedTabs.length !== 5 && (
            <p className="text-[10px] text-red-500 text-center mt-1">Sélectionne exactement 5 onglets</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
