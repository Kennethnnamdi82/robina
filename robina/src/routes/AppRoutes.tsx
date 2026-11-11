import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import GamingRoute, { gameEngine } from "@/pages/GamingRoute";
import LoginPage from "@/pages/LoginPage";
import CommandLoading from '@/components/CommandLoading';
const GameHub = lazy(() => import("@/features/rivals/hub/GameHub"));

// Keep owner authentication, but retire the old BaseDrop management screens.
const AdminLoginPage = lazy(() => import("@/pages/AdminLoginPage"));

function SessionRestoreScreen() {
  return <CommandLoading message="Restoring your secure session..."/>;
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
  const { isLoggedIn, isAuthLoading } = useAuth();
  const { search } = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(search);
    captureReferral(params.get("ref") || params.get("r"));
  }, [search]);

  if (isAuthLoading) return <SessionRestoreScreen />;
  return <Suspense fallback={<CommandLoading message="Loading RIVALS…"/>}>
    <Routes>
      <Route path="/ref/:code" element={<ReferralCapture />} />
      <Route path="/r/:code" element={<ReferralCapture />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/*" element={<GameRedirect />} />
      {["/gaming", "/tasks", "/auto-claim", "/marketplace", "/login"].map(path => <Route key={path} path={path} element={<GameRedirect />} />)}
      <Route path="/*" element={isLoggedIn ? gameEngine(search) === '2d' ? <GamingRoute /> : <GameHub /> : <LoginPage />} />
    </Routes>
  </Suspense>;
}
