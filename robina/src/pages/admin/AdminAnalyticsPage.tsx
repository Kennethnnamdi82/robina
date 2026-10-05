import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Coins, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '@/services/api';

interface Analytics {
  users: number;
  payments: number;
  tasks: Array<{ _id: string; count: number }>;
  totalBd: number;
  totalRevenue: number;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const a = await adminApi.analytics() as Analytics;
        setData(a);
      } catch (e) {
        setError((e as Error).message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-center text-xs text-destructive">{error || 'No analytics data'}</div>;
  }

  const taskBreakdown = (data.tasks || []).map(t => ({ status: t._id, count: t.count }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total BD Distributed', value: (data.totalBd || 0).toLocaleString(), icon: Coins, color: 'text-accent' },
          { label: 'Verified Payments', value: data.payments.toLocaleString(), icon: TrendingUp, color: 'text-green-400' },
          { label: 'Task Submissions', value: taskBreakdown.reduce((s, t) => s + t.count, 0).toLocaleString(), icon: BarChart3, color: 'text-primary' },
          { label: 'Total Users', value: data.users.toLocaleString(), icon: Users, color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-4">
        <p className="text-xs text-muted-foreground">Total Verified Revenue</p>
        <p className="text-2xl font-bold mt-1">${(data.totalRevenue || 0).toFixed(2)} USDC</p>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">Task Submissions by Status</h3>
        {taskBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No task submissions yet.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="status" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
