import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GameProvider } from "@/context/GameContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Web3Provider } from "./providers/Web3Provider";
import { PrivyProvider } from "@privy-io/react-auth";

import SnapshotEventBanner from "@/components/SnapshotEventBanner";
import BottomNav from "@/components/BottomNav";
import HomePage from "@/pages/HomePage";
import TasksPage from "@/pages/TasksPage";
import RankPage from "@/pages/LeaderboardPage";
import AutoClaimPage from "@/pages/AutoClaimPage";
import ProfilePage from "@/pages/ProfilePage";
import GamingPage from "@/pages/GamingPage";
import LoginPage from "@/pages/LoginPage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import NotFound from "@/pages/NotFound";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminSeasonsPage from "@/pages/admin/AdminSeasonsPage";
import AdminTasksPage from "@/pages/admin/AdminTasksPage";
import AdminPaymentsPage from "@/pages/admin/AdminPaymentsPage";
import AdminAnalyticsPage from "@/pages/admin/AdminAnalyticsPage";
import AdminRankingPage from "@/pages/admin/AdminRankingPage";
import AdminActivityPage from "@/pages/admin/AdminActivity";

const queryClient = new QueryClient();
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID?.trim();

function SessionRestoreScreen() {
  return (
    <main className="user-experience relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-[-16rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />
      <div className="relative flex flex-col items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 shadow-[0_0_32px_rgba(194,255,56,0.12)]">
          <span className="h-5 w-5 rotate-45 animate-pulse rounded-[5px] border-2 border-primary" />
        </span>
        <div className="text-center">
          <p className="text-sm font-semibold tracking-[-0.02em] text-white">Welcome to Robina</p>
          <p className="mt-1 text-xs text-slate-500">Restoring your secure session...</p>
        </div>
      </div>
    </main>
  );
}

function ReferralCapture() {
  const { code } = useParams();
  if (code && /^[a-zA-Z0-9_-]{4,64}$/.test(code)) {
    localStorage.setItem("basedrop_ref", code);
  }
  return <Navigate to="/" replace />;
}

function ReferralQueryCapture() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("ref") || params.get("r");
    if (code && /^[a-zA-Z0-9_-]{4,64}$/.test(code)) {
      localStorage.setItem("basedrop_ref", code);
    }
  }, [location.search]);

  return null;
}

function AppRoutes() {
  const { isLoggedIn, isAdmin, isAuthLoading } = useAuth();
  const location = useLocation();
  const showSnapshotBanner = !location.pathname.startsWith("/admin");

  if (isAuthLoading) return <SessionRestoreScreen />;

  return (
    <>
      <ReferralQueryCapture />
      {showSnapshotBanner && <SnapshotEventBanner />}
      <Routes>
        <Route path="/ref/:code" element={<ReferralCapture />} />
        <Route path="/r/:code" element={<ReferralCapture />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Admin area */}
        <Route
          path="/admin/*"
          element={
            isAdmin ? <AdminLayout /> : <Navigate to="/admin/login" replace />
          }
        >
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="seasons" element={<AdminSeasonsPage />} />
          <Route path="tasks" element={<AdminTasksPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="ranking" element={<AdminRankingPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="activity" element={<AdminActivityPage />} />
          <Route path="*" element={<Navigate to="users" replace />} />
        </Route>

        {/* User app gated by login state */}
        {!isLoggedIn ? (
          <Route path="*" element={<LoginPage />} />
        ) : (
          <>
            <Route path="/" element={<HomePage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/rank" element={<RankPage />} />
            <Route path="/auto-claim" element={<AutoClaimPage />} />
            <Route path="/gaming" element={<GamingPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </>
        )}
      </Routes>

      {/* Navigation bar only for logged in users */}
      {isLoggedIn && (
        <Routes>
          <Route path="/admin/*" element={null} />
          <Route path="*" element={<BottomNav />} />
        </Routes>
      )}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PrivyProvider appId={privyAppId || "unconfigured"} config={{ loginMethods: ["google"] }}>
      <Web3Provider>
        <TooltipProvider>
          <Sonner position="top-center" theme="dark" richColors closeButton />
          <BrowserRouter>
            <AuthProvider>
              <GameProvider>
                <div className="min-h-screen bg-background">
                  <AppRoutes />
                </div>
              </GameProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </Web3Provider>
    </PrivyProvider>
  </QueryClientProvider>
);

export default App;
