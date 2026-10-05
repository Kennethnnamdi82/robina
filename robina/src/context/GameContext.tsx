import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  UserState,
  LEVELS,
  CLAIM_COOLDOWN,
  AUTO_CLAIM_DURATION,
  TASK_REWARD,
  DAILY_TASK_REWARD,
  Level,
  LeaderboardEntry,
  getClaimReward,
} from "@/types/game";
import {
  authApi,
  miningApi,
  tasksApi,
  leaderboardApi,
  paymentsApi,
  type ApiUser,
} from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { HAS_BACKEND } from "@/lib/backend";

const USER_CACHE_KEY = "basedrop_user_cache_v1";

interface GameContextType {
  user: UserState;
  loading: boolean;
  leaderboardLoading: boolean;
  leaderboardError: string | null;
  claimBD: () => Promise<boolean>;
  instantClaim: () => Promise<boolean>;
  completeTask: (taskId: string, link: string) => Promise<boolean>;
  upgradeLevelWithBD: () => Promise<boolean>;
  upgradeLevelWithUSDC: () => Promise<boolean>;
  activateAutoClaim: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
  refreshLeaderboard: () => Promise<void>;
  canClaim: boolean;
  claimCooldownRemaining: number;
  leaderboard: LeaderboardEntry[];
  levelJustChanged: string | null;
  clearLevelChange: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, wallet: "0xA1...5678", bd: 12500, level: "Diamond" },
  { rank: 2, wallet: "0xB2...7890", bd: 9800, level: "Gold" },
];

function emptyUser(wallet = "0x000"): UserState {
  return {
    wallet,
    bd: 0,
    level: "Beginner",
    cardMultiplier: 1,
    lastClaimTime: 0,
    autoClaimActive: false,
    autoClaimExpiry: 0,
    referralCount: 0,
    referralCode: "",
    completedTasks: [],
    boostUsesToday: 0,
    lastBoostDate: "",
    lastDailyTaskDate: "",
  };
}

function fromApiUser(u: ApiUser): UserState {
  const now = Date.now();
  const parsedLastClaim = u.lastClaimTime ? new Date(u.lastClaimTime).getTime() : 0;
  const safeLastClaim = Number.isFinite(parsedLastClaim)
    ? Math.min(parsedLastClaim, now)
    : 0;
  return {
    wallet: u.wallet,
    bd: u.bdBalance,
    level: (u.level as Level) || "Beginner",
    cardMultiplier: Number(u.cardMultiplier || 1),
    lastClaimTime: safeLastClaim,
    autoClaimActive: u.autoClaimActive,
    autoClaimExpiry: u.autoClaimExpiry
      ? new Date(u.autoClaimExpiry).getTime()
      : 0,
    referralCount: u.referralCount,
    referralCode: u.referralCode,
    completedTasks: u.completedTasks || [],
    boostUsesToday: 0,
    lastBoostDate: "",
    lastDailyTaskDate: u.lastDailyTaskDate || "",
  };
}

function applyMiningStatusToUser(
  base: UserState,
  status: {
    canClaim: boolean;
    cooldownRemainingMs: number;
    bdBalance: number;
    lastClaimTime?: string | null;
    autoClaimActive?: boolean;
    autoClaimExpiry?: string | null;
  },
): UserState {
  const parsedLastClaim =
    status.lastClaimTime != null
      ? new Date(status.lastClaimTime).getTime()
      : base.lastClaimTime;
  const safeLastClaim = Number.isFinite(parsedLastClaim)
    ? Math.min(parsedLastClaim, Date.now())
    : base.lastClaimTime;
  const parsedAutoExpiry =
    status.autoClaimExpiry != null
      ? new Date(status.autoClaimExpiry).getTime()
      : base.autoClaimExpiry;
  return {
    ...base,
    bd: Number(status.bdBalance ?? base.bd),
    lastClaimTime: safeLastClaim,
    autoClaimActive:
      typeof status.autoClaimActive === "boolean"
        ? status.autoClaimActive
        : base.autoClaimActive,
    autoClaimExpiry: Number.isFinite(parsedAutoExpiry)
      ? parsedAutoExpiry
      : base.autoClaimExpiry,
  };
}

function readCachedUser(wallet?: string | null): UserState | null {
  if (!wallet) return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, UserState>;
    const key = wallet.toLowerCase();
    const cached = parsed[key];
    if (!cached) return null;
    const safeLastClaim = Math.min(Number(cached.lastClaimTime || 0), Date.now());
    return {
      ...cached,
      lastClaimTime: Number.isFinite(safeLastClaim) ? safeLastClaim : 0,
    };
  } catch {
    return null;
  }
}

function writeCachedUser(user: UserState) {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, UserState>) : {};
    parsed[user.wallet.toLowerCase()] = user;
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // no-op
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, baseUser, isAdmin } = useAuth();
  const [user, setUser] = useState<UserState>(emptyUser());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [levelJustChanged, setLevelJustChanged] = useState<string | null>(null);
  const [loading, setLoading] = useState(HAS_BACKEND);
  const lastWallet = useRef<string | null>(null);
  const clearLevelChange = useCallback(() => setLevelJustChanged(null), []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user.wallet || user.wallet === "0x000") return;
    writeCachedUser(user);
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (!HAS_BACKEND) return;
    try {
      const [meResult, miningResult] = await Promise.allSettled([
        authApi.me(),
        miningApi.status(),
      ]);
      if (meResult.status !== "fulfilled") {
        throw meResult.reason;
      }

      let mapped = fromApiUser(meResult.value.user);
      if (miningResult.status === "fulfilled") {
        mapped = applyMiningStatusToUser(mapped, miningResult.value);
      }

      setUser(mapped);
      writeCachedUser(mapped);
    } catch (e) {
      console.error("Refresh User Error:", e);
    }
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    if (!HAS_BACKEND) {
      setLeaderboard(MOCK_LEADERBOARD);
      return;
    }
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const { leaderboard: lb } = await leaderboardApi.top();
      setLeaderboard(lb.map((e) => ({ ...e, level: e.level as Level })));
    } catch (e) {
      setLeaderboardError("Failed to load leaderboard");
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      lastWallet.current = null;
      setLoading(false);
      setUser(emptyUser());
      return;
    }
    if (baseUser?.wallet) {
      const cached = readCachedUser(baseUser.wallet);
      if (cached) setUser(cached);
    }
  }, [isLoggedIn, baseUser?.wallet]);

  useEffect(() => {
    if (!HAS_BACKEND || isAdmin || !isLoggedIn || !baseUser?.wallet) return;
    if (lastWallet.current === baseUser.wallet) return;
    lastWallet.current = baseUser.wallet;
    setLoading(true);
    Promise.all([refreshUser(), refreshLeaderboard()]).finally(() =>
      setLoading(false),
    );
  }, [isLoggedIn, baseUser?.wallet, isAdmin, refreshUser, refreshLeaderboard]);

  useEffect(() => {
    if (!HAS_BACKEND || isAdmin || !isLoggedIn || !baseUser?.wallet) return;
    const interval = window.setInterval(() => {
      refreshUser();
      refreshLeaderboard();
    }, 12000);
    return () => window.clearInterval(interval);
  }, [isLoggedIn, baseUser?.wallet, isAdmin, refreshUser, refreshLeaderboard]);

  const safeLastClaimTime = Math.min(Number(user.lastClaimTime || 0), now);
  const elapsed = Math.max(0, now - safeLastClaimTime);
  const canClaim = !loading && elapsed >= CLAIM_COOLDOWN;
  const claimCooldownRemaining = loading
    ? CLAIM_COOLDOWN
    : Math.min(CLAIM_COOLDOWN, Math.max(0, CLAIM_COOLDOWN - elapsed));

  const claimBD = useCallback(async () => {
    if (HAS_BACKEND) {
      try {
        const r = await miningApi.claim();
        setUser((prev) => ({
          ...prev,
          bd: r.bdBalance,
          lastClaimTime: new Date(r.lastClaimTime).getTime(),
        }));
        await refreshLeaderboard();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, [refreshLeaderboard]);

  const instantClaim = useCallback(async () => {
    if (HAS_BACKEND) {
      try {
        await refreshUser();
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }, [refreshUser]);

  const completeTask = useCallback(
    async (taskId: string, link: string) => {
      if (HAS_BACKEND) {
        try {
          await tasksApi.submit(taskId, link);
          await refreshUser();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    [refreshUser],
  );

  const upgradeLevelWithBD = useCallback(async () => {
    const idx = LEVELS.findIndex((l) => l.name === user.level);
    const next = LEVELS[idx + 1];
    if (!next || user.bd < next.bdRequired) return false;
    try {
      const r = await paymentsApi.upgradeWithBd();
      setUser((prev) => ({
        ...prev,
        bd: r.user.bdBalance,
        level: r.user.level as Level,
      }));
      setLevelJustChanged(next.name);
      await refreshLeaderboard();
      return true;
    } catch {
      return false;
    }
  }, [user, refreshLeaderboard]);

  const upgradeLevelWithUSDC = useCallback(async () => {
    try {
      await refreshUser();
      return true;
    } catch {
      return false;
    }
  }, [refreshUser]);

  const activateAutoClaim = useCallback(async () => {
    try {
      await refreshUser();
      return true;
    } catch {
      return false;
    }
  }, [refreshUser]);

  return (
    <GameContext.Provider
      value={{
        user,
        loading,
        leaderboardLoading,
        leaderboardError,
        claimBD,
        instantClaim,
        completeTask,
        upgradeLevelWithBD,
        upgradeLevelWithUSDC,
        activateAutoClaim,
        refreshUser,
        refreshLeaderboard,
        canClaim,
        claimCooldownRemaining,
        leaderboard,
        levelJustChanged,
        clearLevelChange,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame error");
  return ctx;
};
