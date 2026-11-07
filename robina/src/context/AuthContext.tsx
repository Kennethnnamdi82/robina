// --- context/AuthContext.tsx ---
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { getWallets } from "@wallet-standard/app";
import type { WalletAccount } from "@wallet-standard/base";
import bs58 from "bs58";
import {
  adminApi,
  authApi,
  type ApiError,
} from "@/services/api";
import { buildAndSignSiwe } from "@/lib/siwe";
import { getAccessTokenAfterLogin } from "@/lib/privyAuth";
import { HAS_BACKEND } from "@/lib/backend";
import { getPhantomWallet, type PhantomWallet } from "@/lib/phantomWallet";
import { googleAttemptPending,beginGoogleAttempt,clearGoogleAttempt,verifyGoogleSession } from '@/lib/googleAttempt';

interface BaseUser {
  name: string;
  avatar: string;
  wallet: string;
  role?: string;
  completedTasks?: string[];
}

type LoginMethod = "google" | "wallet" | "solana" | null;

interface AuthContextType {
  isLoggedIn: boolean;
  baseUser: BaseUser | null;
  authChainType: "evm" | "solana" | "none";
  isAdmin: boolean;
  isConnecting: boolean;
  isSigningIn: boolean;
  activeLoginMethod: LoginMethod;
  authError: string | null;
  isAuthLoading: boolean;
  signInWithWallet: (walletAddress?: `0x${string}`, chainId?: number) => Promise<void>;
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
  const { getAccessToken, logout: privyLogout,ready:privyReady,authenticated:privyAuthenticated } = usePrivy();
  const epoch=useRef(0),googleFlight=useRef<Promise<void>|null>(null),googleIntent=useRef(googleAttemptPending()),signedInRef=useRef(false);
  const { address, chainId, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const [signedIn, setSignedIn] = useState(false);
  const [signedWallet, setSignedWallet] = useState<string | null>(null);
  const [solanaWallet, setSolanaWallet] = useState<PhantomWallet | null>(null);
  const [solanaWalletAccount, setSolanaWalletAccount] = useState<WalletAccount | null>(null);
  const [authChainType, setAuthChainType] = useState<"evm" | "solana" | "none">("none");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(HAS_BACKEND);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeLoginMethod, setActiveLoginMethod] = useState<LoginMethod>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(()=>{signedInRef.current=signedIn;if(signedIn)try{localStorage.setItem('rivals_session_seen','1');}catch{/* Non-secret hint only; never required for authentication. */}},[signedIn]);

  const resetAuthState = useCallback(() => {
    try{localStorage.removeItem('rivals_session_seen');}catch{/* Private browsing. */}
    setSignedIn(false);
    setSignedWallet(null);
    setAuthChainType("none");
    setIsAdmin(false);
    setAuthError(null);
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
    const controller = new AbortController();
    const hydrationEpoch=epoch.current;
    let knownSession=false;try{knownSession=localStorage.getItem('rivals_session_seen')==='1';}catch{/* Storage optional. */}
    const sessionDeadline = Date.now() + (knownSession?65000:4000);
    const sessionOptions = () => ({ signal: controller.signal, timeoutMs: Math.max(1, sessionDeadline - Date.now()), retries: 0 });
    const restoreUserSession=async()=>{
      for(let attempt=0;;attempt++){
        try{return await authApi.me(sessionOptions());}catch(error){
          const status=(error as ApiError).status;
          if(!knownSession||attempt>=2||controller.signal.aborted||Date.now()+1500>=sessionDeadline||![undefined,502,503,504].includes(status))throw error;
          await new Promise<void>((resolve,reject)=>{
            const abort=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);reject(new DOMException('Request cancelled','AbortError'));};
            const timer=window.setTimeout(()=>{controller.signal.removeEventListener('abort',abort);resolve();},750*(attempt+1));
            controller.signal.addEventListener('abort',abort,{once:true});if(controller.signal.aborted)abort();
          });
        }
      }
    };

    const hydrateSession = async () => {
      const onAdminRoute = window.location.pathname
        .toLowerCase()
        .startsWith("/admin");

      try {
        if (onAdminRoute) {
          try {
            await adminApi.me(sessionOptions());
            if (!cancelled&&hydrationEpoch===epoch.current) {
              setSignedIn(true);
              setIsAdmin(true);
              setSignedWallet(null);
              setAuthChainType("none");
              googleIntent.current=false;clearGoogleAttempt();
            }
            return;
          } catch (error) {
            if ((error as ApiError).status !== 401) throw error;
            const { user } = await restoreUserSession();
            if (!cancelled&&hydrationEpoch===epoch.current) {
              setSignedWallet(user.wallet);
              setAuthChainType(user.chainType || "none");
              setSignedIn(true);
              setIsAdmin(false);
              googleIntent.current=false;clearGoogleAttempt();
            }
          }
          return;
        }

        const { user } = await restoreUserSession();
        if (!cancelled&&hydrationEpoch===epoch.current) {
          setSignedWallet(user.wallet);
          setAuthChainType(user.chainType || "none");
          setSignedIn(true);
          setIsAdmin(false);
          googleIntent.current=false;clearGoogleAttempt();
        }
      } catch (e) {
        const err = e as ApiError;
        if (!cancelled && hydrationEpoch===epoch.current&&!googleIntent.current&&!googleAttemptPending()&&err?.status === 401) resetAuthState();
      } finally {
        if (!cancelled&&hydrationEpoch===epoch.current&&!googleIntent.current&&!googleAttemptPending()) setIsAuthLoading(false);
      }
    };

    hydrateSession();
    return () => {
      cancelled = true; controller.abort();
    };
  }, [resetAuthState]);

  const completeGoogleLogin = useCallback(async () => {
    if(googleFlight.current)return googleFlight.current;
    if(!googleIntent.current&&!googleAttemptPending())return;
    const ticket=++epoch.current;
    setIsSigningIn(true);
    setActiveLoginMethod("google");
    setIsAuthLoading(true);
    setAuthError(null);
    const flight=(async()=>{try {
      const result=await verifyGoogleSession(async()=>{
        const accessToken=await getAccessTokenAfterLogin(getAccessToken,undefined,24);
        if(!accessToken)throw new Error('privy_access_token_missing');
        let referralCode:string|undefined;try{referralCode=localStorage.getItem('basedrop_ref')||undefined;}catch{/* Optional referral. */}
        return authApi.google(accessToken,referralCode);
      },()=>authApi.me({timeoutMs:8000,retries:0}));
      if(ticket!==epoch.current)return;
      try{localStorage.removeItem('basedrop_ref');}catch{/* Login must not depend on storage. */}
      signedInRef.current=true;setSignedWallet(result.user.wallet);setAuthChainType(result.user.chainType||'none');setIsAdmin(false);setSignedIn(true);setAuthError(null);
    } catch (cause) {
      if(ticket!==epoch.current||signedInRef.current)return;
      const code=cause instanceof Error?cause.message:'';
      const messages: Record<string, string> = {
        privy_access_token_missing: "Google sign-in was interrupted before verification. Please try again.",
        privy_token_invalid: "Google could not verify this sign-in session. Please start a fresh sign-in. If this keeps happening, contact support.",
        google_account_required: "Continue with a Google account to sign in.",
        privy_not_configured: "Google sign-in is temporarily unavailable.",
        privy_unavailable: "Google sign-in is temporarily unavailable. Please try again shortly.",
      };
      setAuthError(messages[code] || "Google sign-in could not be completed. Please try again.");
    } finally {
      if(ticket===epoch.current){googleIntent.current=false;clearGoogleAttempt();setIsSigningIn(false);setActiveLoginMethod(null);setIsAuthLoading(false);}
      googleFlight.current=null;
    }})();googleFlight.current=flight;return flight;
  }, [getAccessToken]);

  useEffect(()=>{if(privyReady&&privyAuthenticated&&(googleIntent.current||googleAttemptPending()))void completeGoogleLogin();},[privyReady,privyAuthenticated,completeGoogleLogin]);
  useEffect(()=>{if(!googleIntent.current&&!googleAttemptPending())return;const timer=window.setTimeout(()=>{if(googleFlight.current||signedInRef.current)return;googleIntent.current=false;clearGoogleAttempt();setIsAuthLoading(false);setIsSigningIn(false);setAuthError('Google did not return a verified sign-in. Please try again.');},20000);return()=>clearTimeout(timer);},[]);

  const { initOAuth } = useLoginWithOAuth({
    onComplete: () => {
      void completeGoogleLogin();
    },
    onError: () => {if(googleFlight.current||signedInRef.current)return;void (async()=>{try{const result=await authApi.me({timeoutMs:5000,retries:0});if(signedInRef.current)return;epoch.current++;signedInRef.current=true;setSignedWallet(result.user.wallet);setAuthChainType(result.user.chainType||'none');setIsAdmin(false);setSignedIn(true);setAuthError(null);}catch{if(!signedInRef.current&&!googleFlight.current)setAuthError('Google sign-in was cancelled or could not be verified. You can try again.');}finally{if(!googleFlight.current){googleIntent.current=false;clearGoogleAttempt();setIsSigningIn(false);setActiveLoginMethod(null);setIsAuthLoading(false);}}})();},
  });

  const baseUser: BaseUser | null = useMemo(() => {
    if (isAdmin)
      return {
        name: "Admin",
        avatar: avatarFor("admin"),
        wallet: "0x0000000000000000000000000000000000000000",
        role: "admin",
        completedTasks: [],
      };

    if (!signedIn || !signedWallet) return null;
    const wallet = signedWallet;
    return wallet
      ? {
          name: shortName(wallet),
          role: "user",
          completedTasks: [],
          avatar: avatarFor(wallet),
          wallet,
        }
      : null;
  }, [signedWallet, isAdmin, signedIn]);

  const signInWithWallet = useCallback(async (
    connectedWalletAddress?: `0x${string}`,
    connectedChainId?: number,
  ) => {
    setIsSigningIn(true);
    setActiveLoginMethod("wallet");
    setAuthError(null);
    try {
      if (!HAS_BACKEND) throw new Error("Authentication backend is not configured");
      const wallet = connectedWalletAddress || address;
      const network = connectedChainId || chainId;
      if ((!connectedWalletAddress && !isConnected) || !wallet || !network || !Number.isSafeInteger(network) || network <= 0) {
        throw new Error("Connect an EVM wallet on a valid network before signing in.");
      }
      const { nonce, domain, uri, expiresAt } = await authApi.nonce(wallet.toLowerCase(), {
        chainType: "evm",
        chainId: network,
      });
      const { message, signature } = await buildAndSignSiwe(
        wallet,
        nonce,
        network,
        domain,
        uri,
        expiresAt,
      );
      const referralCode = localStorage.getItem("basedrop_ref") || undefined;
      const result = await authApi.verify(message, signature, referralCode);
      localStorage.removeItem("basedrop_ref");
      setIsAdmin(false);
      setSignedWallet(result.user.wallet);
      setAuthChainType("evm");
      setSignedIn(true);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      const messages: Record<string, string> = {
        nonce_expired_or_used: "This sign-in request expired. Please choose your wallet and try again.",
        signature_invalid: "The wallet signature could not be verified. Please try again.",
        invalid_message: "Wallet sign-in details did not match this site. Please reload and try again.",
      };
      if (messages[code]) setAuthError(messages[code]);
      throw cause;
    } finally {
      setIsSigningIn(false);
      setActiveLoginMethod(null);
    }
  }, [address, chainId, isConnected]);

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
    setIsSigningIn(true);
    setActiveLoginMethod("solana");
    setAuthError(null);
    try {
      if (!HAS_BACKEND) throw new Error("Authentication backend is not configured");
      const { wallet, account } = await connectSolanaWallet();
      const solanaAddress = account.address;
      const { nonce, expiresAt, domain, uri } = await authApi.nonce(solanaAddress, { chainType: "solana" });
      const issuedAt = new Date().toISOString();
      const message = [
        `${domain} wants you to sign in with your Solana account:`,
        solanaAddress,
        "",
        "Sign in to Robina.",
        "",
        `URI: ${uri}`,
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
      if (!signedMessage?.signature) throw new Error("signature_invalid");
      const ref = localStorage.getItem("basedrop_ref") || undefined;
      const result = await authApi.wallet({
        message,
        signature: bs58.encode(signedMessage.signature),
        address: solanaAddress,
        chainType: "solana",
        ref,
      });
      localStorage.removeItem("basedrop_ref");
      setIsAdmin(false);
      setSignedWallet(result.user.wallet);
      setAuthChainType("solana");
      setSignedIn(true);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      const messages: Record<string, string> = {
        nonce_expired_or_used: "This sign-in request expired. Please try again.",
        signature_invalid: "The wallet signature could not be verified. Please try again.",
        invalid_wallet: "The connected wallet could not be verified.",
      };
      if (messages[code]) setAuthError(messages[code]);
      throw cause;
    } finally {
      setIsSigningIn(false);
      setActiveLoginMethod(null);
    }
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
    if(googleFlight.current||googleIntent.current||signedInRef.current)return;
    if (!HAS_BACKEND) throw new Error("Authentication backend is not configured");
    if (!import.meta.env.VITE_PRIVY_APP_ID?.trim()) {
      throw new Error("privy_not_configured");
    }
    // This sends the user directly to Google's OAuth page instead of first
    // opening a Privy method-picker. The marker survives the OAuth redirect.
    beginGoogleAttempt();googleIntent.current=true;epoch.current++;
    setIsSigningIn(true);
    setActiveLoginMethod("google");
    setAuthError(null);
    try {
      await initOAuth({ provider: "google" });
    } catch (cause) {
      if(googleFlight.current||signedInRef.current)return;
      googleIntent.current=false;clearGoogleAttempt();
      setIsSigningIn(false);
      setActiveLoginMethod(null);
      throw cause;
    }
  }, [initOAuth]);

  const signOut = useCallback(async () => {
    epoch.current++;googleIntent.current=false;clearGoogleAttempt();signedInRef.current=false;
    if (HAS_BACKEND) {
      if (isAdmin) await adminApi.logout();
      else await authApi.logout();
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
    setIsAuthLoading(false);setIsSigningIn(false);setActiveLoginMethod(null);
  }, [disconnectAsync, resetAuthState, isAdmin, privyLogout, solanaWallet, solanaWalletAccount]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: signedIn,
        baseUser,
        authChainType,
        authError,
        solanaAddress: solanaWalletAccount?.address || null,
        solanaWallet,
        solanaWalletAccount,
        connectSolanaWallet,
        isAdmin,
        isConnecting: isSigningIn,
        isSigningIn,
        activeLoginMethod,
        isAuthLoading,
        signInWithWallet,
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
