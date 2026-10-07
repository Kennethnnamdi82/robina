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
    <nav className="user-experience fixed bottom-0 left-0 right-0 z-50 border-t border-border/70 bg-[hsl(var(--background)/0.92)] shadow-[0_-12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl safe-area-bottom">
      <div className="flex h-[4.5rem] max-w-lg items-center justify-around mx-auto px-1">
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
              <span className={`grid h-8 w-8 place-items-center rounded-xl ${active ? 'bg-primary/15' : ''}`}>
                <Icon className={`w-[18px] h-[18px] ${active ? 'drop-shadow-[0_0_8px_hsl(76,100%,62%)]' : ''}`} />
              </span>
              <span className="text-[9px] font-semibold tracking-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
