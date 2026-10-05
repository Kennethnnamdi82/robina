import { Home, ListChecks, Trophy, User, Zap, Gamepad2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/tasks', icon: ListChecks, label: 'Tasks' },
  { path: '/gaming', icon: Gamepad2, label: 'Gaming' },
  { path: '/rank', icon: Trophy, label: 'Rank' },
  { path: '/auto-claim', icon: Zap, label: 'Auto Claim' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 ${
                active
                  ? 'text-primary scale-105'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'drop-shadow-[0_0_8px_hsl(250,80%,60%)]' : ''}`} />
              <span className="text-[9px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
