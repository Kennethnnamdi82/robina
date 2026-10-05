// --- context/AuthContext.tsx ---
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { getChainId, switchChain } from "wagmi/actions";
import {
  adminApi,
  authApi,
  setSessionToken,
  type ApiError,
} from "@/services/api";
import { buildAndSignSiwe } from "@/lib/siwe";
import { ROBINHOOD_CHAIN_ID, wagmiConfig } from "@/lib/wagmi";
import { HAS_BACKEND } from "@/lib/backend";

interface BaseUser {
  name: string;
  avatar: string;
  wallet: string;
  role?: string;
  completedTasks?: string[];
}

interface AuthContextType {
  isLoggedIn: boolean;
  baseUser: BaseUser | null;
  isAdmin: boolean;
  isConnecting: boolean;
  isAuthLoading: boolean;
  signInWithRobinhood: () => Promise<void>;
  signInAsAdmin: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const AUTH_WALLET_CACHE_KEY = "basedrop_auth_wallet_v1";

function avatarFor(wallet: string) {
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${wallet}`;
}

function shortName(wallet: string) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, connector: activeConnector } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [signedIn, setSignedIn] = useState(false);
  const [signedWallet, setSignedWallet] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(HAS_BACKEND);

  const resetAuthState = useCallback(() => {
    setSignedIn(false);
    setSignedWallet(null);
    setIsAdmin(false);
    localStorage.removeItem(AUTH_WALLET_CACHE_KEY);
    setSessionToken(null);
  }, []);

  useEffect(() => {
    if (!HAS_BACKEND) {
      setIsAuthLoading(false);
      return;
    }

    let cancelled = false;

    const cachedWallet = localStorage.getItem(AUTH_WALLET_CACHE_KEY);
    if (cachedWallet) {
      setSignedWallet(cachedWallet);
      setSignedIn(true);
    }

    const hydrateSession = async () => {
      const onAdminRoute = window.location.pathname
        .toLowerCase()
        .startsWith("/admin");

      try {
        if (onAdminRoute) {
          try {
            await adminApi.me();
            if (!cancelled) {
              setSignedIn(true);
              setIsAdmin(true);
              setSignedWallet(null);
              localStorage.removeItem(AUTH_WALLET_CACHE_KEY);
              setSessionToken(null);
            }
            return;
          } catch {
            const { user, token } = await authApi.me();
            if (!cancelled) {
              setSignedWallet(user.wallet);
              setSignedIn(true);
              setIsAdmin(false);
              localStorage.setItem(AUTH_WALLET_CACHE_KEY, user.wallet);
              if (token) setSessionToken(token);
            }
          }
          return;
        }

        const { user, token } = await authApi.me();
        if (!cancelled) {
          setSignedWallet(user.wallet);
          setSignedIn(true);
          setIsAdmin(false);
          localStorage.setItem(AUTH_WALLET_CACHE_KEY, user.wallet);
          if (token) setSessionToken(token);
        }
      } catch (e) {
        const err = e as ApiError;
        if (!cancelled && err?.status === 401) resetAuthState();
      } finally {
        if (!cancelled) setIsAuthLoading(false);
      }
    };

    hydrateSession();
    return () => {
      cancelled = true;
    };
  }, [resetAuthState]);

  const baseUser: BaseUser | null = useMemo(() => {
    if (isAdmin)
      return {
        name: "Admin",
        avatar: avatarFor("admin"),
        wallet: "0x0000000000000000000000000000000000000000",
        role: "admin",
        completedTasks: [],
      };

    const wallet = signedWallet || address;
    return wallet
      ? {
          name: shortName(wallet),
          role: "user",
          completedTasks: [],
          avatar: avatarFor(wallet),
          wallet,
        }
      : null;
  }, [address, signedWallet, isAdmin]);

  const signInWithRobinhood = useCallback(async () => {
    const robinhoodConnector = connectors.find(
      (connector) => connector.id === "robinhoodWallet",
    );

    if (!robinhoodConnector) {
      throw new Error("Robinhood Wallet connection is unavailable on this device");
    }

    let wallet = address;
    if (activeConnector?.id === robinhoodConnector.id && address) {
      if (getChainId(wagmiConfig) !== ROBINHOOD_CHAIN_ID) {
        await switchChain(wagmiConfig, { chainId: ROBINHOOD_CHAIN_ID });
      }
    } else {
      wallet = (
        await connectAsync({
          connector: robinhoodConnector,
          chainId: ROBINHOOD_CHAIN_ID,
        }).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          if (/provider not found/i.test(message)) {
            throw new Error(
              "Robinhood Wallet provider not found. Open this website in Robinhood Wallet's in-app browser and try again.",
            );
          }
          throw error;
        })
      ).accounts[0];
    }
    if (!wallet) throw new Error("No account returned");

    if (HAS_BACKEND) {
      const { nonce } = await authApi.nonce(wallet.toLowerCase());
      const { message, signature } = await buildAndSignSiwe(
        wallet as `0x${string}`,
        nonce,
      );
      const referralCode = localStorage.getItem("basedrop_ref") || undefined;
      const result = await authApi.verify(message, signature, referralCode);
      setSessionToken(result.token || null);
      localStorage.removeItem("basedrop_ref");
      localStorage.setItem(AUTH_WALLET_CACHE_KEY, result.user.wallet);
    }

    setIsAdmin(false);
    setSignedWallet(wallet.toLowerCase());
    setSignedIn(true);
  }, [address, activeConnector, connectAsync, connectors]);

  const signInAsAdmin = useCallback(async (email: string, password: string) => {
    if (!HAS_BACKEND)
      return { ok: false, error: "Admin backend is not configured" };
    try {
      await adminApi.login(email, password);

      await adminApi.me();
      setSignedIn(true);
      setIsAdmin(true);
      setSignedWallet(null);
      localStorage.removeItem(AUTH_WALLET_CACHE_KEY);
      setSessionToken(null);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message || "Login failed" };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (HAS_BACKEND) {
      try {
        if (isAdmin) {
          await adminApi.logout();
        } else {
          await authApi.logout();
        }
      } catch {
        /* noop */
      }
    }
    try {
      await disconnectAsync();
    } catch {
      /* noop */
    }
    resetAuthState();
  }, [disconnectAsync, resetAuthState, isAdmin]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: signedIn,
        baseUser,
        isAdmin,
        isConnecting,
        isAuthLoading,
        signInWithRobinhood,
        signInAsAdmin,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
