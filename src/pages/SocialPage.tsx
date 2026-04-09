import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link2, Copy, Check, Share2, BarChart2, Users, ChevronRight,
  Plus, Trash2, ToggleLeft, ToggleRight, ExternalLink,
  Phone, Calendar, Sparkles, AlertCircle, ChevronDown, ChevronUp,
  UserPlus, MessageSquare, ShoppingBag, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// ── Types ──
interface SurveyQuestion {
  id: string;
  text: string;
  type: 'choice' | 'text';
  choices?: string[];
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  is_active: boolean;
  created_at: string;
  response_count?: number;
}

interface PublicLead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  message: string | null;
  intent: 'acheter' | 'devenir_conseiller' | 'en_savoir_plus';
  source: 'bio' | 'story' | 'direct';
  status: 'nouveau' | 'converti';
  created_at: string;
}

const TABS = [
  { id: 'bio', label: 'Lien Bio', icon: Link2 },
  { id: 'surveys', label: 'Sondages', icon: Share2 },
  { id: 'leads', label: 'Leads reçus', icon: Users },
] as const;
type TabId = typeof TABS[number]['id'];

const INTENT_LABELS = {
  acheter: { label: 'Achat', color: 'bg-emerald-100 text-emerald-700' },
  devenir_conseiller: { label: 'Recrut.', color: 'bg-violet-100 text-violet-700' },
  en_savoir_plus: { label: 'Info', color: 'bg-blue-100 text-blue-700' },
};
const SOURCE_LABELS = {
  bio: { label: 'Bio', color: 'bg-pink-100 text-pink-700' },
  story: { label: 'Story', color: 'bg-orange-100 text-orange-700' },
  direct: { label: 'Direct', color: 'bg-gray-100 text-gray-600' },
};

function genId() { return Math.random().toString(36).slice(2, 8); }

// ── Create Survey Modal ──
function CreateSurveyModal({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (v: boolean) => void; userId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    { id: genId(), text: '', type: 'choice', choices: ['', ''] },
  ]);

  const save = useMutation({
    mutationFn: async () => {
      const cleanQuestions = questions
        .filter(q => q.text.trim())
        .map(q => ({
          ...q,
          choices: q.type === 'choice' ? (q.choices || []).filter(c => c.trim()) : undefined,
        }));
      if (!title.trim() || cleanQuestions.length === 0) throw new Error('Titre et au moins une question requis');
      const { error } = await supabase.from('social_surveys').insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        questions: cleanQuestions,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-surveys'] });
      toast({ title: 'Sondage créé !' });
      onOpenChange(false);
      setTitle(''); setDescription('');
      setQuestions([{ id: genId(), text: '', type: 'choice', choices: ['', ''] }]);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const addQuestion = () => {
    if (questions.length >= 5) return;
    setQuestions([...questions, { id: genId(), text: '', type: 'choice', choices: ['', ''] }]);
  };

  const updateQuestion = (idx: number, patch: Partial<SurveyQuestion>) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], ...patch };
    if (patch.type === 'choice' && !updated[idx].choices?.length) updated[idx].choices = ['', ''];
    setQuestions(updated);
  };

  const updateChoice = (qIdx: number, cIdx: number, val: string) => {
    const updated = [...questions];
    const choices = [...(updated[qIdx].choices || [])];
    choices[cIdx] = val;
    updated[qIdx] = { ...updated[qIdx], choices };
    setQuestions(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-base">Créer un sondage</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Titre du sondage *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Quel est ton rapport à l'eau ?" className="h-10 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description (optionnelle)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Sondage pour mieux vous connaître" className="h-10 mt-1" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Questions ({questions.length}/5)</p>
              {questions.length < 5 && (
                <button onClick={addQuestion} className="text-xs text-blue-500 font-medium flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Ajouter
                </button>
              )}
            </div>

            {questions.map((q, qi) => (
              <div key={q.id} className="bg-muted rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground mt-2.5 flex-shrink-0">Q{qi + 1}</span>
                  <Input
                    value={q.text}
                    onChange={e => updateQuestion(qi, { text: e.target.value })}
                    placeholder="Texte de la question..."
                    className="h-9 text-xs flex-1"
                  />
                  {questions.length > 1 && (
                    <button onClick={() => setQuestions(questions.filter((_, i) => i !== qi))} className="mt-1 text-muted-foreground hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2 ml-5">
                  <button
                    onClick={() => updateQuestion(qi, { type: 'choice' })}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${q.type === 'choice' ? 'bg-blue-100 text-blue-700' : 'bg-card text-muted-foreground'}`}
                  >
                    Choix multiple
                  </button>
                  <button
                    onClick={() => updateQuestion(qi, { type: 'text' })}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${q.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-card text-muted-foreground'}`}
                  >
                    Réponse libre
                  </button>
                </div>

                {q.type === 'choice' && (
                  <div className="ml-5 space-y-1.5">
                    {(q.choices || []).map((c, ci) => (
                      <div key={ci} className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        <Input
                          value={c}
                          onChange={e => updateChoice(qi, ci, e.target.value)}
                          placeholder={`Option ${ci + 1}`}
                          className="h-8 text-xs"
                        />
                        {(q.choices || []).length > 2 && (
                          <button onClick={() => {
                            const choices = (q.choices || []).filter((_, i) => i !== ci);
                            updateQuestion(qi, { choices });
                          }} className="text-muted-foreground hover:text-red-500 flex-shrink-0">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {(q.choices || []).length < 5 && (
                      <button
                        onClick={() => updateQuestion(qi, { choices: [...(q.choices || []), ''] })}
                        className="text-[11px] text-blue-500 flex items-center gap-1 ml-6"
                      >
                        <Plus className="h-3 w-3" /> Option
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !title.trim()}
            className="w-full py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {save.isPending ? 'Création...' : 'Créer le sondage'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Survey Response Detail ──
function SurveyResponses({ survey, responses }: { survey: Survey; responses: any[] }) {
  return (
    <div className="space-y-4 mt-2">
      {survey.questions.map(q => {
        if (q.type === 'choice') {
          const counts: Record<string, number> = {};
          (q.choices || []).forEach(c => { counts[c] = 0; });
          responses.forEach(r => {
            const ans = r.answers?.[q.id];
            if (ans && counts[ans] !== undefined) counts[ans]++;
          });
          const total = Object.values(counts).reduce((s, v) => s + v, 0);
          return (
            <div key={q.id} className="bg-muted rounded-xl p-3">
              <p className="text-xs font-semibold text-foreground mb-2">{q.text}</p>
              {Object.entries(counts).map(([choice, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={choice} className="mb-1.5">
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-muted-foreground truncate flex-1 mr-2">{choice}</span>
                      <span className="font-semibold text-foreground flex-shrink-0">{pct}% ({count})</span>
                    </div>
                    <div className="h-1.5 bg-card rounded-full overflow-hidden">
                      <div className="h-full bg-[#3b82f6] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }
        // text question
        const answers = responses.map(r => r.answers?.[q.id]).filter(Boolean);
        return (
          <div key={q.id} className="bg-muted rounded-xl p-3">
            <p className="text-xs font-semibold text-foreground mb-2">{q.text}</p>
            {answers.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Aucune réponse</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {answers.slice(0, 20).map((a, i) => (
                  <p key={i} className="text-[11px] text-foreground bg-card rounded-lg px-2.5 py-1.5">"{a}"</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {responses.length > 0 && (
        <div className="bg-muted rounded-xl p-3">
          <p className="text-xs font-semibold text-foreground mb-2">Coordonnées recueillies</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {responses.filter(r => r.respondent_name || r.respondent_phone).map(r => (
              <div key={r.id} className="flex items-center gap-2 text-[11px] bg-card rounded-lg px-2.5 py-1.5">
                <span className="font-medium text-foreground">{r.respondent_name || '—'}</span>
                {r.respondent_phone && <span className="text-muted-foreground">{r.respondent_phone}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function SocialPage() {
  const { user, profile } = useAuth();
  const effectiveId = useEffectiveUserId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('bio');
  const [copiedBio, setCopiedBio] = useState<string | null>(null);
  const [createSurveyOpen, setCreateSurveyOpen] = useState(false);
  const [expandedSurvey, setExpandedSurvey] = useState<string | null>(null);

  const bioUrl = profile?.invite_code
    ? `${window.location.origin}/p/${profile.invite_code}`
    : null;

  // ── Queries ──
  const { data: leads = [] } = useQuery<PublicLead[]>({
    queryKey: ['public-leads', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await (supabase as any)
        .from('public_leads')
        .select('*')
        .eq('profile_id', effectiveId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: surveys = [] } = useQuery<Survey[]>({
    queryKey: ['social-surveys', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('social_surveys')
        .select('*')
        .eq('user_id', effectiveId)
        .order('created_at', { ascending: false });
      if (!data) return [];
      // Fetch response counts
      const withCounts = await Promise.all(data.map(async s => {
        const { count } = await supabase
          .from('social_survey_responses')
          .select('id', { count: 'exact', head: true })
          .eq('survey_id', s.id);
        return { ...s, response_count: count || 0, questions: s.questions as SurveyQuestion[] };
      }));
      return withCounts;
    },
    enabled: !!effectiveId,
  });

  const { data: surveyResponses = [] } = useQuery({
    queryKey: ['survey-responses', expandedSurvey],
    queryFn: async () => {
      if (!expandedSurvey) return [];
      const { data } = await supabase
        .from('social_survey_responses')
        .select('*')
        .eq('survey_id', expandedSurvey)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!expandedSurvey,
  });

  // ── Mutations ──
  const toggleSurvey = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from('social_surveys').update({ is_active: !is_active }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-surveys'] }),
  });

  const deleteSurvey = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('social_surveys').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-surveys'] });
      if (expandedSurvey) setExpandedSurvey(null);
    },
  });

  const convertLead = useMutation({
    mutationFn: async (lead: PublicLead) => {
      if (!effectiveId) throw new Error();
      const { error } = await supabase.from('contacts').insert({
        user_id: effectiveId,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phone,
        email: lead.email || null,
        notes: lead.message || null,
        source: `Lien bio (${lead.intent})`,
        status: lead.intent === 'devenir_conseiller' ? 'recrue' : 'prospect',
      });
      if (error) throw error;
      await (supabase as any).from('public_leads').update({ status: 'converti' }).eq('id', lead.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-leads'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: 'Contact créé !' });
    },
    onError: () => toast({ title: 'Erreur lors de la conversion', variant: 'destructive' }),
  });

  const copyLink = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedBio(key);
    setTimeout(() => setCopiedBio(null), 2000);
  };

  // ── Computed stats ──
  const leadsBySource = { bio: 0, story: 0, direct: 0 };
  const leadsByIntent = { acheter: 0, devenir_conseiller: 0, en_savoir_plus: 0 };
  leads.forEach(l => {
    leadsBySource[l.source]++;
    leadsByIntent[l.intent]++;
  });

  const expandedSurveyData = surveys.find(s => s.id === expandedSurvey);

  return (
    <AppLayout title="Réseaux Sociaux">
      <div className="space-y-4">

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* ══════════ TAB: LIEN BIO ══════════ */}
        {activeTab === 'bio' && (
          <div className="space-y-4">
            {/* Tip banner */}
            <div className="flex items-start gap-3 bg-gradient-to-r from-pink-50 to-violet-50 border border-pink-100 rounded-xl p-3.5">
              <Sparkles className="h-4 w-4 text-pink-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700">
                <span className="font-semibold">Mets ton lien dans ta bio Instagram</span> pour capter des leads 24h/24. Chaque visiteur qui clique peut te laisser ses coordonnées directement.
              </p>
            </div>

            {!bioUrl ? (
              <div className="bg-card rounded-2xl border border-border p-6 text-center">
                <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Ton code d'invitation n'est pas encore configuré. Va dans <strong>Paramètres</strong> pour le générer.</p>
              </div>
            ) : (
              <>
                {/* Links */}
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-foreground">Tes liens partageables</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Le paramètre <code>?src=</code> te permet de savoir d'où viennent tes leads</p>
                  </div>
                  {[
                    { key: 'bio', label: 'Lien Bio', suffix: '?src=bio', desc: 'Pour ta bio Instagram / TikTok', color: 'text-pink-600 bg-pink-50' },
                    { key: 'story', label: 'Lien Story', suffix: '?src=story', desc: 'Pour tes stories avec lien', color: 'text-orange-600 bg-orange-50' },
                    { key: 'direct', label: 'Lien Direct', suffix: '', desc: 'À partager en message privé', color: 'text-blue-600 bg-blue-50' },
                  ].map(item => {
                    const url = `${bioUrl}${item.suffix}`;
                    const copied = copiedBio === item.key;
                    return (
                      <div key={item.key} className="px-4 py-3 flex items-center gap-3 border-b border-border last:border-0">
                        <div className={`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg ${item.color}`}>{item.label}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{url}</p>
                          <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => copyLink(url, item.key)}
                          className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors"
                        >
                          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? 'Copié' : 'Copier'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Preview link */}
                <a
                  href={`${bioUrl}?src=bio`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Voir ta page publique
                </a>

                {/* Lead stats */}
                {leads.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Leads reçus via lien bio</p>
                      <span className="text-xs font-bold text-[#3b82f6]">{leads.length} total</span>
                    </div>
                    <div className="grid grid-cols-3 gap-px bg-border">
                      {Object.entries(leadsBySource).map(([src, count]) => (
                        <div key={src} className="bg-card px-3 py-2.5 text-center">
                          <p className="text-lg font-bold text-foreground">{count}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{src}</p>
                        </div>
                      ))}
                    </div>
                    {/* Last 3 leads */}
                    <div className="divide-y divide-border">
                      {leads.slice(0, 3).map(lead => {
                        const intent = INTENT_LABELS[lead.intent];
                        return (
                          <div key={lead.id} className="px-4 py-2.5 flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground">{lead.first_name} {lead.last_name}</p>
                              <p className="text-[10px] text-muted-foreground">{lead.phone}</p>
                            </div>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${intent.color}`}>{intent.label}</span>
                            {lead.status === 'nouveau' && (
                              <button
                                onClick={() => convertLead.mutate(lead)}
                                className="text-[10px] text-blue-500 font-medium hover:underline whitespace-nowrap"
                              >
                                + Contact
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {leads.length > 3 && (
                      <button
                        onClick={() => setActiveTab('leads')}
                        className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                      >
                        Voir tous les leads <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════ TAB: SONDAGES ══════════ */}
        {activeTab === 'surveys' && (
          <div className="space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3.5">
              <MessageSquare className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Sondages personnalisés</span> — crée un sondage, partage le lien en story ou en bio, et récupère les réponses ici avec les coordonnées des participants. Les sondages natifs Instagram ne peuvent pas être connectés à des apps tierces.
              </p>
            </div>

            <button
              onClick={() => setCreateSurveyOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#3b82f6] text-white font-semibold rounded-xl active:scale-[0.98] transition-transform"
            >
              <Plus className="h-4 w-4" />
              Créer un sondage
            </button>

            {surveys.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                <Share2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucun sondage créé</p>
                <p className="text-xs text-muted-foreground mt-1">Crée ton premier sondage et partage le lien dans ta bio ou tes stories.</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
                {surveys.map(survey => {
                  const surveyUrl = `${window.location.origin}/sondage/${survey.id}`;
                  const isExpanded = expandedSurvey === survey.id;
                  return (
                    <div key={survey.id}>
                      <div className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">{survey.title}</p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${survey.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {survey.is_active ? 'Actif' : 'Inactif'}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {survey.questions.length} question{survey.questions.length > 1 ? 's' : ''} • {survey.response_count} réponse{(survey.response_count || 0) > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            onClick={() => copyLink(surveyUrl, survey.id)}
                            className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            {copiedBio === survey.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            {copiedBio === survey.id ? 'Copié !' : 'Copier lien'}
                          </button>
                          <button
                            onClick={() => toggleSurvey.mutate({ id: survey.id, is_active: survey.is_active })}
                            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-muted px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            {survey.is_active ? <ToggleRight className="h-3 w-3 text-green-500" /> : <ToggleLeft className="h-3 w-3" />}
                            {survey.is_active ? 'Désactiver' : 'Activer'}
                          </button>
                          {(survey.response_count || 0) > 0 && (
                            <button
                              onClick={() => setExpandedSurvey(isExpanded ? null : survey.id)}
                              className="flex items-center gap-1 text-[11px] font-medium text-violet-600 bg-violet-50 px-2.5 py-1.5 rounded-lg hover:bg-violet-100 transition-colors ml-auto"
                            >
                              <BarChart2 className="h-3 w-3" />
                              Résultats
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          )}
                          <button
                            onClick={() => { if (confirm('Supprimer ce sondage ?')) deleteSurvey.mutate(survey.id); }}
                            className="ml-auto text-muted-foreground hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Results accordion */}
                      {isExpanded && expandedSurveyData && (
                        <div className="px-4 pb-4 bg-muted/30 border-t border-border">
                          <SurveyResponses survey={expandedSurveyData} responses={surveyResponses} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {user && <CreateSurveyModal open={createSurveyOpen} onOpenChange={setCreateSurveyOpen} userId={user.id} />}
          </div>
        )}

        {/* ══════════ TAB: LEADS REÇUS ══════════ */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            {/* Stats */}
            {leads.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(leadsBySource).map(([src, count]) => (
                    <div key={src} className="bg-card border border-border rounded-2xl p-3 text-center">
                      <p className="text-xl font-bold text-foreground">{count}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{src}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                    <ShoppingBag className="h-4 w-4 text-emerald-600 mx-auto mb-0.5" />
                    <p className="text-lg font-bold text-emerald-700">{leadsByIntent.acheter}</p>
                    <p className="text-[10px] text-emerald-600">Achat</p>
                  </div>
                  <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3 text-center">
                    <Users className="h-4 w-4 text-violet-600 mx-auto mb-0.5" />
                    <p className="text-lg font-bold text-violet-700">{leadsByIntent.devenir_conseiller}</p>
                    <p className="text-[10px] text-violet-600">Recrut.</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
                    <Info className="h-4 w-4 text-blue-600 mx-auto mb-0.5" />
                    <p className="text-lg font-bold text-blue-700">{leadsByIntent.en_savoir_plus}</p>
                    <p className="text-[10px] text-blue-600">Info</p>
                  </div>
                </div>
              </>
            )}

            {/* Leads list */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Tous les leads</p>
                <span className="text-xs text-muted-foreground">{leads.length} au total</span>
              </div>
              {leads.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun lead pour l'instant</p>
                  <p className="text-xs text-muted-foreground mt-1">Partage ton lien bio pour commencer à recevoir des leads.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {leads.map(lead => {
                    const intent = INTENT_LABELS[lead.intent];
                    const source = SOURCE_LABELS[lead.source];
                    const date = new Date(lead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                    return (
                      <div key={lead.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{lead.first_name} {lead.last_name}</p>
                              {lead.status === 'converti' && <span className="text-[10px] text-green-600 font-medium">✓ Converti</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{lead.phone}</span>
                              {lead.email && <span className="text-[10px] text-muted-foreground">• {lead.email}</span>}
                            </div>
                            {lead.message && (
                              <p className="text-[11px] text-muted-foreground mt-1 italic">"{lead.message}"</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <div className="flex gap-1">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${intent.color}`}>{intent.label}</span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${source.color}`}>{source.label}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Calendar className="h-2.5 w-2.5" />
                              {date}
                            </div>
                          </div>
                        </div>
                        {lead.status === 'nouveau' && (
                          <button
                            onClick={() => convertLead.mutate(lead)}
                            disabled={convertLead.isPending}
                            className="mt-2 flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <UserPlus className="h-3 w-3" />
                            Créer contact
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
