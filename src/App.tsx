import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ImpersonationProvider } from "./hooks/useImpersonation";
import { ThemeProvider } from "./hooks/useTheme";

// Pages statiques (petites, nécessaires immédiatement)
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// Pages lazy-loadées
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Deals = lazy(() => import("./pages/Deals"));
const NetworkPage = lazy(() => import("./pages/NetworkPage"));
const Commissions = lazy(() => import("./pages/Commissions"));
const Tasks = lazy(() => import("./pages/Tasks"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Finance = lazy(() => import("./pages/Finance"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ObjectifForm = lazy(() => import("./pages/ObjectifForm"));
const InscriptionPage = lazy(() => import("./pages/InscriptionPage"));
const JoinPage = lazy(() => import("./pages/JoinPage"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Partner pages lazy-loadées
const PartnerDashboard = lazy(() => import("./pages/partner/Dashboard"));
const PartnerLeads = lazy(() => import("./pages/partner/Leads"));
const PartnerLeadDetail = lazy(() => import("./pages/partner/LeadDetail"));
const PartnerNewLead = lazy(() => import("./pages/partner/NewLead"));
const PartnerDocuments = lazy(() => import("./pages/partner/Documents"));
const PartnerProfile = lazy(() => import("./pages/partner/Profile"));
const PartnerWallet = lazy(() => import("./pages/partner/Wallet"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <img src="/Logo%20Hyla%20Assistant.jpeg" alt="Hyla" className="h-10 w-10 rounded-xl object-cover animate-pulse" />
        <div className="text-sm text-muted-foreground animate-pulse">Chargement...</div>
      </div>
    </div>
  );
}

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
    <Suspense fallback={<PageLoader />}>
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
        <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
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
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <ImpersonationProvider>
              <AppRoutes />
            </ImpersonationProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
