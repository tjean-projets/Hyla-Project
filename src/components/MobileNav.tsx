import { NavLink, useLocation } from 'react-router-dom';
import { Home, FileText, FolderOpen, User, Users, Kanban, CreditCard, DollarSign, Wallet, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/hooks/useImpersonation';

export function MobileNav() {
  const location = useLocation();
  const { role, partnerType, isLoading } = useAuth();
  const { isImpersonating } = useImpersonation();
  const isPrivate = partnerType === 'private';

  // Don't render nav until role is determined
  if (isLoading || (!role && !isImpersonating)) return null;

  const showPartnerNav = role === 'partner' || isImpersonating;

  const partnerLinks = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/leads', icon: isPrivate ? Heart : FileText, label: isPrivate ? 'Parrainages' : 'Leads' },
    { to: '/wallet', icon: Wallet, label: 'Portefeuille' },
    { to: '/documents', icon: FolderOpen, label: 'Documents' },
    { to: '/profile', icon: User, label: 'Profil' },
  ];

  const adminLinks = [
    { to: '/admin', icon: Home, label: 'Dashboard' },
    { to: '/admin/pipeline', icon: Kanban, label: 'Pipeline' },
    { to: '/admin/partners', icon: Users, label: 'Partenaires' },
    { to: '/admin/finances', icon: DollarSign, label: 'Finances' },
    { to: '/admin/commissions', icon: CreditCard, label: 'Commissions' },
  ];

  // STRICT: partners ONLY see partner links, admins ONLY see admin links
  const links = showPartnerNav ? partnerLinks : role === 'admin' ? adminLinks : [];

  if (links.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card safe-bottom">
      <div className="flex items-center justify-around h-14">
        {links.map((link) => {
          const isActive = location.pathname === link.to || 
            (link.to !== '/dashboard' && link.to !== '/admin' && location.pathname.startsWith(link.to));
          
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md transition-all duration-150',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <link.icon className={cn('h-4.5 w-4.5', isActive && 'text-foreground')} />
              <span className={cn('text-[10px]', isActive ? 'font-semibold' : 'font-medium')}>{link.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
