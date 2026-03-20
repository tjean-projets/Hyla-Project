import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  icon?: LucideIcon;
  color?: string;
  subtitle?: string;
  trend?: { value: number; label: string };
  className?: string;
}

export function KPICard({ title, value, icon: Icon, color, subtitle, trend, className }: KPICardProps) {
  return (
    <div className={cn('kpi-card', className)}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-normal leading-tight">{title}</p>
          <p className="text-lg font-semibold text-foreground tabular-nums">{value}</p>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 text-[10px] font-medium',
              trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'
            )}>
              {trend.value >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
              <span className="text-muted-foreground font-normal">{trend.label}</span>
            </div>
          )}
          {subtitle && (
            <p className="text-[10px] text-muted-foreground leading-tight">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn('rounded-md p-1.5 flex-shrink-0', color || 'bg-muted text-muted-foreground')}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}
