import { useEffect, useState } from "react";
import { adminApi } from "@/services/api";

interface AdminLeaderboardEntry {
  rank: number;
  wallet: string;
  bd: number;
  level: string;
  totalUsdcSpent?: number;
  gameplay?: {
    attempts: number;
    totalSpent: number;
    bdPoints: number;
    treasuresCollected: number;
    requiredTreasures: number;
    seasonTreasuresCount: number;
    seasonEligible: boolean;
    hasAllSeasonTreasures: boolean;
  } | null;
}

export default function AdminRankingPage() {
  const [rows, setRows] = useState<AdminLeaderboardEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasonComingSoon, setSeasonComingSoon] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async (hard = false) => {
      if (hard) setLoading(true);
      setError(null);
      try {
        const res = await adminApi.leaderboard(page, 25);
        if (!mounted) return;
        setRows(res.leaderboard || []);
        setTotalPages(res.totalPages || 1);
        setSeasonComingSoon(Boolean(res.seasonComingSoon));
      } catch (e) {
        if (mounted) setError((e as Error).message || "Failed to load ranking");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load(true);
    const interval = window.setInterval(() => {
      load(false);
    }, 10000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [page]);

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-4">
        <p className="text-sm font-semibold">Admin Ranking</p>
        <p className="text-xs text-muted-foreground mt-1">
          Full wallet addresses are shown for season payout processing.
        </p>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-xs text-muted-foreground text-center">Loading rankings...</div>
        ) : error ? (
          <div className="p-6 text-xs text-destructive text-center">{error}</div>
        ) : seasonComingSoon ? (
          <div className="p-6 text-center">
            <p className="text-sm font-semibold">Season Coming Soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ranking positions will be available when the next season is active.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-xs text-muted-foreground text-center">No ranking data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Rank</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Wallet</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground">BD Balance</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Level</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground">Attempts</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground">Season Treasures</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground">Gameplay USDC</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground">Total USDC Spent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.wallet}_${row.rank}`} className="border-b border-border/20 last:border-0">
                    <td className="px-3 py-2 text-xs font-semibold">#{row.rank}</td>
                    <td className="px-3 py-2 text-[11px] break-all">{row.wallet}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold">{row.bd.toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs">{row.level}</td>
                    <td className="px-3 py-2 text-xs text-right">{row.gameplay?.attempts ?? 0}</td>
                    <td className="px-3 py-2 text-xs text-right">
                      {row.gameplay
                        ? `${row.gameplay.seasonTreasuresCount}/${row.gameplay.requiredTreasures}`
                        : "0/6"}
                    </td>
                    <td className="px-3 py-2 text-xs text-right">
                      {(row.gameplay?.totalSpent ?? 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs text-right">
                      {(row.totalUsdcSpent ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!seasonComingSoon && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-2 rounded-lg border border-border text-xs disabled:opacity-50"
          >
            Previous
          </button>
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-3 py-2 rounded-lg border border-border text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
