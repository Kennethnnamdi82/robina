import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import GamingRoute, { gameEngine } from "@/pages/GamingRoute";
import LoginPage from "@/pages/LoginPage";
const GameHub = lazy(() => import("@/features/rivals/hub/GameHub"));

// Owner-only tools stay protected and load only when explicitly requested.
// None of the old BaseDrop player pages are mounted or imported here.
const AdminLoginPage = lazy(() => import("@/pages/AdminLoginPage"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminUsersPage = lazy(() => import("@/pages/admin/AdminUsersPage"));
const AdminSeasonsPage = lazy(() => import("@/pages/admin/AdminSeasonsPage"));
const AdminTasksPage = lazy(() => import("@/pages/admin/AdminTasksPage"));
const AdminPaymentsPage = lazy(() => import("@/pages/admin/AdminPaymentsPage"));
const AdminAnalyticsPage = lazy(() => import("@/pages/admin/AdminAnalyticsPage"));
const AdminRankingPage = lazy(() => import("@/pages/admin/AdminRankingPage"));
const AdminActivityPage = lazy(() => import("@/pages/admin/AdminActivity"));

function SessionRestoreScreen() {
  return <main className="grid min-h-screen place-content-center gap-3 bg-background p-5 text-center text-foreground">
    <p className="text-sm font-semibold">Welcome to RIVALS</p>
    <p role="status" className="text-xs text-slate-400">Restoring your secure session...</p>
  </main>;
}

function captureReferral(code: string | null | undefined) {
  if (!code || !/^[a-zA-Z0-9_-]{4,64}$/.test(code)) return;
  try { localStorage.setItem("basedrop_ref", code); } catch { /* Restricted storage must not block game entry. */ }
}

function ReferralCapture() {
  const { code } = useParams();
  useEffect(() => { captureReferral(code); }, [code]);
  return <Navigate to="/" replace />;
}

function GameRedirect() {
  const { search } = useLocation();
  // Keep existing game settings and referral query links working at the new home.
  return <Navigate to={{ pathname: "/", search }} replace />;
}

export default function AppRoutes() {
  const { isLoggedIn, isAdmin, isAuthLoading } = useAuth();
  const { search } = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(search);
    captureReferral(params.get("ref") || params.get("r"));
  }, [search]);

  if (isAuthLoading) return <SessionRestoreScreen />;
  return <Suspense fallback={<main className="grid min-h-screen place-content-center bg-background text-foreground"><p role="status">Loading RIVALS…</p></main>}>
    <Routes>
      <Route path="/ref/:code" element={<ReferralCapture />} />
      <Route path="/r/:code" element={<ReferralCapture />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/*" element={isAdmin ? <AdminLayout /> : <Navigate to="/admin/login" replace />}>
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
      {["/gaming", "/tasks", "/auto-claim", "/marketplace", "/login"].map(path => <Route key={path} path={path} element={<GameRedirect />} />)}
      <Route path="/*" element={isLoggedIn ? gameEngine(search) === '2d' ? <GamingRoute /> : <GameHub /> : <LoginPage />} />
    </Routes>
  </Suspense>;
}
