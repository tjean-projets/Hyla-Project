import { Link } from 'react-router-dom';
import { Phone, Clock, Euro } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { Badge } from '@/components/ui/badge';
import { type Lead, CONTRACT_TYPE_LABELS } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

interface LeadCardProps {
  lead: Lead;
  showPartner?: boolean;
  partnerName?: string;
}

export function LeadCard({ lead, showPartner, partnerName }: LeadCardProps) {
  const { role, partnerRate } = useAuth();
  const fullName = `${lead.first_name} ${lead.last_name}`;
  const updatedAt = formatDistanceToNow(new Date(lead.updated_at), {
    addSuffix: true,
    locale: fr,
  });

  const linkTo = role === 'admin' ? `/admin/leads/${lead.id}` : `/leads/${lead.id}`;

  return (
    <Link to={linkTo}>
      <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-all duration-150 group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-sm font-medium text-foreground truncate">{fullName}</h3>
              <StatusBadge status={lead.status} />
              {lead.contract_type && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                  {CONTRACT_TYPE_LABELS[lead.contract_type]}
                </Badge>
              )}
            </div>
            
            {showPartner && partnerName && (
              <p className="text-xs text-muted-foreground mb-1">
                {partnerName}
              </p>
            )}
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {lead.phone}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {updatedAt}
              </span>
            </div>
          </div>
          
          {lead.commission_estimated && (
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-emerald-600 flex items-center gap-0.5">
                {role === 'partner'
                  ? ((lead.commission_final || lead.commission_estimated) * partnerRate / 100).toFixed(0)
                  : lead.commission_estimated.toFixed(0)}
                <Euro className="h-3 w-3" />
              </p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
