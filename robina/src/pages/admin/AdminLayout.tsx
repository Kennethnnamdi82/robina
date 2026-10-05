import { useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  Users,
  Trophy,
  ListChecks,
  CreditCard,
  BarChart3,
  ListOrdered,
  Menu,
  X,
  Droplet,
  LogOut,
  ShieldOff,
  Activity,
} from "lucide-react";
import { adminApi } from "@/services/api"; // Ensure this points to your admin logout api

const NAV_ITEMS = [
  { path: "/admin/users", icon: Users, label: "Users" },
  { path: "/admin/seasons", icon: Trophy, label: "Seasons" },
  { path: "/admin/tasks", icon: ListChecks, label: "Tasks" },
  { path: "/admin/payments", icon: CreditCard, label: "Payments" },
  { path: "/admin/ranking", icon: ListOrdered, label: "Ranking" },
  { path: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/admin/activity", icon: Activity, label: "Activity" },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Handle Admin Logout
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await adminApi.logout(); // 1. Tell backend to clear the bd_admin cookie
      // 2. Force a full page reload to clear AuthContext state and redirects
      window.location.href = "/admin/login";
    } catch (error) {
      console.error("Logout failed:", error);
      // Fallback: force redirect even if API fails
      window.location.href = "/admin/login";
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass-card border-r border-border/50 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="p-5 flex items-center justify-between border-b border-border/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Droplet className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold">BaseDrop</p>
              <p className="text-[10px] text-muted-foreground">Admin Panel</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => {
                  navigate(path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* BOTTOM SECTION: Logout and Back to App */}
        <div className="p-3 border-t border-border/30 space-y-1">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-all font-medium"
          >
            <ShieldOff className="w-4 h-4" />
            {isLoggingOut ? "Logging out..." : "Admin Logout"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 glass-card border-b border-border/50 flex items-center px-4 gap-3 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-secondary"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-semibold">
            {NAV_ITEMS.find((n) => n.path === location.pathname)?.label ||
              "Admin"}
          </h2>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
