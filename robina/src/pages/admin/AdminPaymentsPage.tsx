import { useEffect, useState } from 'react';
import { ArrowUpRight, Zap, TrendingUp, Loader2, Gamepad2, BadgePercent } from 'lucide-react';
import { adminApi } from '@/services/api';

interface Payment {
  _id?: string;
  txHash: string;
  wallet: string;
  action: 'upgrade' | 'instant_claim' | 'auto_claim' | 'game_card' | 'game_bundle' | 'multiplier';
  targetLevel?: string | null;
  amountUsdc: number;
  blockNumber?: number;
  status?: 'pending' | 'processing' | 'verified' | 'failed';
  failureReason?: string | null;
  createdAt?: string;
}

const TYPE_LABELS: Record<string, string> = {
  upgrade: 'Level Upgrade',
  instant_claim: 'Instant Claim',
  auto_claim: 'Auto Claim',
  game_card: 'Game Card Reveal',
  game_bundle: 'Open All Cards',
  multiplier: 'Card Multiplier',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  upgrade: <ArrowUpRight className="w-4 h-4 text-accent" />,
  instant_claim: <Zap className="w-4 h-4 text-yellow-400" />,
  auto_claim: <TrendingUp className="w-4 h-4 text-green-400" />,
  game_card: <Gamepad2 className="w-4 h-4 text-primary" />,
  game_bundle: <Gamepad2 className="w-4 h-4 text-primary" />,
  multiplier: <BadgePercent className="w-4 h-4 text-accent" />,
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<{
    totalRevenue: number;
    totalTransactions: number;
    totalRecords?: number;
    byAction: Array<{ _id: string; count: number; revenue: number }>;
    statusCounts?: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasonComingSoon, setSeasonComingSoon] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await adminApi.payments() as { payments: Payment[]; summary?: typeof summary; seasonComingSoon?: boolean };
        if (!cancel) {
          setPayments(data.payments || []);
          setSummary(data.summary || null);
          setSeasonComingSoon(Boolean(data.seasonComingSoon));
        }
      } catch (e) {
        if (!cancel) setError((e as Error).message || 'Failed to load payments');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const totalRevenue = summary?.totalRevenue ?? payments.reduce((sum, t) => sum + (t.amountUsdc || 0), 0);
  const upgrades = summary?.byAction.find((t) => t._id === 'upgrade')?.count ?? payments.filter((t) => t.action === 'upgrade').length;
  const autoClaims = summary?.byAction.find((t) => t._id === 'auto_claim')?.count ?? payments.filter((t) => t.action === 'auto_claim').length;
  const totalTransactions = summary?.totalTransactions ?? payments.length;
  const pending = summary?.statusCounts?.pending ?? payments.filter((t) => t.status === 'pending').length;
  const processing = summary?.statusCounts?.processing ?? payments.filter((t) => t.status === 'processing').length;
  const failed = summary?.statusCounts?.failed ?? payments.filter((t) => t.status === 'failed').length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}` },
          { label: 'Verified Tx', value: totalTransactions.toString() },
          { label: 'Upgrades', value: upgrades.toString() },
          { label: 'Auto Claims', value: autoClaims.toString() },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: pending.toString() },
          { label: 'Processing', value: processing.toString() },
          { label: 'Failed', value: failed.toString() },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading payments...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-destructive">{error}</div>
        ) : seasonComingSoon ? (
          <div className="p-6 text-center">
            <p className="text-sm font-semibold">Season Coming Soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue and payment stats will start fresh when a new season is active.
            </p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No payments yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Wallet</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Tx Hash</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Type</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((t) => (
                  <tr key={t.txHash} className="border-b border-border/20 last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs break-all">{t.wallet}</p>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://basescan.org/tx/${t.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-accent hover:underline"
                      >
                        {t.txHash.slice(0, 12)}...
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {TYPE_ICONS[t.action] || <ArrowUpRight className="w-4 h-4 text-muted-foreground" />}
                        <span className="text-xs">
                          {TYPE_LABELS[t.action] || t.action}
                          {t.targetLevel ? ` -> ${t.targetLevel}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-bold text-xs">${t.amountUsdc.toFixed(2)} USDC</p>
                      {t.blockNumber ? (
                        <p className="text-[10px] text-muted-foreground">Block {t.blockNumber}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase">{t.status || 'unknown'}</p>
                      {t.failureReason ? (
                        <p className="text-[10px] text-destructive break-all">{t.failureReason}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                      {t.createdAt ? new Date(t.createdAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
