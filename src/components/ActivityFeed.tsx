import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { type LeadEvent, STATUS_LABELS, type LeadStatus } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ActivityFeedProps {
  events: LeadEvent[];
  className?: string;
}

function getEventDescription(event: LeadEvent): string {
  switch (event.event_type) {
    case 'CREATED':
      return 'Nouveau lead créé';
    case 'STATUS_CHANGE': {
      const newStatus = (event.new_value as Record<string, string>)?.status as LeadStatus;
      return `Statut → ${STATUS_LABELS[newStatus] || newStatus}`;
    }
    case 'PREMIUM_ESTIMATED_CHANGE':
      return 'Prime estimée mise à jour';
    case 'PREMIUM_FINAL_CHANGE':
      return 'Prime finale mise à jour';
    default:
      return event.event_type;
  }
}

function getEventDot(event: LeadEvent): string {
  switch (event.event_type) {
    case 'CREATED':
      return 'bg-foreground';
    case 'STATUS_CHANGE': {
      const newStatus = (event.new_value as Record<string, string>)?.status;
      if (newStatus === 'SIGNE') return 'bg-emerald-500';
      if (newStatus === 'REFUSE' || newStatus === 'PERDU') return 'bg-red-500';
      return 'bg-amber-500';
    }
    default:
      return 'bg-muted-foreground';
  }
}

export function ActivityFeed({ events, className }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">Aucune activité récente</p>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-3 py-2.5">
          <div className="flex flex-col items-center">
            <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', getEventDot(event))} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-sm text-foreground">{getEventDescription(event)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: fr })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
