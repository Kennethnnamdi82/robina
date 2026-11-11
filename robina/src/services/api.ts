import { API_BASE_URL } from '@/lib/backend';
import { httpRequest, type RequestOptions } from './http';
export type { ApiError } from './http';
const request = <T>(path: string, init: RequestInit = {}, options?: RequestOptions) => httpRequest<T>(API_BASE_URL + (path.startsWith('/') ? path : '/' + path), init, options);
export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, {}, options),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
};

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

// Existing authentication transport. Bounty APIs live in services/bounties.ts.
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
    request<{ ok: true; user: ApiUser }>(`/api/auth/google`, {method:'POST',body:JSON.stringify({accessToken,ref})}, {timeoutMs:30000,retries:0}),
  me: (options?: RequestOptions) => api.get<{ user: ApiUser }>(`/api/auth/me`, options),
  logout: () => api.post(`/api/auth/logout`),
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
};
