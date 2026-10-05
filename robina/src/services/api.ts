import { API_BASE_URL } from "@/lib/backend";

const BASE_URL = API_BASE_URL;
const SESSION_TOKEN_KEY = "basedrop_session_token_v1";

export type ApiError = Error & { status?: number; details?: unknown };

function readSessionToken(): string | null {
  try {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? token.trim() : null;
  } catch {
    return null;
  }
}

export function setSessionToken(token?: string | null) {
  try {
    if (token && token.trim()) {
      localStorage.setItem(SESSION_TOKEN_KEY, token.trim());
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // no-op
  }
}

/**
 * Enhanced request helper with Render-specific retry logic
 */
async function request<T>(
  path: string,
  init: RequestInit = {},
  retries = 2,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = `${BASE_URL}${normalizedPath}`;

  try {
    const sessionToken = readSessionToken();
    const res = await fetch(fullUrl, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...(init.headers || {}),
      },
      ...init,
    });

    const text = await res.text();
    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: "invalid_json_response", raw: text.slice(0, 300) };
      }
    }

    if (!res.ok) {
      const payload =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : {};
      if (
        res.status === 401 &&
        ["unauthenticated", "invalid_token", "token_revoked"].includes(
          String(payload.error || ""),
        )
      ) {
        setSessionToken(null);
      }
      const err = new Error(
        String(payload.error || `http_${res.status}`),
      ) as ApiError;
      err.status = res.status;
      err.details = data;
      throw err;
    }
    return data as T;
  } catch (err) {
    const apiErr = err as ApiError;
    const retryableStatus =
      typeof apiErr?.status === "number" ? apiErr.status >= 500 : true;
    if (
      retries > 0 &&
      err instanceof Error &&
      err.name !== "AbortError" &&
      retryableStatus
    ) {
      console.warn(`[api] Connection failed, retrying for Render wake-up...`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return request<T>(path, init, retries - 1);
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
};

// --- API Interfaces ---
export interface ApiUser {
  wallet: string;
  bdBalance: number;
  level: string;
  cardMultiplier?: number;
  lastClaimTime: string;
  autoClaimActive: boolean;
  autoClaimExpiry: string | null;
  referralCode: string;
  referralCount: number;
  completedTasks: string[];
  lastDailyTaskDate: string;
}

export interface ApiTaskSubmission {
  _id?: string;
  wallet: string;
  taskId: string;
  status: "pending" | "complete" | "rejected";
  reward: number;
  proof?: string;
  reviewRequired?: boolean;
  claimReadyAt?: string | null;
  verificationMethod?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PaymentAction = "upgrade" | "instant_claim" | "auto_claim" | "multiplier";

export interface GameCard {
  cardIndex: number;
  result: "treasure" | "empty";
  bdPointsEarned: number;
}

export interface GameSessionState {
  wallet: string;
  attempts: number;
  totalSpent: number;
  bdPoints: number;
  treasuresCollected: number;
  requiredTreasures: number;
  completed: boolean;
  roundNumber: number;
  roundStatus: "active" | "finished";
  cardsPerRound: number;
  cardPriceUsdc: number;
  openAllPriceUsdc: number;
  cardMultiplier?: number;
  paymentTo: `0x${string}`;
  usdcContract: `0x${string}`;
  chainId: number;
  seasonStage: number;
  seasonStageLabel: string;
  seasonEligible: boolean;
  seasonTreasures: Array<{ id: string; name: string; image: string }>;
  treasureBank: Array<{ id: string; name: string; image: string }>;
  revealedCards: GameCard[];
}

export interface RevealResponse {
  ok: true;
  result: "treasure" | "empty";
  cardIndex: number;
  bdPointsEarned: number;
  guaranteedCompletion?: boolean;
  revealedCard: {
    id: string;
    result: "treasure" | "empty";
    bdPointsEarned: number;
    treasure?: { id: string; name: string; image: string } | null;
  };
  foundTreasure?: { id: string; name: string; image: string } | null;
  session: GameSessionState;
}

export interface TreasureRewardStateResponse {
  key: string;
  maxEligible: number;
  qualifiedCount: number;
  eligibleWallets: string[];
  completedCount: number;
  completedWallets: string[];
  closed: boolean;
  closedAt: string | null;
  updatedAt?: string;
}

// --- API Methods ---
export const authApi = {
  nonce: (wallet: string) =>
    api.get<{ nonce: string }>(`/api/auth/nonce?wallet=${wallet}`),
  verify: (message: string, signature: string, ref?: string) =>
    api.post<{ ok: true; user: ApiUser; token?: string }>(`/api/auth/verify`, {
      message,
      signature,
      ref,
    }),
  me: () => api.get<{ user: ApiUser; token?: string | null }>(`/api/auth/me`),
  logout: () => api.post(`/api/auth/logout`),
};

export const miningApi = {
  status: () =>
    api.get<{
      canClaim: boolean;
      cooldownRemainingMs: number;
      reward: number;
      bdBalance: number;
      lastClaimTime?: string | null;
      nextClaimAt?: string | null;
      now?: string;
      autoClaimActive?: boolean;
      autoClaimExpiry?: string | null;
    }>(`/api/mining/status`),
  claim: () =>
    api.post<{
      ok: true;
      reward: number;
      bdBalance: number;
      lastClaimTime: string;
    }>(`/api/mining/claim`),
};

export const paymentsApi = {
  quote: (action: PaymentAction, targetMultiplier?: number) => {
    const params = new URLSearchParams({ action });
    if (targetMultiplier) params.set("multiplier", String(targetMultiplier));
    return api.get<{
      action: PaymentAction;
      amountUsdc: number;
      to: string;
      usdcContract: string;
      chainId: number;
      targetLevel?: string;
      targetMultiplier?: number;
      durationMs?: number;
    }>(`/api/payments/quote?${params.toString()}`);
  },
  verify: (txHash: string, action: PaymentAction, targetMultiplier?: number) =>
    api.post<{ ok: true; action: PaymentAction; user: Partial<ApiUser> }>(
      `/api/payments/verify`,
      { txHash, action, ...(targetMultiplier ? { targetMultiplier } : {}) },
    ),
  upgradeWithBd: () =>
    api.post<{ ok: true; user: Partial<ApiUser> }>(`/api/payments/upgrade-bd`),
};

export const tasksApi = {
  catalogue: () =>
    api.get<{
      tasks: Array<{
        id: string;
        title: string;
        reward: number;
        rewardPoints: number;
        description?: string;
        category?: string;
        actionUrl?: string;
        taskType?:
          | "default"
          | "daily"
          | "temporary_engagement"
          | "campaign"
          | "event_community";
        createdAt?: string;
        expiresAt?: string | null;
        status?: "active" | "inactive" | "archived";
      }>;
    }>(`/api/tasks/catalogue`),
  mine: () => api.get<{ tasks: ApiTaskSubmission[] }>(`/api/tasks/mine`),
  submit: (taskId: string, proof?: string) =>
    api.post(`/api/tasks/submit`, { taskId, proof }),
  start: (taskId: string) =>
    api.post<{ ok: true; task: ApiTaskSubmission; claimAvailableAt?: string }>(
      `/api/tasks/start`,
      { taskId },
    ),
  claim: (taskId: string) =>
    api.post<{ ok: true; task: ApiTaskSubmission; reward: number }>(
      `/api/tasks/claim`,
      { taskId },
    ),
  startAuto: (taskId: string) =>
    api.post<{ ok: true; task: ApiTaskSubmission; claimAvailableAt?: string }>(
      `/api/tasks/start-auto`,
      { taskId },
    ),
  claimAuto: (taskId: string) =>
    api.post<{ ok: true; task: ApiTaskSubmission; reward: number }>(
      `/api/tasks/claim-auto`,
      { taskId },
    ),
};

export const leaderboardApi = {
  top: (page = 1, limit = 10) =>
    api.get<{
      seasonComingSoon?: boolean;
      activeSeason?: {
        id: string;
        name: string;
        startDate: string;
        endDate: string;
      } | null;
      leaderboard: Array<{
        rank: number;
        wallet: string;
        bd: number;
        level: string;
      }>;
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }>(`/api/leaderboard?page=${page}&limit=${limit}`),
};

export const adminApi = {
  login: (email: string, password: string) =>
    api.post<{ ok: true; admin: { email: string } }>(`/api/admin/login`, {
      email,
      password,
    }),
  me: () =>
    api.get<{
      admin: { email: string | null; wallet?: string };
    }>(`/api/admin/me`),
  logout: () => api.post(`/api/admin/logout`),
  users: (opts?: {
    q?: string;
    level?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.level) params.set("level", opts.level);
    if (opts?.page && opts.page > 0) {
      const safeLimit = Math.max(1, opts?.limit || 50);
      params.set("skip", String((opts.page - 1) * safeLimit));
    }
    if (opts?.limit && opts.limit > 0) params.set("limit", String(opts.limit));
    const query = params.toString();
    return api.get<{
      users: Array<Record<string, unknown>>;
      total: number;
      limit: number;
      skip: number;
      page: number;
      totalPages: number;
    }>(`/api/admin/users${query ? `?${query}` : ""}`);
  },
  suspendUser: (wallet: string, durationHours: number) =>
    api.post(`/api/admin/users/suspend`, { wallet, durationHours }),
  reactivateUser: (wallet: string) =>
    api.post(`/api/admin/users/reactivate`, { wallet }),
  addUserBdBalance: (wallet: string, amount: number) =>
    api.post<{
      ok: true;
      added: number;
      user: { wallet: string; bdBalance: number; level: string };
    }>(`/api/admin/users/add-bd`, { wallet, amount }),

  reduceUserBdBalance: (wallet: string, amount: number) =>
    api.post<{
      ok: true;
      reduced: number;
      user: { wallet: string; bdBalance: number; level: string };
    }>(`/api/admin/users/reduce-bd`, { wallet, amount }),
  deleteUser: (wallet: string) =>
    api.post(`/api/admin/users/delete`, { wallet }),
  payments: () =>
    api.get<{
      seasonComingSoon?: boolean;
      activeSeason?: {
        id: string;
        name: string;
        startDate: string;
        endDate: string;
      } | null;
      payments: Array<Record<string, unknown>>;
      summary?: Record<string, unknown>;
    }>(`/api/admin/payments`),
  tasks: (status = "") =>
    api.get<{
      tasks: Array<Record<string, unknown>>;
      definitions: Array<Record<string, unknown>>;
    }>(`/api/admin/tasks${status ? `?status=${status}` : ""}`),
  createTaskDefinition: (body: {
    id: string;
    title: string;
    description?: string;
    reward?: number;
    rewardPoints?: number;
    category?:
      | "custom"
      | "x_follow"
      | "x_like"
      | "x_retweet"
      | "x_comment"
      | "x_post"
      | "telegram_join"
      | "discord_join";
    taskType?:
      | "default"
      | "daily"
      | "temporary_engagement"
      | "campaign"
      | "event_community";
    actionUrl?: string;
    published?: boolean;
    status?: "active" | "inactive" | "archived";
    expiresAt?: string | null;
  }) => api.post(`/api/admin/tasks/definitions`, body),
  updateTaskDefinition: (
    taskId: string,
    body: {
      title?: string;
      description?: string;
      reward?: number;
      rewardPoints?: number;
      category?:
        | "custom"
        | "x_follow"
        | "x_like"
        | "x_retweet"
        | "x_comment"
        | "x_post"
        | "telegram_join"
        | "discord_join";
      taskType?:
        | "default"
        | "daily"
        | "temporary_engagement"
        | "campaign"
        | "event_community";
      actionUrl?: string;
      published?: boolean;
      status?: "active" | "inactive" | "archived";
      expiresAt?: string | null;
    },
  ) =>
    request(`/api/admin/tasks/definitions/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteTaskDefinition: (taskId: string) =>
    request(`/api/admin/tasks/definitions/${taskId}`, { method: "DELETE" }),
  reviewTask: (taskMongoId: string, decision: "approve" | "reject") =>
    api.post(`/api/admin/tasks/review`, { taskMongoId, decision }),
  seasons: () =>
    api.get<{
      seasons: Array<Record<string, unknown>>;
      activeSeason?: Record<string, unknown> | null;
      seasonComingSoon?: boolean;
    }>(`/api/admin/seasons`),
  startSeason: (body: {
    name?: string;
    startDate?: string;
    endDate?: string;
    topN: number;
    totalPayout: number;
  }) => api.post(`/api/admin/seasons/start`, body),
  endCurrentSeason: () => api.post(`/api/admin/seasons/end-current`),
  resetAllUserTreasures: () =>
    api.post<{ ok: true; matchedCount: number; modifiedCount: number }>(
      `/api/admin/seasons/reset-treasures`,
    ),
  treasureRewardState: () =>
    api.get<TreasureRewardStateResponse>(`/api/admin/treasure-rewards/state`),
  analytics: () => api.get<Record<string, unknown>>(`/api/admin/analytics`),
  leaderboard: (page = 1, limit = 50) =>
    api.get<{
      seasonComingSoon?: boolean;
      activeSeason?: {
        id: string;
        name: string;
        startDate: string;
        endDate: string;
      } | null;
      leaderboard: Array<{
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
      }>;
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }>(`/api/admin/leaderboard?page=${page}&limit=${limit}`),
};

export const gameApi = {
  start: () =>
    api.post<{ ok: true; session: GameSessionState }>(`/api/game/start`),
  state: () =>
    api.get<{ ok: true; session: GameSessionState }>(`/api/game/state`),
  reveal: (cardIndex: number, txHash: string) =>
    api.post<RevealResponse>(`/api/game/reveal`, { cardIndex, txHash }),
  openAll: (txHash: string) =>
    api.post<{
      ok: true;
      opened: number;
      foundTreasure?: { id: string; name: string; image: string } | null;
      guaranteedCompletion?: boolean;
      cards: GameCard[];
      session: GameSessionState;
    }>(`/api/game/open-all`, { txHash }),
  reset: () =>
    api.post<{ ok: true; session: GameSessionState }>(`/api/game/reset`),
};
