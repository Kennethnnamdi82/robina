import { API_BASE_URL } from '@/lib/backend';
import { httpRequest, type RequestOptions } from './http';
import type { AdminUser, AdminPayment, PaymentSummary, AdminSeason, AdminTask, AdminTaskDefinition, AdminAnalytics } from './contracts';
export type { ApiError } from './http';
const request = <T>(path: string, init: RequestInit = {}, options?: RequestOptions) => httpRequest<T>(API_BASE_URL + (path.startsWith('/') ? path : '/' + path), init, options);
export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, {}, options),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
};
// --- API Interfaces ---
export interface ApiUser {
  wallet: string;
  email?: string | null;
  authMethod?: "wallet_evm" | "wallet_solana" | "privy_google";
  chainType?: "evm" | "solana" | "none";
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
  paymentTo: string;
  usdcContract: string;
  chainId: number | string;
  paymentNetworks: Array<{
    chainType: "evm" | "solana";
    chainId: number | string;
    usdcContract: string;
    recipient: string;
  }>;
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
  nonce: (
    wallet: string,
    options: { chainType: "evm"; chainId: number } | { chainType: "solana" },
  ) => {
    const params = new URLSearchParams({
      wallet,
      chainType: options.chainType,
    });
    if (options.chainType === "evm") params.set("chainId", String(options.chainId));
    return api.get<{ nonce: string; chainId: string; domain: string; uri: string; expiresAt: string }>(
      `/api/auth/nonce?${params.toString()}`,
    );
  },
  verify: (message: string, signature: string, ref?: string) =>
    api.post<{ ok: true; user: ApiUser }>(`/api/auth/verify`, {
      message,
      signature,
      ref,
    }),
  wallet: (body: {
    message: string;
    signature: string;
    address: string;
    chainType: "evm" | "solana";
    chainId?: string;
    ref?: string;
  }) => api.post<{ ok: true; user: ApiUser }>(`/api/auth/wallet`, body),
  google: (accessToken: string, ref?: string) =>
    api.post<{ ok: true; user: ApiUser }>(`/api/auth/google`, { accessToken, ref }),
  me: (options?: RequestOptions) => api.get<{ user: ApiUser }>(`/api/auth/me`, options),
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
  createIntent: (
    action: PaymentAction,
    targetMultiplier?: number,
    chainId?: number,
    chainType: "evm" | "solana" = "evm",
  ) =>
    api.post<{
      intent: {
        id: string;
        action: PaymentAction;
        chainType: "evm" | "solana";
        chainId: number | string;
        asset: { type: "native" | "erc20" | "spl"; address?: string | null; symbol: string; decimals: number };
        amount: string;
        amountAtomic: string;
        recipient: string;
        expiresAt: string;
      };
    }>(`/api/payments/intents`, {
      action,
      chainType,
      ...(targetMultiplier ? { targetMultiplier } : {}),
      ...(chainId ? { chainId } : {}),
    }),
  verifyIntent: (intentId: string, transactionHash: string) =>
    api.post<{ ok: true; intentId: string; status: "verified"; user?: Partial<ApiUser> }>(
      `/api/payments/verify-intent`,
      { intentId, transactionHash },
    ),
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
  verify: (txHash: string, action: PaymentAction, targetMultiplier?: number, chainId?: number) =>
    api.post<{ ok: true; action: PaymentAction; user: Partial<ApiUser> }>(
      `/api/payments/verify`,
      { txHash, action, ...(targetMultiplier ? { targetMultiplier } : {}), ...(chainId ? { chainId } : {}) },
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
  me: (options?: RequestOptions) =>
    api.get<{
      admin: { email: string | null; wallet?: string };
    }>(`/api/admin/me`, options),
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
      users: AdminUser[];
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
      payments: AdminPayment[];
      summary?: PaymentSummary;
    }>(`/api/admin/payments`),
  tasks: (status = "") =>
    api.get<{
      tasks: AdminTask[];
      definitions: AdminTaskDefinition[];
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
      seasons: AdminSeason[];
      activeSeason?: AdminSeason | null;
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
  analytics: () => api.get<AdminAnalytics>(`/api/admin/analytics`),
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
  reveal: (cardIndex: number, txHash: string, chainId: number | string, chainType: "evm" | "solana") =>
    api.post<RevealResponse>(`/api/game/reveal`, { cardIndex, txHash, chainId: typeof chainId === "number" ? chainId : undefined, chainType }),
  openAll: (txHash: string, chainId: number | string, chainType: "evm" | "solana") =>
    api.post<{
      ok: true;
      opened: number;
      foundTreasure?: { id: string; name: string; image: string } | null;
      guaranteedCompletion?: boolean;
      cards: GameCard[];
      session: GameSessionState;
    }>(`/api/game/open-all`, { txHash, chainId: typeof chainId === "number" ? chainId : undefined, chainType }),
  reset: () =>
    api.post<{ ok: true; session: GameSessionState }>(`/api/game/reset`),
};
