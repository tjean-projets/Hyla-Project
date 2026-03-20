import { NavLink, useLocation } from 'react-router-dom';
import { Home, Kanban, Users, CreditCard, Settings, LogOut, User, DollarSign, Wallet, FileCheck, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { MobileNav } from './MobileNav';
import { NotificationBell } from './NotificationBell';
import { TjcLogo } from './TjcLogo';

const sidebarLinks = [
  { to: '/admin', icon: Home, label: 'Tableau de Bord' },
  { to: '/admin/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/admin/partners', icon: Users, label: 'Partenaires' },
  { to: '/admin/commissions', icon: CreditCard, label: 'Commissions' },
  { to: '/admin/product-commissions', icon: Layers, label: 'Commissions Produits' },
  { to: '/admin/finances', icon: DollarSign, label: 'Finances' },
  { to: '/admin/payments', icon: Wallet, label: 'Paiements' },
  { to: '/admin/documents', icon: FileCheck, label: 'Documents KYC' },
  { to: '/admin/settings', icon: Settings, label: 'Paramètres' },
];

interface AdminLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function AdminLayout({ title, children }: AdminLayoutProps) {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-56 bg-card border-r hidden md:flex flex-col z-40">
        <div className="p-5 pb-4">
          <TjcLogo size="md" showText={true} />
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {sidebarLinks.map((link) => {
            const isActive =
              link.to === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(link.to);
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <link.icon className="h-4.5 w-4.5" />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full"
          >
            <LogOut className="h-4.5 w-4.5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-40 border-b bg-card md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <TjcLogo size="sm" showText={false} />
            <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={signOut} className="p-2 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="md:ml-56 pb-20 md:pb-0">
        <div className="hidden md:flex items-center justify-between border-b bg-card px-8 py-5">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button className="h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <User className="h-4.5 w-4.5 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="p-4 md:p-8">{children}</div>
      </main>

      <div className="md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
