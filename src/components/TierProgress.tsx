import { cn } from '@/lib/utils';
import type { TierRule } from '@/lib/supabase';

interface TierProgressProps {
  signedCount: number;
  tiers: TierRule[];
  currentTierRate: number;
  className?: string;
}

export function TierProgress({ signedCount, tiers, currentTierRate, className }: TierProgressProps) {
  const sortedTiers = [...tiers].sort((a, b) => a.min_signed - b.min_signed);
  const maxThreshold = Math.max(...sortedTiers.map(t => t.max_signed || t.min_signed + 4));

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Progression paliers</span>
        <span className="font-semibold">{currentTierRate}%</span>
      </div>
      <div className="flex gap-1 h-2">
        {sortedTiers.map((tier, i) => {
          const tierMax = tier.max_signed || maxThreshold;
          const tierWidth = ((tierMax - tier.min_signed + 1) / (maxThreshold + 1)) * 100;
          const fillRatio = Math.min(Math.max((signedCount - tier.min_signed) / (tierMax - tier.min_signed + 1), 0), 1);
          const isActive = signedCount >= tier.min_signed && (tier.max_signed === null || signedCount <= tier.max_signed);
          const isPast = signedCount > (tier.max_signed || Infinity);

          return (
            <div
              key={tier.id}
              className="relative rounded-full bg-muted overflow-hidden"
              style={{ width: `${tierWidth}%` }}
            >
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                  isPast || (isActive && fillRatio === 1)
                    ? 'bg-foreground'
                    : isActive
                    ? 'bg-foreground/60'
                    : 'bg-transparent'
                )}
                style={{ width: isPast ? '100%' : `${fillRatio * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between">
        {sortedTiers.map((tier) => (
          <span
            key={tier.id}
            className={cn(
              'text-[10px]',
              signedCount >= tier.min_signed ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}
          >
            {tier.rate_percent}%
          </span>
        ))}
      </div>
    </div>
  );
}
