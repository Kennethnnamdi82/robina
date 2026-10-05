import { useEffect, useMemo, useState } from "react";
import { Search, Filter, ChevronDown, Loader2 } from "lucide-react";
import { shortenWallet } from "@/types/game";
import LevelIcon from "@/components/LevelIcon";
import type { Level } from "@/types/game";
import { adminApi } from "@/services/api";

interface BackendUser {
  _id?: string;
  wallet: string;
  level: Level;
  bdBalance: number;
  referralCount: number;
  requiredTreasures?: number;
  seasonTreasuresCount?: number;
  seasonEligible?: boolean;
  hasAllSeasonTreasures?: boolean;
  createdAt?: string;
  updatedAt?: string;
  activityStatus?: "active" | "inactive" | "suspended";
  accountStatus?: "active" | "suspended";
}

function formatLastSeen(lastSeenAt?: string): {
  isActiveNow: boolean;
  label: string;
  tone: "green" | "gray" | "amber";
} {
  if (!lastSeenAt) {
    return { isActiveNow: false, label: "Inactive", tone: "gray" };
  }

  const parsed = new Date(lastSeenAt);
  if (Number.isNaN(parsed.getTime())) {
    return { isActiveNow: false, label: "Inactive", tone: "gray" };
  }

  const diffMs = Math.max(0, Date.now() - parsed.getTime());
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  // Treat users seen within 2 minutes as currently active.
  if (diffMs <= 2 * minuteMs) {
    return { isActiveNow: true, label: "Active", tone: "green" };
  }

  if (diffMs < hourMs) {
    const mins = Math.max(1, Math.floor(diffMs / minuteMs));
    return {
      isActiveNow: false,
      label: `Active ${mins} minute${mins === 1 ? "" : "s"} ago`,
      tone: "gray",
    };
  }

  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / hourMs));
    return {
      isActiveNow: false,
      label: `Active ${hours} hour${hours === 1 ? "" : "s"} ago`,
      tone: "gray",
    };
  }

  const days = Math.max(1, Math.floor(diffMs / dayMs));
  return {
    isActiveNow: false,
    label: `Active ${days} day${days === 1 ? "" : "s"} ago`,
    tone: "gray",
  };
}

export default function AdminUsersPage() {
  const PAGE_SIZE = 50;
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [busyWallet, setBusyWallet] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = (await adminApi.users({
          q: search.trim(),
          level: levelFilter === "all" ? undefined : levelFilter,
          page,
          limit: PAGE_SIZE,
        })) as {
          users: BackendUser[];
          total?: number;
          totalPages?: number;
          page?: number;
        };
        if (!cancel) {
          setUsers(data.users || []);
          setTotalUsers(Number(data.total || 0));
          const nextTotalPages = Math.max(1, Number(data.totalPages || 1));
          setTotalPages(nextTotalPages);
          if (data.page && data.page !== page) {
            setPage(Math.max(1, Math.min(data.page, nextTotalPages)));
          } else if (page > nextTotalPages) {
            setPage(nextTotalPages);
          }
        }
      } catch (e) {
        if (!cancel) setError((e as Error).message || "Failed to load users");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [search, levelFilter, page]);

  const stats = useMemo(() => {
    const total = totalUsers;
    // Added (u.bdBalance || 0) to prevent NaN if balance is missing
    const active = users.filter((u) => (u.bdBalance || 0) > 0).length;
    const avgBd = users.length
      ? Math.round(
          users.reduce((s, u) => s + (u.bdBalance || 0), 0) / users.length,
        )
      : 0;
    const suspended = users.filter(
      (u) => u.activityStatus === "suspended",
    ).length;
    const inactive = users.filter(
      (u) => u.activityStatus === "inactive",
    ).length;
    return { total, active, avgBd, suspended, inactive };
  }, [users, totalUsers]);

  const pageStart = totalUsers === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, totalUsers);

  async function suspend(wallet: string) {
    setBusyWallet(wallet);
    try {
      await adminApi.suspendUser(wallet, 24 * 7);
      const data = (await adminApi.users({
        q: search.trim(),
        level: levelFilter === "all" ? undefined : levelFilter,
        page,
        limit: PAGE_SIZE,
      })) as {
        users: BackendUser[];
        total?: number;
        totalPages?: number;
        page?: number;
      };
      setUsers(data.users || []);
      setTotalUsers(Number(data.total || 0));
      setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      if (data.page && data.page !== page) setPage(data.page);
    } finally {
      setBusyWallet(null);
    }
  }

  async function reactivate(wallet: string) {
    setBusyWallet(wallet);
    try {
      await adminApi.reactivateUser(wallet);
      const data = (await adminApi.users({
        q: search.trim(),
        level: levelFilter === "all" ? undefined : levelFilter,
        page,
        limit: PAGE_SIZE,
      })) as {
        users: BackendUser[];
        total?: number;
        totalPages?: number;
        page?: number;
      };
      setUsers(data.users || []);
      setTotalUsers(Number(data.total || 0));
      setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      if (data.page && data.page !== page) setPage(data.page);
    } finally {
      setBusyWallet(null);
    }
  }

  async function remove(wallet: string) {
    setBusyWallet(wallet);
    try {
      await adminApi.deleteUser(wallet);
      const data = (await adminApi.users({
        q: search.trim(),
        level: levelFilter === "all" ? undefined : levelFilter,
        page,
        limit: PAGE_SIZE,
      })) as {
        users: BackendUser[];
        total?: number;
        totalPages?: number;
        page?: number;
      };
      setUsers(data.users || []);
      setTotalUsers(Number(data.total || 0));
      const nextTotalPages = Math.max(1, Number(data.totalPages || 1));
      setTotalPages(nextTotalPages);
      if (data.page && data.page !== page) {
        setPage(data.page);
      } else if (page > nextTotalPages) {
        setPage(nextTotalPages);
      }
    } finally {
      setBusyWallet(null);
    }
  }

  // Define a type for the action
  type BalanceAction = "add" | "reduce";

  async function handleBalanceChange(user: BackendUser, action: BalanceAction) {
    const isAdd = action === "add";

    const raw = window.prompt(
      `Amount of BD to ${isAdd ? "ADD" : "REDUCE"} for ${user.wallet}\nCurrent balance: ${(user.bdBalance || 0).toLocaleString()} BD`,
      "1",
    );

    if (raw === null) return;
    const amount = Number(raw);

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid BD amount greater than 0.");
      return;
    }

    // Safety check for reduction
    if (!isAdd && amount > (user.bdBalance || 0)) {
      window.alert("Cannot reduce more than the current balance.");
      return;
    }

    if (
      !window.confirm(
        `${isAdd ? "Add" : "Reduce"} ${amount.toLocaleString()} BD for this user?`,
      )
    )
      return;

    setBusyWallet(user.wallet);
    try {
      // Dynamic API call based on action
      const result = isAdd
        ? await adminApi.addUserBdBalance(user.wallet, amount)
        : await adminApi.reduceUserBdBalance(user.wallet, amount);

      setUsers((current) =>
        current.map((u) =>
          u.wallet === user.wallet
            ? { ...u, bdBalance: result.user.bdBalance }
            : u,
        ),
      );

      window.alert(
        `Success! New balance: ${result.user.bdBalance.toLocaleString()} BD.`,
      );
    } catch (error) {
      window.alert("Operation failed: " + (error.message || "Unknown error"));
    } finally {
      setBusyWallet(null);
    }
  }
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: stats.total.toLocaleString() },
          {
            label: "Active On Page (BD>0)",
            value: stats.active.toLocaleString(),
          },
          { label: "Avg BD On Page", value: stats.avgBd.toLocaleString() },
          { label: "Showing", value: `${pageStart}-${pageEnd}` },
          { label: "Inactive On Page", value: stats.inactive.toLocaleString() },
          {
            label: "Suspended On Page",
            value: stats.suspended.toLocaleString(),
          },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search wallet..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setPage(1);
            }}
            className="pl-10 pr-8 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Levels</option>
            {[
              "Beginner",
              "Bronze",
              "Silver",
              "Gold",
              "Platinum",
              "Diamond",
              "Master",
              "Grandmaster",
              "Legendary",
              "Top Legendary",
            ].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading users…
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-destructive">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">
                    Wallet
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">
                    Level
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">
                    BD Balance
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium hidden md:table-cell">
                    Referrals
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium hidden md:table-cell">
                    Season Treasures
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium hidden md:table-cell">
                    Joined
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium min-w-[300px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => {
                  // FIXED: Use _id or index as key to avoid crashes on missing wallets
                  // Presence display is derived from existing updatedAt; no user data is modified.
                  const presence =
                    u.activityStatus === "suspended"
                      ? {
                          isActiveNow: false,
                          label: "Suspended",
                          tone: "amber" as const,
                        }
                      : formatLastSeen(u.updatedAt);
                  return (
                    <tr
                      key={u._id || u.wallet || index}
                      className="border-b border-border/20 last:border-0 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-xs">
                          {shortenWallet(u.wallet || "")}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono break-all mt-0.5">
                          {u.wallet}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <LevelIcon level={u.level} size={14} />
                          <span className="text-xs">{u.level}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-xs">
                        {(u.bdBalance || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-xs hidden md:table-cell">
                        {u.referralCount || 0}
                      </td>
                      <td className="px-4 py-3 text-right text-xs hidden md:table-cell">
                        {`${u.seasonTreasuresCount ?? 0}/${u.requiredTreasures ?? 6}`}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        <span className="inline-flex items-center justify-end gap-2">
                          <span
                            className={[
                              "inline-block h-2.5 w-2.5 rounded-full",
                              presence.tone === "green"
                                ? "bg-green-400"
                                : presence.tone === "amber"
                                  ? "bg-amber-400"
                                  : "bg-zinc-400",
                            ].join(" ")}
                          />
                          <span
                            className={
                              presence.tone === "green"
                                ? "text-green-400"
                                : presence.tone === "amber"
                                  ? "text-amber-400"
                                  : "text-zinc-300"
                            }
                          >
                            {presence.label}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right min-w-[300px]">
                        <div className="flex items-center justify-end gap-5 whitespace-nowrap">
                          {u.activityStatus === "suspended" ? (
                            <button
                              disabled={busyWallet === u.wallet}
                              onClick={() => reactivate(u.wallet)}
                              className="px-3 py-1.5 rounded-md border border-green-500/50 text-green-300 text-[11px] font-semibold hover:bg-green-500/10 disabled:opacity-50"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              disabled={busyWallet === u.wallet}
                              onClick={() => suspend(u.wallet)}
                              className="px-3 py-1.5 rounded-md border border-amber-500/50 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/10 disabled:opacity-50"
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            disabled={busyWallet === u.wallet}
                            onClick={() => handleBalanceChange(u, "add")}
                            className="px-3 py-1.5 rounded-md border border-primary bg-primary text-primary-foreground text-[11px] font-bold shadow-sm hover:bg-primary/90 disabled:opacity-50"
                          >
                            increase BD
                          </button>
                          <button
                            disabled={busyWallet === u.wallet}
                            onClick={() => handleBalanceChange(u, "reduce")}
                            className="px-3 py-1.5 rounded-md border border-primary bg-primary text-primary-foreground text-[11px] font-bold shadow-sm hover:bg-primary/90 disabled:opacity-50"
                          >
                            Reduce BD
                          </button>
                          <button
                            disabled={busyWallet === u.wallet}
                            onClick={() => remove(u.wallet)}
                            className="px-3 py-1.5 rounded-md border border-destructive/50 text-destructive text-[11px] font-semibold hover:bg-destructive/10 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && totalUsers > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-border/50 text-xs disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-border/50 text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
