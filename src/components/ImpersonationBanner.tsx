import { X, Eye } from 'lucide-react';
import { useImpersonation } from '@/hooks/useImpersonation';
import { Button } from '@/components/ui/button';

export function ImpersonationBanner() {
  const { isImpersonating, partnerName, stopImpersonation } = useImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-foreground text-background">
      <div className="flex items-center justify-center gap-3 h-10 px-4 text-xs font-medium">
        <Eye className="h-3.5 w-3.5" />
        <span>Connecté en tant que <strong>{partnerName}</strong></span>
        <Button
          variant="ghost"
          size="sm"
          onClick={stopImpersonation}
          className="h-6 px-2 text-[10px] text-background hover:bg-background/20 hover:text-background"
        >
          <X className="h-3 w-3 mr-1" />
          Quitter la simulation
        </Button>
      </div>
    </div>
  );
}
