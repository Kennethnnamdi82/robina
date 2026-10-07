import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="user-experience flex min-h-screen items-center justify-center bg-background px-6">
      <div className="glass-card w-full max-w-sm rounded-3xl p-8 text-center">
        <p className="lime-kicker">Lost in the vault</p>
        <h1 className="mb-3 mt-2 text-6xl font-black">404</h1>
        <p className="mb-6 text-sm text-muted-foreground">This page is no longer on the map.</p>
        <a href="/" className="inline-flex rounded-xl gradient-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02]">
          Return to dashboard
        </a>
      </div>
    </div>
  );
};

export default NotFound;
