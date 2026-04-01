import { X, Edit2, Trash2, Tag, User, Clock, Users } from 'lucide-react';
import { DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from '@/lib/supabase';

interface DealDrawerProps {
  deal: any | null;
  onClose: () => void;
  onEdit: (deal: any) => void;
  onDelete: (dealId: string) => void;
  onStatusChange: (dealId: string, status: string) => void;
}

export function DealDrawer({ deal, onClose, onEdit, onDelete, onStatusChange }: DealDrawerProps) {
  if (!deal) return null;

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
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${DEAL_STATUS_COLORS[deal.status as keyof typeof DEAL_STATUS_COLORS]}`}>
              {DEAL_STATUS_LABELS[deal.status as keyof typeof DEAL_STATUS_LABELS]}
            </span>
            {deal.product && (
              <span className="text-xs text-muted-foreground">{deal.product}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Montant hero */}
          <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-2xl p-5 text-white">
            <p className="text-xs font-semibold opacity-70 uppercase mb-1">Montant</p>
            <p className="text-3xl font-black">{(deal.amount || 0).toLocaleString('fr-FR')} <span className="text-lg opacity-70">€</span></p>
            {deal.signed_at && (
              <p className="text-xs opacity-60 mt-2">Signé le {new Date(deal.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            )}
          </div>

          {/* Infos */}
          <div className="space-y-3">
            {deal.contacts && (
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Contact</p>
                  <p className="text-sm font-medium text-foreground">{deal.contacts.first_name} {deal.contacts.last_name}</p>
                </div>
              </div>
            )}
            {deal.seller && (
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Vendu par</p>
                  <p className="text-sm font-medium text-foreground">{deal.seller.first_name} {deal.seller.last_name}</p>
                </div>
              </div>
            )}
            {deal.deal_type && (
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Type de vente</p>
                  <p className="text-sm font-medium text-foreground capitalize">{deal.deal_type.replace(/_/g, ' ')}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Créé le</p>
                <p className="text-sm font-medium text-foreground">{new Date(deal.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {deal.notes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Notes</p>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{deal.notes}</p>
              </div>
            </div>
          )}

          {/* Raison annulation */}
          {deal.status === 'annulee' && deal.loss_reason_category && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Raison d'annulation</p>
              <p className="text-sm text-red-600 dark:text-red-300">{deal.loss_reason_category.replace(/_/g, ' ')}</p>
              {deal.loss_reason && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{deal.loss_reason}</p>}
            </div>
          )}

          {/* Changement de statut rapide */}
          {deal.status !== 'annulee' && deal.status !== 'signee' && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Changer le statut</p>
              <div className="flex flex-wrap gap-2">
                {(['en_cours', 'en_attente', 'signee', 'livree'] as const).filter(s => s !== deal.status).map(s => (
                  <button
                    key={s}
                    onClick={() => onStatusChange(deal.id, s)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${DEAL_STATUS_COLORS[s]} hover:opacity-80`}
                  >
                    {DEAL_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-border flex gap-3">
          <button
            onClick={() => { onEdit(deal); onClose(); }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#3b82f6] text-white font-semibold text-sm rounded-xl hover:bg-[#3b82f6]/90 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
            Modifier
          </button>
          <button
            onClick={() => { if (confirm('Supprimer ce deal ?')) { onDelete(deal.id); onClose(); } }}
            className="px-4 py-2.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold text-sm rounded-xl hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors border border-red-200 dark:border-red-800"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
