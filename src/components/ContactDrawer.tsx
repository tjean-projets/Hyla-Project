import { useState, useEffect } from 'react';
import { X, Edit2, Phone, Mail, MapPin, MessageSquare, Send, ShoppingBag, Trash2, Clock, CheckCircle2, Calendar, List, Zap, Plus, Copy, Check, BookOpen, Pencil } from 'lucide-react';
import { supabase, CONTACT_STATUS_LABELS, CONTACT_STATUS_COLORS, TASK_TYPE_LABELS_HYLA } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { useToast } from '@/hooks/use-toast';

const DEAL_STATUS_LABELS: Record<string, string> = {
  en_cours: 'En cours', en_attente: 'En attente',
  signee: 'Signée', livree: 'Livrée', annulee: 'Annulée',
};

// ── Message Templates ──
export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  isDefault?: boolean;
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  { id: 'tpl-1', isDefault: true, name: '🤝 Premier contact', body: 'Bonjour {{prénom}}, je m\'appelle {votre_nom}, conseiller Hyla. Je vous contacte car je pense que notre purificateur d\'eau pourrait vous intéresser. Seriez-vous disponible quelques minutes pour en discuter ?' },
  { id: 'tpl-2', isDefault: true, name: '📱 Après démo', body: 'Bonjour {{prénom}}, suite à notre présentation, je voulais savoir si vous aviez pu réfléchir à la solution Hyla ? Je reste disponible pour répondre à vos questions.' },
  { id: 'tpl-3', isDefault: true, name: '⏰ Relance 30j', body: 'Bonjour {{prénom}}, je me permets de vous recontacter. Avez-vous toujours un intérêt pour améliorer la qualité de votre eau ? Je serais ravi(e) d\'échanger avec vous.' },
  { id: 'tpl-4', isDefault: true, name: '✅ Confirmation RDV', body: 'Bonjour {{prénom}}, je vous confirme notre rendez-vous de {{date}}. N\'hésitez pas à me contacter si vous avez des questions d\'ici là.' },
  { id: 'tpl-5', isDefault: true, name: '🎉 Bienvenue client', body: 'Bonjour {{prénom}}, bienvenue dans la famille Hyla ! Votre purificateur a bien été enregistré. Je reste disponible pour vous accompagner et répondre à vos questions.' },
];

function getStorageKey(userId: string) { return `hyla-templates-${userId}`; }

export function getTemplates(userId: string): MessageTemplate[] {
  try {
    const saved = JSON.parse(localStorage.getItem(getStorageKey(userId)) || '[]') as MessageTemplate[];
    return [...DEFAULT_TEMPLATES, ...saved];
  } catch { return DEFAULT_TEMPLATES; }
}

function saveCustomTemplates(userId: string, customs: MessageTemplate[]) {
  try { localStorage.setItem(getStorageKey(userId), JSON.stringify(customs)); } catch { /* ignore */ }
}

function applyVars(body: string, contact: any): string {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  return body
    .replace(/\{\{prénom\}\}/gi, contact.first_name || '')
    .replace(/\{\{nom\}\}/gi, contact.last_name || '')
    .replace(/\{\{date\}\}/gi, today);
}

// ── Timeline event types ──
type TimelineEvent =
  | { kind: 'note'; id: string; date: string; content: string }
  | { kind: 'deal'; id: string; date: string; product: string; amount: number; status: string }
  | { kind: 'task'; id: string; date: string; title: string; type: string; status: string }
  | { kind: 'appointment'; id: string; date: string; title: string; type: string };

interface ContactDrawerProps {
  contact: any | null;
  onClose: () => void;
  onEdit: (contact: any) => void;
}

export function ContactDrawer({ contact, onClose, onEdit }: ContactDrawerProps) {
  const effectiveId = useEffectiveUserId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<'info' | 'timeline' | 'relancer'>('info');
  const [noteText, setNoteText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [tplForm, setTplForm] = useState({ name: '', body: '' });

  // Reset tab when contact changes
  useEffect(() => { setTab('info'); }, [contact?.id]);

  const { data: notes = [] } = useQuery({
    queryKey: ['contact-notes', contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const { data } = await supabase.from('contact_notes').select('*').eq('contact_id', contact.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!contact?.id,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['contact-deals', contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const { data } = await supabase.from('deals').select('id, amount, product, status, signed_at, created_at, payment_type, payment_months, notes').eq('contact_id', contact.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!contact?.id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['contact-tasks', contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const { data } = await supabase.from('tasks').select('id, title, type, status, due_date, completed_at, created_at').eq('contact_id', contact.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!contact?.id,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['contact-appointments', contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const { data } = await supabase.from('appointments').select('id, title, type, start_time').eq('contact_id', contact.id).order('start_time', { ascending: false });
      return data || [];
    },
    enabled: !!contact?.id,
  });

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('contact_notes').insert({ contact_id: contact.id, user_id: effectiveId, content });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contact-notes', contact?.id] }); setNoteText(''); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from('contact_notes').delete().eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-notes', contact?.id] }),
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  // ── Timeline merge ──
  const timelineEvents: TimelineEvent[] = [
    ...notes.map((n: any) => ({ kind: 'note' as const, id: n.id, date: n.created_at, content: n.content })),
    ...deals.map((d: any) => ({ kind: 'deal' as const, id: d.id, date: d.signed_at || d.created_at, product: d.product || 'Purificateur', amount: d.amount || 0, status: d.status })),
    ...tasks.map((t: any) => ({ kind: 'task' as const, id: t.id, date: t.completed_at || t.due_date || t.created_at, title: t.title, type: t.type, status: t.status })),
    ...appointments.map((a: any) => ({ kind: 'appointment' as const, id: a.id, date: a.start_time, title: a.title, type: a.type })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Templates ──
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  useEffect(() => {
    if (effectiveId) setTemplates(getTemplates(effectiveId));
  }, [effectiveId]);

  const customTemplates = templates.filter(t => !t.isDefault);

  const saveTemplate = () => {
    if (!effectiveId || !tplForm.name.trim() || !tplForm.body.trim()) return;
    let updated: MessageTemplate[];
    if (editingTemplate && !editingTemplate.isDefault) {
      updated = customTemplates.map(t => t.id === editingTemplate.id ? { ...t, name: tplForm.name, body: tplForm.body } : t);
    } else {
      updated = [...customTemplates, { id: `custom-${Date.now()}`, name: tplForm.name, body: tplForm.body }];
    }
    saveCustomTemplates(effectiveId, updated);
    setTemplates([...DEFAULT_TEMPLATES, ...updated]);
    setShowTemplateForm(false);
    setEditingTemplate(null);
    setTplForm({ name: '', body: '' });
    toast({ title: 'Template sauvegardé' });
  };

  const deleteTemplate = (id: string) => {
    if (!effectiveId) return;
    const updated = customTemplates.filter(t => t.id !== id);
    saveCustomTemplates(effectiveId, updated);
    setTemplates([...DEFAULT_TEMPLATES, ...updated]);
  };

  const copyTemplate = (tpl: MessageTemplate) => {
    const text = applyVars(tpl.body, contact);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(tpl.id);
      toast({ title: 'Copié !', description: 'Message prêt à coller dans WhatsApp / SMS' });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (!contact) return null;
  const initials = `${contact.first_name?.[0] ?? ''}${contact.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{initials}</span>
            </div>
            <div>
              <p className="font-semibold text-foreground leading-tight">{contact.first_name} {contact.last_name}</p>
              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CONTACT_STATUS_COLORS[contact.status as keyof typeof CONTACT_STATUS_COLORS] ?? ''}`}>
                {CONTACT_STATUS_LABELS[contact.status as keyof typeof CONTACT_STATUS_LABELS] ?? contact.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border">
          {([
            { key: 'info', label: 'Info', icon: MapPin },
            { key: 'timeline', label: `Timeline${timelineEvents.length > 0 ? ` (${timelineEvents.length})` : ''}`, icon: List },
            { key: 'relancer', label: 'Relancer', icon: Zap },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                tab === key ? 'border-blue-500 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── TAB : INFO ── */}
          {tab === 'info' && (
            <>
              <div className="space-y-2">
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors">
                    <Phone className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="text-sm text-foreground">{contact.phone}</span>
                  </a>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors">
                    <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="text-sm text-foreground">{contact.email}</span>
                  </a>
                )}
                {contact.address && (
                  <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{contact.address}</span>
                  </div>
                )}
                {contact.source && (
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                    <span className="text-xs text-muted-foreground">Source</span>
                    <span className="text-sm text-foreground">{contact.source}</span>
                  </div>
                )}
              </div>

              {deals.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Achats ({deals.length})
                  </p>
                  <div className="space-y-2">
                    {deals.map((deal: any) => (
                      <div key={deal.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-foreground">{deal.product || 'Purificateur'}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full font-medium mr-1.5 ${
                              deal.status === 'livree' ? 'bg-emerald-50 text-emerald-700' :
                              deal.status === 'signee' ? 'bg-blue-50 text-blue-700' : 'bg-muted text-muted-foreground'
                            }`}>
                              {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
                            </span>
                            {deal.signed_at && new Date(deal.signed_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-foreground">{(deal.amount || 0).toLocaleString('fr-FR')} €</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />Notes
                </p>
                <div className="flex gap-2 mb-4">
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Ajouter une note… (⌘+Entrée)"
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && noteText.trim()) addNote.mutate(noteText.trim()); }}
                  />
                  <button onClick={() => noteText.trim() && addNote.mutate(noteText.trim())} disabled={!noteText.trim() || addNote.isPending}
                    className="px-3 bg-[#3b82f6] text-white rounded-xl disabled:opacity-40 flex items-center justify-center">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {notes.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-4">Aucune note</p>
                  : <div className="space-y-2">
                    {notes.map((note: any) => (
                      <div key={note.id} className="group p-3 bg-muted/40 rounded-xl relative">
                        <p className="text-sm text-foreground whitespace-pre-wrap pr-6">{note.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {new Date(note.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <button onClick={() => deleteNote.mutate(note.id)} className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all">
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </>
          )}

          {/* ── TAB : TIMELINE ── */}
          {tab === 'timeline' && (
            <div>
              {timelineEvents.length === 0
                ? <div className="text-center py-12">
                    <List className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Aucun événement pour l'instant</p>
                    <p className="text-xs text-muted-foreground mt-1">Notes, RDV, tâches et ventes apparaîtront ici</p>
                  </div>
                : <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4">
                      {timelineEvents.map((evt) => {
                        const dateStr = new Date(evt.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
                        const timeStr = new Date(evt.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={`${evt.kind}-${evt.id}`} className="flex gap-4 pl-2">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 mt-0.5 ${
                              evt.kind === 'note' ? 'bg-blue-100 text-blue-600' :
                              evt.kind === 'deal' ? 'bg-green-100 text-green-600' :
                              evt.kind === 'task' ? 'bg-purple-100 text-purple-600' :
                              'bg-orange-100 text-orange-600'
                            }`}>
                              {evt.kind === 'note' && <MessageSquare className="h-3 w-3" />}
                              {evt.kind === 'deal' && <ShoppingBag className="h-3 w-3" />}
                              {evt.kind === 'task' && <CheckCircle2 className="h-3 w-3" />}
                              {evt.kind === 'appointment' && <Calendar className="h-3 w-3" />}
                            </div>
                            <div className="flex-1 min-w-0 pb-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  {evt.kind === 'note' && <p className="text-sm text-foreground line-clamp-2">{evt.content}</p>}
                                  {evt.kind === 'deal' && (
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{evt.product}</p>
                                      <p className="text-xs text-muted-foreground">{evt.amount.toLocaleString('fr-FR')} € · {DEAL_STATUS_LABELS[evt.status] ?? evt.status}</p>
                                    </div>
                                  )}
                                  {evt.kind === 'task' && (
                                    <div>
                                      <p className={`text-sm font-medium ${evt.status === 'terminee' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{evt.title}</p>
                                      <p className="text-xs text-muted-foreground">{(TASK_TYPE_LABELS_HYLA as any)[evt.type] ?? evt.type}</p>
                                    </div>
                                  )}
                                  {evt.kind === 'appointment' && (
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{evt.title}</p>
                                      <p className="text-xs text-muted-foreground">RDV · {timeStr}</p>
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">{dateStr}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
              }
            </div>
          )}

          {/* ── TAB : RELANCER ── */}
          {tab === 'relancer' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Templates de message</p>
                  <p className="text-xs text-muted-foreground">Cliquer sur "Copier" pour coller dans WhatsApp / SMS</p>
                </div>
                <button
                  onClick={() => { setEditingTemplate(null); setTplForm({ name: '', body: '' }); setShowTemplateForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 font-semibold text-xs rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nouveau
                </button>
              </div>

              {/* Template editor */}
              {showTemplateForm && (
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 space-y-3 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{editingTemplate ? 'Modifier le template' : 'Nouveau template'}</p>
                  <input
                    type="text"
                    placeholder="Nom du template (ex: Relance démo)"
                    value={tplForm.name}
                    onChange={e => setTplForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <textarea
                    placeholder="Contenu du message…&#10;Variables disponibles : {{prénom}}, {{nom}}, {{date}}"
                    value={tplForm.body}
                    onChange={e => setTplForm(p => ({ ...p, body: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <p className="text-[10px] text-muted-foreground">Variables : <code>{'{{prénom}}'}</code> <code>{'{{nom}}'}</code> <code>{'{{date}}'}</code></p>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }} className="flex-1 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground">Annuler</button>
                    <button onClick={saveTemplate} disabled={!tplForm.name.trim() || !tplForm.body.trim()} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50">Sauvegarder</button>
                  </div>
                </div>
              )}

              {/* Templates list */}
              <div className="space-y-2">
                {templates.map(tpl => (
                  <div key={tpl.id} className="bg-muted/40 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{tpl.name}</p>
                      <div className="flex items-center gap-1">
                        {!tpl.isDefault && (
                          <>
                            <button onClick={() => { setEditingTemplate(tpl); setTplForm({ name: tpl.name, body: tpl.body }); setShowTemplateForm(true); }} className="p-1 rounded hover:bg-muted transition-colors">
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button onClick={() => deleteTemplate(tpl.id)} className="p-1 rounded hover:bg-red-50 transition-colors">
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 whitespace-pre-wrap">
                      {applyVars(tpl.body, contact)}
                    </p>
                    <button
                      onClick={() => copyTemplate(tpl)}
                      className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                        copiedId === tpl.id
                          ? 'bg-green-500 text-white'
                          : 'bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 active:scale-[0.98]'
                      }`}
                    >
                      {copiedId === tpl.id ? <><Check className="h-3.5 w-3.5" />Copié !</> : <><Copy className="h-3.5 w-3.5" />Copier le message</>}
                    </button>
                  </div>
                ))}
              </div>

              {templates.length === 0 && (
                <div className="text-center py-8">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun template</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <button onClick={() => { onEdit(contact); onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#3b82f6] text-white font-semibold text-sm rounded-xl hover:bg-[#3b82f6]/90 transition-colors">
            <Edit2 className="h-4 w-4" />
            Modifier le contact
          </button>
        </div>
      </div>
    </>
  );
}
