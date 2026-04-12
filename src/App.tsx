import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ImpersonationProvider } from "./hooks/useImpersonation";
import { ThemeProvider } from "./hooks/useTheme";
import { AmountsProvider } from "./contexts/AmountsContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
const SocialPage = lazy(() => import("./pages/SocialPage"));
const PublicSurveyPage = lazy(() => import("./pages/PublicSurveyPage"));
const FormationPage = lazy(() => import("./pages/FormationPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const RespireAcademiePage = lazy(() => import("./pages/RespireAcademiePage"));
const SimulateurPage = lazy(() => import("./pages/SimulateurPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Partner pages lazy-loadées
const PartnerDashboard = lazy(() => import("./pages/partner/Dashboard"));
const PartnerLeads = lazy(() => import("./pages/partner/Leads"));
const PartnerLeadDetail = lazy(() => import("./pages/partner/LeadDetail"));
const PartnerNewLead = lazy(() => import("./pages/partner/NewLead"));
const PartnerDocuments = lazy(() => import("./pages/partner/Documents"));
const PartnerProfile = lazy(() => import("./pages/partner/Profile"));
const PartnerWallet = lazy(() => import("./pages/partner/Wallet"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,      // 2 min par défaut : évite les refetch inutiles
      refetchOnWindowFocus: false,    // Ne pas refetch à chaque focus de fenêtre
      retry: 1,                       // 1 seul retry en cas d'erreur (pas 3)
      refetchOnMount: true,           // OK de refetch au montage si stale
    },
  },
});

function AppSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <img src="/Hyla_assistant_logo_detourage.png" alt="Hyla" className="h-12 w-12 object-contain drop-shadow-lg" />
          <div className="absolute -inset-1.5 rounded-[18px] border-2 border-[#3b82f6]/30 border-t-[#3b82f6] animate-spin" />
        </div>
      </div>
    </div>
  );
}

function PageLoader() {
  return <AppSpinner />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <AppSpinner />;

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AppSpinner />;

  return (
    <ErrorBoundary resetKey={location.pathname}>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/objectifs/:token" element={<ObjectifForm />} />
        <Route path="/inscription/:slug" element={<InscriptionPage />} />
        <Route path="/rejoindre/:inviteCode" element={<JoinPage />} />
        <Route path="/p/:inviteCode" element={<PublicProfilePage />} />
        <Route path="/sondage/:surveyId" element={<PublicSurveyPage />} />

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
        <Route path="/social" element={<Navigate to="/settings" replace />} />
        <Route path="/formation" element={<ProtectedRoute><FormationPage /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
        <Route path="/academie" element={<ProtectedRoute><RespireAcademiePage /></ProtectedRoute>} />
        <Route path="/simulateur" element={<ProtectedRoute><SimulateurPage /></ProtectedRoute>} />
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
    </ErrorBoundary>
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
              <AmountsProvider>
                <AppRoutes />
              </AmountsProvider>
            </ImpersonationProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
