// Skeleton components for loading states

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className ?? ''}`} />;
}

/** Skeleton for a KPI card (number + label) */
export function SkeletonKPI() {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border space-y-2">
      <SkeletonBlock className="h-3 w-20" />
      <SkeletonBlock className="h-7 w-24" />
      <SkeletonBlock className="h-2 w-16" />
    </div>
  );
}

/** Skeleton for a single list row */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <SkeletonBlock className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <SkeletonBlock className="h-3 w-2/3" />
        <SkeletonBlock className="h-2.5 w-1/3" />
      </div>
      <SkeletonBlock className="h-6 w-16 rounded-lg flex-shrink-0" />
    </div>
  );
}

/** Skeleton for a table (header + N rows) */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/40">
        {[40, 28, 20, 12].map((w, i) => (
          <SkeletonBlock key={i} className={`h-3 w-${w}`} />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-border last:border-0">
          <SkeletonRow />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a chart placeholder */
export function SkeletonChart() {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border space-y-3">
      <SkeletonBlock className="h-3 w-40" />
      <div className="flex items-end gap-2 h-32">
        {[60, 80, 50, 90, 70, 100, 55].map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse bg-muted rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
