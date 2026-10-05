import { useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, Lock, Play, RotateCcw, Square, Trophy, Unlock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type TreasureRewardStateResponse } from '@/services/api';

interface Season {
  _id: string;
  name: string;
  status: 'active' | 'ended' | 'upcoming';
  startDate: string;
  endDate: string;
  topN: number;
  totalPayout: number;
  participants: number;
}

function localDateValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localTimeValue(date: Date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function localDateTimeToIso(date: string, time: string, seconds = '00') {
  return new Date(`${date}T${time}:${seconds}`).toISOString();
}

function formatCountdown(ms: number) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

export default function AdminSeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonComingSoon, setSeasonComingSoon] = useState(false);
  const [treasureRewardState, setTreasureRewardState] = useState<TreasureRewardStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [form, setForm] = useState({
    name: '',
    startDate: localDateValue(new Date()),
    startTime: localTimeValue(new Date()),
    endDate: localDateValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    topN: 50,
    totalPayout: 5000,
  });

  async function loadSeasons() {
    setLoading(true);
    try {
      const [data, rewardState] = await Promise.all([
        adminApi.seasons() as Promise<{
          seasons: Season[];
          seasonComingSoon?: boolean;
        }>,
        adminApi.treasureRewardState(),
      ]);
      setSeasons(data.seasons || []);
      setSeasonComingSoon(Boolean(data.seasonComingSoon));
      setTreasureRewardState(rewardState);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to load seasons');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSeasons();
    const poll = window.setInterval(loadSeasons, 10000);
    return () => window.clearInterval(poll);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeSeason = useMemo(
    () => seasons.find((season) => season.status === 'active'),
    [seasons],
  );
  const remainingMs = activeSeason
    ? Math.max(0, new Date(activeSeason.endDate).getTime() - nowTs)
    : 0;

  async function startSeason() {
    setBusy(true);
    try {
      await adminApi.startSeason({
        name: form.name.trim() || undefined,
        startDate: localDateTimeToIso(form.startDate, form.startTime, '00'),
        endDate: localDateTimeToIso(form.endDate, '23:59', '59'),
        topN: form.topN,
        totalPayout: form.totalPayout,
      });
      toast.success('Season started');
      setForm((current) => ({ ...current, name: '' }));
      await loadSeasons();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to start season');
    } finally {
      setBusy(false);
    }
  }

  async function endCurrentSeason() {
    setBusy(true);
    try {
      await adminApi.endCurrentSeason();
      toast.success('Season ended and all gameplay progress was reset');
      await loadSeasons();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to end season');
    } finally {
      setBusy(false);
    }
  }

  async function resetAllTreasures() {
    const confirmed = window.confirm(
      "Reset every user's Season treasure progress to 0/6? Payments, BD, levels, tasks, and gameplay spend history will not be changed.",
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const result = await adminApi.resetAllUserTreasures();
      toast.success(`Treasure progress reset for ${result.modifiedCount} users`);
      await loadSeasons();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to reset treasures');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Current Season', value: activeSeason?.name || 'Season Coming Soon', icon: Trophy },
          { label: 'Countdown', value: activeSeason ? formatCountdown(remainingMs) : 'Season Coming Soon', icon: Clock },
          { label: 'Participants', value: String(activeSeason?.participants || 0), icon: Users },
          { label: 'Total Payout', value: `$${(activeSeason?.totalPayout || 0).toLocaleString()}`, icon: Trophy },
        ].map((item) => (
          <div key={item.label} className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <item.icon className="w-4 h-4 text-accent" />
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
            <p className="text-xl font-bold break-words">{item.value}</p>
          </div>
        ))}
      </div>

      {treasureRewardState ? (
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Treasure Reward Qualification</p>
              <p className="text-sm font-semibold">
                Qualified: {treasureRewardState.qualifiedCount}/{treasureRewardState.maxEligible}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${treasureRewardState.closed ? 'bg-destructive/15 text-destructive' : 'bg-accent/15 text-accent'}`}>
              {treasureRewardState.closed ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              {treasureRewardState.closed ? 'Closed' : 'Open'}
            </span>
          </div>

          {treasureRewardState.closedAt ? (
            <p className="text-[11px] text-muted-foreground">
              Closed at: {new Date(treasureRewardState.closedAt).toLocaleString()}
            </p>
          ) : null}

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Qualified wallets</p>
            {treasureRewardState.eligibleWallets.length === 0 ? (
              <p className="text-xs text-muted-foreground">No qualified wallets yet.</p>
            ) : (
              <div className="grid gap-1">
                {treasureRewardState.eligibleWallets.map((wallet) => (
                  <p key={wallet} className="text-xs font-mono break-all">
                    {wallet}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Users with full treasure set ({treasureRewardState.completedCount})
            </p>
            {treasureRewardState.completedWallets.length === 0 ? (
              <p className="text-xs text-muted-foreground">No users at 6/6 yet.</p>
            ) : (
              <div className="grid gap-1">
                {treasureRewardState.completedWallets.map((wallet) => (
                  <p key={wallet} className="text-xs font-mono break-all">
                    {wallet}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {seasonComingSoon && !activeSeason ? (
        <div className="glass-card rounded-xl p-3 text-xs text-muted-foreground text-center">
          Season Coming Soon
        </div>
      ) : null}

      <div className="glass-card rounded-xl p-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr_auto] md:items-end">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Season name</span>
          <input className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Auto-generate if empty" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Start date</span>
          <input className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Start time (Local)</span>
          <input className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">End date</span>
          <input className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Top N</span>
          <input className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" type="number" min={1} value={form.topN} onChange={(e) => setForm({ ...form, topN: Number(e.target.value) })} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Payout USDC</span>
          <input className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" type="number" min={0} value={form.totalPayout} onChange={(e) => setForm({ ...form, totalPayout: Number(e.target.value) })} />
        </label>
        <button disabled={busy} onClick={startSeason} className="px-4 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Start
        </button>
      </div>

      <button disabled={busy || !activeSeason} onClick={endCurrentSeason} className="px-4 py-2.5 rounded-xl border border-destructive/40 text-destructive text-sm font-semibold flex items-center gap-2 hover:bg-destructive/10 transition-all active:scale-95 disabled:opacity-50">
        <Square className="w-4 h-4" />
        End Current Season
      </button>

      <div className="glass-card rounded-xl p-4 space-y-3 border border-destructive/30">
        <div>
          <p className="text-sm font-bold text-destructive">Reset Treasure Progress</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sets all users back to 0/6 season treasures. Payments, BD balances, levels, tasks, and spend history stay unchanged.
          </p>
        </div>
        <button disabled={busy} onClick={resetAllTreasures} className="px-4 py-2.5 rounded-xl border border-destructive/40 text-destructive text-sm font-semibold inline-flex items-center gap-2 hover:bg-destructive/10 transition-all active:scale-95 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          Reset All Users to 0/6
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading seasons...</div>
      ) : seasons.length === 0 ? (
        <div className="glass-card rounded-xl p-6 text-center text-xs text-muted-foreground">No seasons yet.</div>
      ) : (
        <div className="space-y-3">
          {seasons.map((season) => (
            <div key={season._id} className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Trophy className={`w-5 h-5 ${season.status === 'active' ? 'text-accent' : 'text-muted-foreground'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{season.name}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(season.startDate).toLocaleDateString()} {' to '} {new Date(season.endDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${season.status === 'active' ? 'bg-accent/20 text-accent' : season.status === 'ended' ? 'bg-secondary text-muted-foreground' : 'bg-primary/20 text-primary'}`}>{season.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/30 rounded-lg p-2.5 text-center"><p className="text-xs text-muted-foreground">Top N</p><p className="text-sm font-bold">{season.topN}</p></div>
                <div className="bg-secondary/30 rounded-lg p-2.5 text-center"><p className="text-xs text-muted-foreground">Payout</p><p className="text-sm font-bold">${season.totalPayout.toLocaleString()}</p></div>
                <div className="bg-secondary/30 rounded-lg p-2.5 text-center"><p className="text-xs text-muted-foreground">Users</p><p className="text-sm font-bold">{season.participants}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

