import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const { signInAsAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signInAsAdmin(email, password);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || 'Login failed');
      return;
    }
    toast.success('Welcome, Admin');
    navigate('/admin/bounties', { replace: true });
  }

  return (
    <div className="min-h-screen level-bg-beginner flex flex-col items-center justify-center px-6 animate-fade-in">
      <div className="relative z-10 w-full max-w-sm space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back
        </Link>

        <div className="flex flex-col items-center gap-3">
          <img src="/rivals-logo.png" alt="RIVALS: Rival Heist" className="h-24 w-24 object-contain" />
          <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-accent to-primary">
            Admin Login
          </h1>
          <p className="text-xs text-muted-foreground text-center">
            Restricted access. Authorized personnel only.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              id="admin-email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-secondary/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="admin@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-xs font-medium text-muted-foreground">Password</label>
            <input
              type="password"
              id="admin-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-secondary/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm transition-all active:scale-95 neon-glow disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
