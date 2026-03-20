import { STATUS_LABELS, STATUS_COLORS, type LeadStatus } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('status-badge', STATUS_COLORS[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}
