import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgeDollarSign,
  BadgePercent,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Gamepad2,
  Gem,
  Globe2,
  Laptop,
  Loader2,
  LockKeyhole,
  MousePointerClick,
  RefreshCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { adminApi } from "@/services/api";
import { cn } from "@/lib/utils";
import { shortenWallet } from "@/types/game";
import { toast } from "sonner";

type PaymentAction =
  | "upgrade"
  | "instant_claim"
  | "auto_claim"
  | "game_card"
  | "game_bundle"
  | "multiplier";

type PaymentRow = {
  _id?: string;
  wallet: string;
  txHash?: string;
  action: PaymentAction;
  amountUsdc: number;
  status?: "pending" | "processing" | "verified" | "failed";
  targetLevel?: string | null;
  failureReason?: string | null;
  createdAt?: string;
};

type UserRow = {
  _id?: string;
  wallet: string;
  level?: string;
  bdBalance?: number;
  referralCount?: number;
  requiredTreasures?: number;
  seasonTreasuresCount?: number;
  seasonEligible?: boolean;
  hasAllSeasonTreasures?: boolean;
  createdAt?: string;
  updatedAt?: string;
  activityStatus?: "active" | "inactive" | "suspended";
  accountStatus?: "active" | "suspended";
};

type TaskRow = {
  _id?: string;
  wallet?: string;
  taskId?: string;
  status?: "pending" | "complete" | "rejected";
  reward?: number;
  createdAt?: string;
  updatedAt?: string;
};

type LeaderboardRow = {
  wallet: string;
  rank: number;
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
};

type AnalyticsData = {
  users?: number;
  payments?: number;
  tasks?: Array<{ _id: string; count: number }>;
  totalBd?: number;
  totalRevenue?: number;
};

type ActivityRow = {
  id: string;
  username: string;
  wallet: string;
  type: string;
  details: string;
  time?: string;
  amount?: number;
  tone: "green" | "blue" | "amber" | "red" | "purple" | "slate";
};

type Period = "today" | "week" | "month";

const ACTION_LABELS: Record<string, string> = {
  upgrade: "Level Upgrade",
  instant_claim: "Instant Claim",
  auto_claim: "Auto Claim Purchase",
  game_card: "Treasure Card Opened",
  game_bundle: "Treasure Open All",
  multiplier: "Card Multiplier Purchase",
};

const REVENUE_ACTIONS = [
  { key: "upgrade", label: "Upgrade Revenue", icon: ArrowUpRight, tone: "text-accent" },
  { key: "auto_claim", label: "Auto Claim Revenue", icon: Zap, tone: "text-green-400" },
  { key: "multiplier", label: "Multiplier Revenue", icon: BadgePercent, tone: "text-accent" },
  { key: "game", label: "Treasure Revenue", icon: Gem, tone: "text-primary" },
];

function toDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(date?: Date | null) {
  if (!date) return false;
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isWithinDays(date: Date | null | undefined, days: number) {
  if (!date) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value?: string) {
  const date = toDate(value);
  if (!date) return "Not tracked";
  return date.toLocaleString();
}

function formatTime(value?: string) {
  const date = toDate(value);
  if (!date) return "Not tracked";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(wallet: string) {
  return wallet ? wallet.slice(2, 4).toUpperCase() : "BD";
}

function activityToneClass(tone: ActivityRow["tone"]) {
  const styles: Record<ActivityRow["tone"], string> = {
    green: "bg-green-500/12 text-green-300 border-green-400/25",
    blue: "bg-sky-500/12 text-sky-300 border-sky-400/25",
    amber: "bg-amber-500/12 text-amber-300 border-amber-400/25",
    red: "bg-red-500/12 text-red-300 border-red-400/25",
    purple: "bg-fuchsia-500/12 text-fuchsia-300 border-fuchsia-400/25",
    slate: "bg-slate-500/12 text-slate-300 border-slate-400/25",
  };
  return styles[tone];
}

export default function AdminActivityPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [treasureState, setTreasureState] = useState<{
    qualifiedCount: number;
    maxEligible: number;
    completedCount: number;
    eligibleWallets: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("today");
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, usersRes, paymentsRes, tasksRes, leaderboardRes, treasureRes] =
        await Promise.all([
          adminApi.analytics(),
          adminApi.users({ limit: 200 }),
          adminApi.payments(),
          adminApi.tasks(),
          adminApi.leaderboard(1, 100),
          adminApi.treasureRewardState(),
        ]);

      setAnalytics(analyticsRes as AnalyticsData);
      setUsers(((usersRes as { users?: UserRow[] }).users || []) as UserRow[]);
      setPayments(((paymentsRes as { payments?: PaymentRow[] }).payments || []) as PaymentRow[]);
      setTasks(((tasksRes as { tasks?: TaskRow[] }).tasks || []) as TaskRow[]);
      setLeaderboard(((leaderboardRes as { leaderboard?: LeaderboardRow[] }).leaderboard || []) as LeaderboardRow[]);
      setTreasureState(treasureRes as typeof treasureState);
    } catch (e) {
      setError((e as Error).message || "Failed to load activity dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPayments = useMemo(() => {
    const days = period === "today" ? 1 : period === "week" ? 7 : 30;
    return payments.filter((payment) => {
      const date = toDate(payment.createdAt);
      return period === "today" ? isSameDay(date) : isWithinDays(date, days);
    });
  }, [payments, period]);

  const stats = useMemo(() => {
    const verifiedPayments = payments.filter((payment) => payment.status === "verified");
    const revenueToday = verifiedPayments
      .filter((payment) => isSameDay(toDate(payment.createdAt)))
      .reduce((sum, payment) => sum + Number(payment.amountUsdc || 0), 0);
    const revenueWeek = verifiedPayments
      .filter((payment) => isWithinDays(toDate(payment.createdAt), 7))
      .reduce((sum, payment) => sum + Number(payment.amountUsdc || 0), 0);
    const revenueMonth = verifiedPayments
      .filter((payment) => isWithinDays(toDate(payment.createdAt), 30))
      .reduce((sum, payment) => sum + Number(payment.amountUsdc || 0), 0);

    return {
      totalUsers: Number(analytics?.users || users.length || 0),
      newUsersToday: users.filter((user) => isSameDay(toDate(user.createdAt))).length,
      activeUsersToday: users.filter((user) => isSameDay(toDate(user.updatedAt))).length,
      revenueToday,
      revenueWeek,
      revenueMonth,
      totalRevenue: Number(analytics?.totalRevenue || 0),
    };
  }, [analytics, payments, users]);

  const revenueBreakdown = useMemo(() => {
    const verified = filteredPayments.filter((payment) => payment.status === "verified");
    return REVENUE_ACTIONS.map((item) => {
      const rows =
        item.key === "game"
          ? verified.filter((payment) => payment.action === "game_card" || payment.action === "game_bundle")
          : verified.filter((payment) => payment.action === item.key);
      return {
        ...item,
        count: rows.length,
        revenue: rows.reduce((sum, payment) => sum + Number(payment.amountUsdc || 0), 0),
      };
    });
  }, [filteredPayments]);

  const activityRows = useMemo<ActivityRow[]>(() => {
    const fromPayments = payments.map((payment) => {
      const label = ACTION_LABELS[payment.action] || "Payment Completed";
      const failed = payment.status === "failed";
      return {
        id: payment._id || payment.txHash || `${payment.wallet}-${payment.createdAt}`,
        username: shortenWallet(payment.wallet || ""),
        wallet: payment.wallet || "",
        type: failed ? "Payment Issue" : label,
        details: failed
          ? payment.failureReason || "Payment verification failed"
          : `${money(payment.amountUsdc)} USDC${payment.targetLevel ? ` to ${payment.targetLevel}` : ""}`,
        time: payment.createdAt,
        amount: payment.amountUsdc,
        tone: failed
          ? "red"
          : payment.action === "auto_claim"
            ? "green"
            : payment.action === "upgrade"
              ? "amber"
              : payment.action === "game_card" || payment.action === "game_bundle"
                ? "purple"
                : "blue",
      } satisfies ActivityRow;
    });

    const fromTasks = tasks
      .filter((task) => task.status === "complete")
      .map((task) => ({
        id: task._id || `${task.wallet}-${task.taskId}`,
        username: shortenWallet(task.wallet || ""),
        wallet: task.wallet || "",
        type: "Social Task Completed",
        details: `${task.taskId || "Task"} completed for ${Number(task.reward || 0).toLocaleString()} BD`,
        time: task.updatedAt || task.createdAt,
        tone: "green" as const,
      }));

    const fromUsers = users.map((user) => ({
      id: user._id || user.wallet,
      username: shortenWallet(user.wallet),
      wallet: user.wallet,
      type: "User Registration",
      details: `${user.level || "Beginner"} account created`,
      time: user.createdAt,
      tone: "blue" as const,
    }));

    return [...fromPayments, ...fromTasks, ...fromUsers]
      .filter((row) => {
        const needle = query.trim().toLowerCase();
        if (!needle) return true;
        return [row.username, row.wallet, row.type, row.details]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => (toDate(b.time)?.getTime() || 0) - (toDate(a.time)?.getTime() || 0))
      .slice(0, 80);
  }, [payments, query, tasks, users]);

  const topSpenders = useMemo(() => {
    return [...leaderboard]
      .sort((a, b) => Number(b.totalUsdcSpent || b.gameplay?.totalSpent || 0) - Number(a.totalUsdcSpent || a.gameplay?.totalSpent || 0))
      .slice(0, 8);
  }, [leaderboard]);

  const selectedUser = useMemo(() => {
    if (!selectedWallet) return null;
    const normalized = selectedWallet.toLowerCase();
    const user = users.find((row) => row.wallet?.toLowerCase() === normalized);
    const rank = leaderboard.find((row) => row.wallet?.toLowerCase() === normalized);
    const userPayments = payments.filter((row) => row.wallet?.toLowerCase() === normalized);
    const userTasks = tasks.filter((row) => row.wallet?.toLowerCase() === normalized);
    return { user, rank, payments: userPayments, tasks: userTasks, wallet: selectedWallet };
  }, [leaderboard, payments, selectedWallet, tasks, users]);

  function copyWallet(wallet: string) {
    navigator.clipboard.writeText(wallet);
    toast.success("Wallet copied");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        Loading activity dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <p className="text-sm font-semibold text-destructive">{error}</p>
        <button
          onClick={load}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
              <Activity className="h-3 w-3" />
              Live Admin Monitor
            </div>
            <h1 className="text-2xl font-black tracking-tight">BaseDrop Activity & Analytics</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Growth, user activity, revenue, spending behavior, and platform usage in one view.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search wallet or activity"
                className="h-10 w-full rounded-xl border border-border/60 bg-background/70 pl-9 pr-3 text-sm outline-none transition focus:border-primary sm:w-72"
              />
            </div>
            <button
              onClick={load}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-4 text-xs font-bold transition hover:bg-secondary active:scale-95"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-7">
        <MetricCard label="Total Users" value={stats.totalUsers.toLocaleString()} icon={Users} tone="text-sky-400" />
        <MetricCard label="New Users Today" value={stats.newUsersToday.toLocaleString()} icon={UserPlus} tone="text-primary" />
        <MetricCard label="Active Users Today" value={stats.activeUsersToday.toLocaleString()} icon={Activity} tone="text-green-400" />
        <MetricCard label="Revenue Today" value={money(stats.revenueToday)} icon={BadgeDollarSign} tone="text-emerald-400" />
        <MetricCard label="Revenue This Week" value={money(stats.revenueWeek)} icon={BarChart3} tone="text-accent" />
        <MetricCard label="Revenue This Month" value={money(stats.revenueMonth)} icon={CreditCard} tone="text-yellow-400" />
        <MetricCard label="Total Revenue" value={money(stats.totalRevenue)} icon={Trophy} tone="text-fuchsia-400" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="glass-card overflow-hidden rounded-2xl border border-border/60">
          <SectionHeader icon={MousePointerClick} title="User Activity Log" subtitle={`${activityRows.length} latest actions`} />
          {activityRows.length === 0 ? (
            <EmptyState title="No matching activity" detail="Try another wallet, action, or clear the search field." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/20 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Username</th>
                    <th className="px-4 py-3 font-semibold">Wallet Address</th>
                    <th className="px-4 py-3 font-semibold">Date & Time</th>
                    <th className="px-4 py-3 font-semibold">Activity Type</th>
                    <th className="px-4 py-3 font-semibold">Activity Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map((row) => (
                    <tr key={row.id} className="group border-b border-border/20 transition hover:bg-secondary/25">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedWallet(row.wallet)}
                          className="flex items-center gap-2 font-semibold text-foreground transition hover:text-primary"
                        >
                          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg border text-[10px]", activityToneClass(row.tone))}>
                            {initials(row.wallet)}
                          </span>
                          {row.username}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        <button onClick={() => copyWallet(row.wallet)} className="hover:text-primary">
                          {row.wallet}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(row.time)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full border px-2 py-1 text-[10px] font-bold uppercase", activityToneClass(row.tone))}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">{row.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="glass-card rounded-2xl border border-border/60 p-4">
            <SectionHeader icon={Trophy} title="6/6 Treasure Review" subtitle="Reward slot progress" compact />
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Qualified Users</p>
                <p className="text-xl font-black">
                  {treasureState?.qualifiedCount ?? 0}/{treasureState?.maxEligible ?? 4}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{
                    width: `${Math.min(100, ((treasureState?.qualifiedCount || 0) / (treasureState?.maxEligible || 4)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {treasureState?.completedCount ?? 0} wallets currently show full treasure completion.
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl border border-border/60 p-4">
            <SectionHeader icon={BadgeDollarSign} title="Top Spending Users" subtitle="Verified USDC spend" compact />
            <div className="mt-3 space-y-2">
              {topSpenders.length === 0 ? (
                <EmptyState title="No spender data" detail="Verified payments will appear here." small />
              ) : (
                topSpenders.map((row) => {
                  const spent = Number(row.totalUsdcSpent || row.gameplay?.totalSpent || 0);
                  return (
                    <button
                      key={row.wallet}
                      onClick={() => setSelectedWallet(row.wallet)}
                      className="flex w-full items-center justify-between rounded-xl border border-border/40 bg-background/35 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-bold">{shortenWallet(row.wallet)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Rank #{row.rank} Â· {row.level}
                        </p>
                      </div>
                      <p className="text-sm font-black text-emerald-400">{money(spent)}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="glass-card rounded-2xl border border-border/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeader icon={CreditCard} title="Revenue Breakdown" subtitle="Upgrade, auto claim, and treasure revenue" compact />
            <div className="flex rounded-xl border border-border/60 bg-secondary/30 p-1">
              {(["today", "week", "month"] as Period[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setPeriod(item)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[11px] font-bold capitalize transition",
                    period === item ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item === "week" ? "This Week" : item === "month" ? "This Month" : "Today"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {revenueBreakdown.map((row) => (
              <div key={row.key} className="rounded-xl border border-border/50 bg-background/35 p-4 transition hover:-translate-y-0.5 hover:border-primary/30">
                <row.icon className={cn("mb-3 h-5 w-5", row.tone)} />
                <p className="text-[11px] font-semibold text-muted-foreground">{row.label}</p>
                <p className="mt-1 text-xl font-black">{money(row.revenue)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{row.count} purchase{row.count === 1 ? "" : "s"}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-border/60 p-4">
          <SectionHeader icon={Globe2} title="Device & Login Tracking" subtitle="Login session capture status" compact />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { icon: Globe2, label: "Country / City", value: "Pending backend capture" },
              { icon: LockKeyhole, label: "IP Address", value: "Pending backend capture" },
              { icon: Laptop, label: "Browser / OS", value: "Pending backend capture" },
              { icon: Smartphone, label: "Device / Source", value: "Pending backend capture" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-dashed border-border/70 bg-background/30 p-4">
                <item.icon className="mb-3 h-5 w-5 text-muted-foreground" />
                <p className="text-xs font-bold">{item.label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-[11px] text-amber-200">
            The current backend does not store login sessions, country, IP, browser, OS, device type, or source yet. This section is ready for that data once the login tracking endpoint/model is added.
          </div>
        </div>
      </section>

      {selectedUser ? (
        <UserDrawer
          selected={selectedUser}
          onClose={() => setSelectedWallet(null)}
          onCopy={copyWallet}
        />
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ElementType;
  tone: string;
}) {
  return (
    <div className="glass-card group rounded-2xl border border-border/60 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="rounded-xl border border-border/50 bg-background/50 p-2">
          <Icon className={cn("h-4 w-4", tone)} />
        </div>
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground/40 transition group-hover:text-primary" />
      </div>
      <p className="text-xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  compact = false,
}: {
  icon: ElementType;
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", !compact && "border-b border-border/40 p-4")}>
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-black">{title}</h2>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, detail, small = false }: { title: string; detail: string; small?: boolean }) {
  return (
    <div className={cn("text-center", small ? "py-5" : "p-8")}>
      <AlertCircle className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function UserDrawer({
  selected,
  onClose,
  onCopy,
}: {
  selected: {
    user?: UserRow;
    rank?: LeaderboardRow;
    payments: PaymentRow[];
    tasks: TaskRow[];
    wallet: string;
  };
  onClose: () => void;
  onCopy: (wallet: string) => void;
}) {
  const wallet = selected.wallet;
  const user = selected.user;
  const rank = selected.rank;
  const totalSpent = selected.payments
    .filter((payment) => payment.status === "verified")
    .reduce((sum, payment) => sum + Number(payment.amountUsdc || 0), 0);
  const treasureCount = rank?.gameplay?.seasonTreasuresCount ?? user?.seasonTreasuresCount ?? 0;
  const requiredTreasures = rank?.gameplay?.requiredTreasures ?? user?.requiredTreasures ?? 6;
  const completedTasks = selected.tasks.filter((task) => task.status === "complete").length;

  return (
    <>
      <button
        aria-label="Close user details"
        className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl animate-slide-in-right">
        <div className="border-b border-border/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-primary text-sm font-black text-primary-foreground">
                {initials(wallet)}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black">User Details</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{wallet}</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl border border-border p-2 transition hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 custom-scrollbar">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase text-muted-foreground">Wallet Address</p>
                <p className="mt-1 break-all font-mono text-xs">{wallet}</p>
              </div>
              <button onClick={() => onCopy(wallet)} className="rounded-lg border border-border p-2 text-muted-foreground transition hover:text-primary">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DrawerStat label="Username" value={shortenWallet(wallet)} icon={Users} />
            <DrawerStat label="Current Level" value={user?.level || rank?.level || "Unknown"} icon={ShieldCheck} />
            <DrawerStat label="Registration Date" value={formatDateTime(user?.createdAt)} icon={UserPlus} />
            <DrawerStat label="Last Active Date" value={formatDateTime(user?.updatedAt)} icon={Clock3} />
            <DrawerStat label="Total BD Earned" value={Number(rank?.gameplay?.bdPoints || user?.bdBalance || rank?.bd || 0).toLocaleString()} icon={Sparkles} />
            <DrawerStat label="Total Money Spent" value={money(totalSpent || rank?.totalUsdcSpent || rank?.gameplay?.totalSpent || 0)} icon={BadgeDollarSign} />
            <DrawerStat label="Total Referrals" value={String(user?.referralCount ?? 0)} icon={UserPlus} />
            <DrawerStat label="Treasure Progress" value={`${treasureCount}/${requiredTreasures}`} icon={Gem} />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <h3 className="mb-3 text-sm font-black">Recent User History</h3>
            <div className="space-y-2">
              {selected.payments.slice(0, 6).map((payment) => (
                <div key={payment._id || payment.txHash} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3">
                  <div>
                    <p className="text-xs font-bold">{ACTION_LABELS[payment.action] || payment.action}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDateTime(payment.createdAt)}</p>
                  </div>
                  <p className={cn("text-xs font-black", payment.status === "verified" ? "text-emerald-400" : "text-muted-foreground")}>
                    {money(payment.amountUsdc)}
                  </p>
                </div>
              ))}
              {selected.payments.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No payment history found for this user.</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DrawerStat label="Completed Tasks" value={String(completedTasks)} icon={CheckCircle2} />
            <DrawerStat label="Leaderboard Rank" value={rank ? `#${rank.rank}` : "Unranked"} icon={Trophy} />
          </div>
        </div>

        <div className="border-t border-border/60 p-4">
          <button onClick={onClose} className="w-full rounded-xl gradient-primary py-3 text-xs font-black text-primary-foreground transition active:scale-[0.98]">
            Close Details
          </button>
        </div>
      </aside>
    </>
  );
}

function DrawerStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <Icon className="mb-3 h-4 w-4 text-primary" />
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-black">{value}</p>
    </div>
  );
}
