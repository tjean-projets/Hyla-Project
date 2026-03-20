import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ImpersonationProvider, useImpersonation } from "@/hooks/useImpersonation";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

// Pages
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Invite from "./pages/Invite";
import Join from "./pages/Join";
import PartnerDashboard from "./pages/partner/Dashboard";
import PartnerLeads from "./pages/partner/Leads";
import NewLead from "./pages/partner/NewLead";
import LeadDetail from "./pages/partner/LeadDetail";
import Documents from "./pages/partner/Documents";
import Profile from "./pages/partner/Profile";
import PartnerWallet from "./pages/partner/Wallet";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminLeadDetail from "./pages/admin/LeadDetail";
import AdminPipeline from "./pages/admin/Pipeline";
import Partners from "./pages/admin/Partners";
import CommissionSettings from "./pages/admin/CommissionSettings";
import Commissions from "./pages/admin/Commissions";
import ProductCommissions from "./pages/admin/ProductCommissions";
import Finances from "./pages/admin/Finances";
import Payments from "./pages/admin/Payments";
import DocumentValidation from "./pages/admin/DocumentValidation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * AdminRoute — only accessible to users with role === 'admin'
 * Partners attempting access are redirected to /dashboard
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Chargement...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // If role resolution failed, force re-auth instead of infinite loading
  if (!role) return <Navigate to="/login" replace />;

  if (role === 'admin') return <>{children}</>;
  if (role === 'partner') return <Navigate to="/dashboard" replace />;

  return <Navigate to="/login" replace />;
}

/**
 * PartnerRoute — only accessible to users with role === 'partner' or impersonating admins
 * Admins attempting access are redirected to /admin
 */
function PartnerRoute({ children }: { children: React.ReactNode }) {
  const { user, role, isLoading } = useAuth();
  const { isImpersonating } = useImpersonation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Chargement...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Admin impersonating a partner can access partner routes
  if (isImpersonating) return <>{children}</>;

  // If role resolution failed, force re-auth instead of infinite loading
  if (!role) return <Navigate to="/login" replace />;

  if (role === 'partner') return <>{children}</>;
  if (role === 'admin') return <Navigate to="/admin" replace />;

  return <Navigate to="/login" replace />;
}

/**
 * SharedRoute — accessible to both admin and partner (e.g. lead detail)
 */
function SharedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, isLoading } = useAuth();
  const { isImpersonating } = useImpersonation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Chargement...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!role && !isImpersonating) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Chargement...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user && role ? <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/invite/:code" element={<Invite />} />
      <Route path="/join" element={<Join />} />

      {/* Partner routes — strictly partner only */}
      <Route path="/dashboard" element={<PartnerRoute><PartnerDashboard /></PartnerRoute>} />
      <Route path="/leads" element={<PartnerRoute><PartnerLeads /></PartnerRoute>} />
      <Route path="/leads/new" element={<PartnerRoute><NewLead /></PartnerRoute>} />
      <Route path="/leads/:id" element={<SharedRoute><LeadDetail /></SharedRoute>} />
      <Route path="/documents" element={<PartnerRoute><Documents /></PartnerRoute>} />
      <Route path="/wallet" element={<PartnerRoute><PartnerWallet /></PartnerRoute>} />
      <Route path="/profile" element={<PartnerRoute><Profile /></PartnerRoute>} />

      {/* Admin routes — strictly admin only */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/leads" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/leads/:id" element={<AdminRoute><AdminLeadDetail /></AdminRoute>} />
      <Route path="/admin/pipeline" element={<AdminRoute><AdminPipeline /></AdminRoute>} />
      <Route path="/admin/partners" element={<AdminRoute><Partners /></AdminRoute>} />
      <Route path="/admin/commissions" element={<AdminRoute><Commissions /></AdminRoute>} />
      <Route path="/admin/product-commissions" element={<AdminRoute><ProductCommissions /></AdminRoute>} />
      <Route path="/admin/finances" element={<AdminRoute><Finances /></AdminRoute>} />
      <Route path="/admin/payments" element={<AdminRoute><Payments /></AdminRoute>} />
      <Route path="/admin/documents" element={<AdminRoute><DocumentValidation /></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><CommissionSettings /></AdminRoute>} />
      <Route path="/admin/kyc" element={<Navigate to="/admin/documents" replace />} />

      <Route path="/" element={user && role ? <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ImpersonationProvider>
          <AuthProvider>
            <ImpersonationBanner />
            <AppRoutes />
          </AuthProvider>
        </ImpersonationProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
