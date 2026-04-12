import { useState } from 'react';
import { X, Edit2, Phone, Mail, MapPin, MessageSquare, Send, ShoppingBag, Trash2 } from 'lucide-react';
import { supabase, CONTACT_STATUS_LABELS, CONTACT_STATUS_COLORS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { useToast } from '@/hooks/use-toast';

const DEAL_STATUS_LABELS: Record<string, string> = {
  en_cours: 'En cours', en_attente: 'En attente',
  signee: 'Signée', livree: 'Livrée', annulee: 'Annulée',
};

interface ContactDrawerProps {
  contact: any | null;
  onClose: () => void;
  onEdit: (contact: any) => void;
}

export function ContactDrawer({ contact, onClose, onEdit }: ContactDrawerProps) {
  const effectiveId = useEffectiveUserId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [noteText, setNoteText] = useState('');

  const { data: notes = [] } = useQuery({
    queryKey: ['contact-notes', contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const { data } = await supabase
        .from('contact_notes')
        .select('*')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!contact?.id,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['contact-deals', contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const { data } = await supabase
        .from('deals')
        .select('id, amount, product, status, signed_at, payment_type, payment_months, notes')
        .eq('contact_id', contact.id)
        .order('signed_at', { ascending: false });
      return data || [];
    },
    enabled: !!contact?.id,
  });

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('contact_notes').insert({
        contact_id: contact.id,
        user_id: effectiveId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', contact?.id] });
      setNoteText('');
    },
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

  if (!contact) return null;

  const initials = `${contact.first_name?.[0] ?? ''}${contact.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{initials}</span>
            </div>
            <div>
              <p className="font-semibold text-foreground leading-tight">
                {contact.first_name} {contact.last_name}
              </p>
              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CONTACT_STATUS_COLORS[contact.status as keyof typeof CONTACT_STATUS_COLORS] ?? ''}`}>
                {CONTACT_STATUS_LABELS[contact.status as keyof typeof CONTACT_STATUS_LABELS] ?? contact.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Coordonnées */}
          <div className="space-y-2">
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors"
              >
                <Phone className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-foreground">{contact.phone}</span>
              </a>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors"
              >
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
          </div>

          {/* Achats */}
          {deals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" />
                Achats ({deals.length})
              </p>
              <div className="space-y-2">
                {deals.map((deal: any) => {
                  const provM = deal.notes?.match(/Fin:([A-Z]+)/i);
                  const prov = provM ? provM[1].charAt(0) + provM[1].slice(1).toLowerCase() : null;
                  return (
                    <div key={deal.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-foreground">{deal.product || 'Purificateur'}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full font-medium mr-1.5 ${
                            deal.status === 'livree' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            deal.status === 'signee' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
                          </span>
                          {deal.signed_at && new Date(deal.signed_at).toLocaleDateString('fr-FR')}
                          {deal.payment_type === 'mensualites' && (
                            <span className="ml-1 text-blue-500">
                              · {deal.payment_months ? `${deal.payment_months}×` : 'Mens.'}{prov ? ` ${prov}` : ''}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{(deal.amount || 0).toLocaleString('fr-FR')} €</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes / historique */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Notes & historique
            </p>

            {/* Saisie */}
            <div className="flex gap-2 mb-4">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Ajouter une note… (⌘+Entrée pour envoyer)"
                rows={2}
                className="flex-1 px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && noteText.trim()) {
                    addNote.mutate(noteText.trim());
                  }
                }}
              />
              <button
                onClick={() => noteText.trim() && addNote.mutate(noteText.trim())}
                disabled={!noteText.trim() || addNote.isPending}
                className="px-3 bg-[#3b82f6] text-white rounded-xl disabled:opacity-40 flex items-center justify-center hover:bg-[#3b82f6]/90 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            {/* Timeline */}
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune note pour l'instant</p>
            ) : (
              <div className="space-y-2">
                {notes.map((note: any) => (
                  <div key={note.id} className="group p-3 bg-muted/40 rounded-xl relative">
                    <p className="text-sm text-foreground whitespace-pre-wrap pr-6">{note.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {new Date(note.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <button
                      onClick={() => deleteNote.mutate(note.id)}
                      className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={() => { onEdit(contact); onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#3b82f6] text-white font-semibold text-sm rounded-xl hover:bg-[#3b82f6]/90 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
            Modifier le contact
          </button>
        </div>
      </div>
    </>
  );
}
