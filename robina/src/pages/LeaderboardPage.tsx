import { useEffect, useMemo, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { shortenWallet, getLevelInfo } from '@/types/game';
import { Crown } from 'lucide-react';
import { leaderboardApi } from '@/services/api';
import { formatUsdReward, getSeasonRewardAmount } from '@/utils/seasonRewards';

export default function RankPage() {
  const PAGE_SIZE = 50;
  const {
    user,
    loading,
  } = useGame();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [leaderboard, setLeaderboard] = useState<
    Array<{ rank: number; wallet: string; bd: number; level: string }>
  >([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [seasonComingSoon, setSeasonComingSoon] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadLeaderboard = async () => {
      setLeaderboardLoading(true);
      setLeaderboardError(null);
      try {
        const res = await leaderboardApi.top(page, PAGE_SIZE);
        if (!mounted) return;
        setLeaderboard(res.leaderboard);
        setTotalPages(res.totalPages || 1);
        setSeasonComingSoon(Boolean(res.seasonComingSoon));
      } catch {
        if (mounted) setLeaderboardError('Failed to load leaderboard');
      } finally {
        if (mounted) setLeaderboardLoading(false);
      }
    };
    loadLeaderboard();
    const interval = window.setInterval(loadLeaderboard, 12000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [page]);

  const userRank = useMemo(() => {
    const idx = leaderboard.findIndex((e) => e.wallet === user.wallet);
    return idx >= 0 ? leaderboard[idx].rank : null;
  }, [leaderboard, user.wallet]);
  const userReward = userRank ? getSeasonRewardAmount(userRank) : null;

  const empty = !loading && !leaderboardLoading && leaderboard.length === 0;

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Rank</h1>
        <p className="text-xs text-muted-foreground">
          Ranked by BD balance. Top 30 show Season 2 payout.
        </p>
      </div>

      {seasonComingSoon ? (
        <div className="glass-card rounded-2xl p-6 text-center">
          <p className="text-lg font-bold">Season 1 Live Now</p>
          <p className="text-xs text-muted-foreground mt-1">
            Rankings will populate as Season 2 activity comes in.
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#171a22]/95 p-4 shadow-card">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/12 via-white/5 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <div className="relative z-10 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-primary-foreground/70">Your Rank</p>
              <p className="text-3xl font-black text-primary-foreground">
                {userRank ? `#${userRank}` : '--'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-primary-foreground/70">BD Balance</p>
              <p className="text-xl font-bold text-primary-foreground">
                {user.bd.toLocaleString()} BD
              </p>
            </div>
          </div>
          <div className="relative z-10 mt-4 rounded-xl bg-white/10 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase text-primary-foreground/65">
              Your Season 2 Payout
            </p>
            <p className="text-2xl font-black text-primary-foreground">
              {userReward ? formatUsdReward(userReward) : '$0'}
            </p>
          </div>
        </div>
      )}

      {empty && (
        <div className="glass-card rounded-2xl p-6 text-center text-xs text-muted-foreground">
          No leaderboard data yet - be the first to claim BD!
        </div>
      )}

      {leaderboardError && (
        <div className="glass-card rounded-2xl p-4 text-center text-xs text-destructive">
          {leaderboardError}
        </div>
      )}

      {!seasonComingSoon && (
        <div className="glass-card rounded-2xl overflow-hidden">
          {leaderboard.map((entry, idx) => (
            (() => {
              const reward = getSeasonRewardAmount(entry.rank);
              return (
              <div
                key={entry.rank}
                className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/30 last:border-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {idx === 0 && page === 1 ? (
                    <Crown className="w-4 h-4 shrink-0 text-yellow-400" />
                  ) : null}
                  <span className="w-7 shrink-0 text-sm font-bold text-muted-foreground">
                    #{entry.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{shortenWallet(entry.wallet)}</p>
                    <p className={`text-[10px] ${getLevelInfo(entry.level).color}`}>
                      {entry.level}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {reward ? (
                    <span className="mb-1 inline-flex rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-black text-primary">
                      {formatUsdReward(reward)}
                    </span>
                  ) : null}
                  <span className="block text-sm font-bold">{entry.bd.toLocaleString()} BD</span>
                </div>
              </div>
              );
            })()
          ))}
        </div>
      )}

      {!seasonComingSoon && (
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || leaderboardLoading}
            className="px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || leaderboardLoading}
            className="px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
