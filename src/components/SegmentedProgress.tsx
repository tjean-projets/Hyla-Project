interface SegmentedProgressProps {
  current: number;
  segments: number;
  label?: string;
}

export function SegmentedProgress({ current, segments, label }: SegmentedProgressProps) {
  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 flex-1 rounded-sm transition-colors ${
              i < current ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs font-medium text-foreground">{current}/{segments} dossiers</p>
    </div>
  );
}
