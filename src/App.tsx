import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

// Pages
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Deals from "./pages/Deals";
import NetworkPage from "./pages/NetworkPage";
import Commissions from "./pages/Commissions";
import Tasks from "./pages/Tasks";
import CalendarPage from "./pages/CalendarPage";
import Imports from "./pages/Imports";
import Finance from "./pages/Finance";
import SettingsPage from "./pages/SettingsPage";
import ObjectifForm from "./pages/ObjectifForm";
import InscriptionPage from "./pages/InscriptionPage";
import JoinPage from "./pages/JoinPage";
import AdminPanel from "./pages/AdminPanel";
import PublicProfilePage from "./pages/PublicProfilePage";
import NotFound from "./pages/NotFound";

// Partner pages
import PartnerDashboard from "./pages/partner/Dashboard";
import PartnerLeads from "./pages/partner/Leads";
import PartnerLeadDetail from "./pages/partner/LeadDetail";
import PartnerNewLead from "./pages/partner/NewLead";
import PartnerDocuments from "./pages/partner/Documents";
import PartnerProfile from "./pages/partner/Profile";
import PartnerWallet from "./pages/partner/Wallet";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2c5282] flex items-center justify-center">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <div className="animate-pulse text-gray-400 text-sm">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400 text-sm">Chargement...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/objectifs/:token" element={<ObjectifForm />} />
      <Route path="/inscription/:slug" element={<InscriptionPage />} />
      <Route path="/rejoindre/:inviteCode" element={<JoinPage />} />
      <Route path="/p/:inviteCode" element={<PublicProfilePage />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
      <Route path="/deals" element={<ProtectedRoute><Deals /></ProtectedRoute>} />
      <Route path="/network" element={<ProtectedRoute><NetworkPage /></ProtectedRoute>} />
      <Route path="/commissions" element={<ProtectedRoute><Commissions /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      <Route path="/imports" element={<Navigate to="/finance" replace />} />
      <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />

      {/* Partner routes */}
      <Route path="/partner" element={<ProtectedRoute><PartnerDashboard /></ProtectedRoute>} />
      <Route path="/leads" element={<ProtectedRoute><PartnerLeads /></ProtectedRoute>} />
      <Route path="/leads/new" element={<ProtectedRoute><PartnerNewLead /></ProtectedRoute>} />
      <Route path="/leads/:id" element={<ProtectedRoute><PartnerLeadDetail /></ProtectedRoute>} />
      <Route path="/partner/documents" element={<ProtectedRoute><PartnerDocuments /></ProtectedRoute>} />
      <Route path="/partner/profile" element={<ProtectedRoute><PartnerProfile /></ProtectedRoute>} />
      <Route path="/partner/wallet" element={<ProtectedRoute><PartnerWallet /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
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
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
