import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/hooks/useImpersonation';
import { NotificationBell } from './NotificationBell';

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const { signOut, role, partnerName } = useAuth();
  const { isImpersonating } = useImpersonation();

  return (
    <header className={`sticky ${isImpersonating ? 'top-10' : 'top-0'} z-40 border-b bg-card safe-top`}>
      <div className="flex h-14 items-center justify-between px-4">
        <div>
          <h1 className="text-sm font-semibold text-foreground leading-tight">
            {title || (role === 'partner' && partnerName ? partnerName : 'Hyla')}
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {role === 'admin' ? 'Admin' : 'Partenaire'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
