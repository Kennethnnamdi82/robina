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
import { usePrivy } from "@privy-io/react-auth";
import { getWallets } from "@wallet-standard/app";
import type { WalletAccount } from "@wallet-standard/base";
import bs58 from "bs58";
import { getChainId, switchChain } from "wagmi/actions";
import {
  adminApi,
  authApi,
  type ApiError,
} from "@/services/api";
import { buildAndSignSiwe } from "@/lib/siwe";
import { BASE_CHAIN_ID, ROBINHOOD_CHAIN_ID, wagmiConfig, openWalletModal } from "@/lib/wagmi";
import { HAS_BACKEND } from "@/lib/backend";
import { getPhantomWallet, type PhantomWallet } from "@/lib/phantomWallet";

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
  authChainType: "evm" | "solana" | "none";
  isAdmin: boolean;
  isConnecting: boolean;
  isAuthLoading: boolean;
  signInWithRobinhood: (preferredChainId?: number) => Promise<void>;
  signInWithSolana: () => Promise<void>;
  solanaAddress: string | null;
  solanaWallet: PhantomWallet | null;
  solanaWalletAccount: WalletAccount | null;
  connectSolanaWallet: () => Promise<{ wallet: PhantomWallet; account: WalletAccount }>;
  signInWithGoogle: () => Promise<void>;
  signInAsAdmin: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
function avatarFor(wallet: string) {
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${wallet}`;
}

function shortName(wallet: string) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { authenticated: privyAuthenticated, getAccessToken, login: openPrivyLogin, logout: privyLogout } = usePrivy();
  const { address, connector: activeConnector } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [signedIn, setSignedIn] = useState(false);
  const [signedWallet, setSignedWallet] = useState<string | null>(null);
  const [solanaWallet, setSolanaWallet] = useState<PhantomWallet | null>(null);
  const [solanaWalletAccount, setSolanaWalletAccount] = useState<WalletAccount | null>(null);
  const [authChainType, setAuthChainType] = useState<"evm" | "solana" | "none">("none");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(HAS_BACKEND);
  const [googleLoginRequested, setGoogleLoginRequested] = useState(false);

  const resetAuthState = useCallback(() => {
    setSignedIn(false);
    setSignedWallet(null);
    setAuthChainType("none");
    setIsAdmin(false);
  }, []);

  useEffect(() => {
    const wallets = getWallets();
    const refreshPhantom = () => {
      const wallet = getPhantomWallet();
      setSolanaWallet(wallet);
      setSolanaWalletAccount(wallet?.accounts.find((account) => account.chains.includes("solana:mainnet")) || null);
    };
    refreshPhantom();
    return wallets.on("register", refreshPhantom);
  }, []);

  useEffect(() => {
    if (!HAS_BACKEND) {
      setIsAuthLoading(false);
      return;
    }

    let cancelled = false;

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
              setAuthChainType("none");
            }
            return;
          } catch {
            const { user } = await authApi.me();
            if (!cancelled) {
              setSignedWallet(user.wallet);
              setAuthChainType(user.chainType || "none");
              setSignedIn(true);
              setIsAdmin(false);
            }
          }
          return;
        }

        const { user } = await authApi.me();
        if (!cancelled) {
          setSignedWallet(user.wallet);
          setAuthChainType(user.chainType || "none");
          setSignedIn(true);
          setIsAdmin(false);
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

  useEffect(() => {
    if (!googleLoginRequested || !privyAuthenticated || !HAS_BACKEND) return;
    let cancelled = false;
    const completeGoogleLogin = async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Google authentication token was unavailable");
        const result = await authApi.google(accessToken);
        if (cancelled) return;
        setSignedWallet(result.user.wallet);
        setAuthChainType(result.user.chainType || "none");
        setSignedIn(true);
        setIsAdmin(false);
      } finally {
        if (!cancelled) setGoogleLoginRequested(false);
      }
    };
    void completeGoogleLogin();
    return () => { cancelled = true; };
  }, [getAccessToken, googleLoginRequested, privyAuthenticated]);

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

  const signInWithRobinhood = useCallback(async (preferredChainId = ROBINHOOD_CHAIN_ID) => {
    if (![ROBINHOOD_CHAIN_ID, BASE_CHAIN_ID].includes(preferredChainId)) {
      throw new Error("Choose Robinhood Chain or Base to sign in.");
    }
    const walletConnector = activeConnector || connectors.find((connector) =>
      /robinhood|injected|coinbase|metamask|phantom|walletconnect/i.test(`${connector.id} ${connector.name}`),
    );

    if (!walletConnector) {
      openWalletModal();
      throw new Error("Connect MetaMask, Coinbase Wallet, Phantom, or Robinhood Wallet, then sign in.");
    }

    let wallet = address;
    if (address) {
      if (getChainId(wagmiConfig) !== preferredChainId) {
        await switchChain(wagmiConfig, { chainId: preferredChainId });
      }
    } else {
      wallet = (
        await connectAsync({
          connector: walletConnector,
          chainId: preferredChainId,
        }).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          if (/provider not found/i.test(message)) {
            throw new Error(
              "Wallet provider not found. Open this website in your wallet's browser or install the wallet extension, then try again.",
            );
          }
          throw error;
        })
      ).accounts[0];
    }
    if (!wallet) throw new Error("No account returned");

    if (HAS_BACKEND) {
      const { nonce } = await authApi.nonce(wallet.toLowerCase(), {
        chainType: "evm",
        chainId: preferredChainId,
      });
      const { message, signature } = await buildAndSignSiwe(
        wallet as `0x${string}`,
        nonce,
        preferredChainId,
      );
      const referralCode = localStorage.getItem("basedrop_ref") || undefined;
      const result = await authApi.verify(message, signature, referralCode);
      localStorage.removeItem("basedrop_ref");
    }

    setIsAdmin(false);
    setSignedWallet(wallet.toLowerCase());
    setAuthChainType("evm");
    setSignedIn(true);
  }, [address, activeConnector, connectAsync, connectors]);

  const connectSolanaWallet = useCallback(async () => {
    const wallet = solanaWallet || getPhantomWallet();
    if (!wallet) throw new Error("Install or enable the Phantom browser wallet, then try again.");
    const connected = await wallet.features["standard:connect"].connect();
    const account = connected.accounts.find((entry) => entry.chains.includes("solana:mainnet"));
    if (!account) throw new Error("Phantom did not provide a Solana mainnet account.");
    setSolanaWallet(wallet);
    setSolanaWalletAccount(account);
    return { wallet, account };
  }, [solanaWallet]);

  const signInWithSolana = useCallback(async () => {
    if (!HAS_BACKEND) throw new Error("Authentication backend is not configured");
    const { wallet, account } = await connectSolanaWallet();
    const address = account.address;

    const { nonce, expiresAt } = await authApi.nonce(address, { chainType: "solana" });
    const issuedAt = new Date().toISOString();
    const message = [
      `${window.location.host} wants you to sign in with your Solana account:`,
      address,
      "",
      "Sign in to Robina.",
      "",
      `URI: ${window.location.origin}`,
      "Version: 1",
      "Chain ID: solana:mainnet",
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
      `Expiration Time: ${expiresAt}`,
    ].join("\n");
    const [signedMessage] = await wallet.features["solana:signMessage"].signMessage({
      account,
      message: new TextEncoder().encode(message),
    });
    if (!signedMessage?.signature) throw new Error("Phantom did not return a message signature.");
    const ref = localStorage.getItem("basedrop_ref") || undefined;
    const result = await authApi.wallet({
      message,
      signature: bs58.encode(signedMessage.signature),
      address,
      chainType: "solana",
      ref,
    });
    localStorage.removeItem("basedrop_ref");
    setIsAdmin(false);
    setSignedWallet(result.user.wallet);
    setAuthChainType("solana");
    setSignedIn(true);
  }, [connectSolanaWallet]);

  const signInAsAdmin = useCallback(async (email: string, password: string) => {
    if (!HAS_BACKEND)
      return { ok: false, error: "Admin backend is not configured" };
    try {
      await adminApi.login(email, password);

      await adminApi.me();
      setSignedIn(true);
      setIsAdmin(true);
      setSignedWallet(null);
      setAuthChainType("none");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message || "Login failed" };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!HAS_BACKEND) throw new Error("Authentication backend is not configured");
    setGoogleLoginRequested(true);
    openPrivyLogin({ loginMethods: ["google"] });
  }, [openPrivyLogin]);

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
    if (solanaWalletAccount && solanaWallet) {
      try {
        await solanaWallet.features["standard:disconnect"].disconnect();
      } catch {
        /* noop */
      }
    }
    setSolanaWalletAccount(null);
    setSolanaWallet(null);
    try {
      await privyLogout();
    } catch {
      /* no-op */
    }
    resetAuthState();
  }, [disconnectAsync, resetAuthState, isAdmin, privyLogout, solanaWallet, solanaWalletAccount]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: signedIn,
        baseUser,
        authChainType,
        solanaAddress: solanaWalletAccount?.address || null,
        solanaWallet,
        solanaWalletAccount,
        connectSolanaWallet,
        isAdmin,
        isConnecting,
        isAuthLoading,
        signInWithRobinhood,
        signInWithSolana,
        signInWithGoogle,
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
