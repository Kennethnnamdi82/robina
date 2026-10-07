import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Check, ChevronRight, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { closeWalletModal, openWalletModal } from "@/lib/wagmi";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.21-2.27H12v4.3h5.22a4.46 4.46 0 0 1-1.93 2.93v2.79h3.59c2.1-1.94 3.31-4.8 3.31-7.75Z" />
      <path fill="#34A853" d="M12 21.73c2.61 0 4.8-.86 6.4-2.34l-3.59-2.79c-1 .67-2.27 1.07-3.81 1.07-2.93 0-5.41-1.98-6.3-4.64H.99v2.88a9.67 9.67 0 0 0 8.61 5.82Z" />
      <path fill="#FBBC05" d="M4.7 13.03A5.81 5.81 0 0 1 4.35 11c0-.7.12-1.38.35-2.03V6.09H.99A9.72 9.72 0 0 0 0 11c0 1.76.42 3.42.99 4.91l3.72-2.88Z" />
      <path fill="#EA4335" d="M12 4.33c1.66 0 3.14.57 4.31 1.67l3.24-3.24C16.8.18 14.61-.73 12-.73A9.67 9.67 0 0 0 .99 6.09L4.7 8.97c.89-2.66 3.37-4.64 6.3-4.64Z" transform="translate(0 .73)" />
    </svg>
  );
}

function RobinaMark() {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_26px_rgba(194,255,56,0.18)]" aria-hidden="true">
      <span className="h-4 w-4 rotate-45 rounded-[4px] border-2 border-current" />
    </span>
  );
}

function friendlyAuthError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  const messages: Record<string, string> = {
    privy_access_token_missing: "Google sign-in did not finish. Please try again.",
    privy_token_invalid: "Google could not verify this session. Please sign in again.",
    privy_unavailable: "Google verification is temporarily unavailable. Please try again shortly.",
    privy_not_configured: "Google sign-in is not configured for this environment.",
    google_account_required: "Choose a Google account to continue.",
    nonce_expired_or_used: "That wallet sign-in request expired. Please start again.",
    invalid_message: "The wallet sign-in details did not match this site. Reload and try again.",
    message_expired: "That wallet sign-in request expired. Please start again.",
    signature_invalid: "The wallet signature was not accepted. Please sign the new request.",
    invalid_wallet: "The connected wallet address could not be verified.",
    untrusted_origin: "This site is not authorized for sign-in. Use the official app URL.",
  };
  if (messages[message]) return messages[message];
  if (/user rejected|denied|cancelled|canceled/i.test(message)) return "Request cancelled. You can try again whenever you are ready.";
  if (/install or enable the phantom|phantom.*not.*(detect|provide)/i.test(message)) return "Phantom was not detected. Install or unlock Phantom, then try again.";
  if (/provider not found|wallet not found|connect an evm/i.test(message)) return "No compatible wallet was found. Install or unlock a supported wallet, then try again.";
  if (/fetch|network|timeout|http_5\d\d|status\s*5\d\d/i.test(message)) return "The sign-in service is unavailable right now. Please try again shortly.";
  return "Sign-in could not be completed. Check your connection and try again.";
}

export default function LoginPage() {
  const {
    authError,
    isLoggedIn,
    isSigningIn,
    activeLoginMethod,
    signInWithGoogle,
    signInWithWallet,
  } = useAuth();
  const { address, chainId, isConnected } = useAccount();
  const navigate = useNavigate();
  const [localError, setLocalError] = useState<string | null>(null);
  const pendingEvmAuthentication = useRef(false);
  const signingConnectedWallet = useRef(false);

  useEffect(() => {
    if (isLoggedIn) navigate("/", { replace: true });
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (!pendingEvmAuthentication.current || signingConnectedWallet.current || !isConnected || !address || !chainId) return;

    pendingEvmAuthentication.current = false;
    signingConnectedWallet.current = true;
    void (async () => {
      setLocalError(null);
      // AppKit switches to its account-management screen after connecting.
      // Close it immediately and continue with the login signature instead.
      void closeWalletModal();
      try {
        await signInWithWallet(address, chainId);
      } catch (cause) {
        setLocalError(friendlyAuthError(cause));
      } finally {
        signingConnectedWallet.current = false;
      }
    })();
  }, [address, chainId, isConnected, signInWithWallet]);

  async function handleGoogleSignIn() {
    setLocalError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setLocalError(friendlyAuthError(cause));
    }
  }

  async function handleEvmSignIn() {
    setLocalError(null);
    try {
      pendingEvmAuthentication.current = true;
      await openWalletModal();
    } catch (cause) {
      pendingEvmAuthentication.current = false;
      setLocalError(friendlyAuthError(cause));
    }
  }

  const error = localError || authError;
  const busy = isSigningIn && activeLoginMethod !== null;
  const googlePending = busy && activeLoginMethod === "google";
  const walletPending = busy && activeLoginMethod === "wallet";

  return (
    <main
      className="user-experience relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 py-10 text-foreground"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-[-18rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute -left-32 bottom-[-16rem] h-[34rem] w-[34rem] rounded-full bg-primary/5 blur-[130px]" />
        <div className="absolute right-[-15rem] top-1/3 h-[28rem] w-[28rem] rounded-full bg-lime-300/5 blur-[130px]" />
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      <section className="relative w-full max-w-[390px]">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-white">
          <RobinaMark />
          <span className="text-lg font-semibold tracking-[-0.03em]">Robina</span>
        </div>

        <div
          className="rounded-3xl border border-border/90 bg-card/95 p-5 shadow-[0_32px_90px_rgba(0,0,0,0.58)] backdrop-blur-xl sm:p-6"
        >
          <header className="text-center">
            <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Welcome back</span>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Sign in to Robina</h1>
            <p className="mt-2 text-sm leading-5 text-slate-400">Choose a secure way to continue.</p>
          </header>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={busy}
              className="mx-auto flex h-12 w-full max-w-[280px] items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white px-4 text-sm font-semibold text-slate-800 shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:bg-lime-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {googlePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              {googlePending ? "Connecting to Google..." : "Continue with Google"}
            </button>
          </div>

          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-semibold tracking-[0.14em] text-slate-500">OR</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div>
            <p className="mb-3 text-center text-xs font-medium text-slate-400">Or continue with your wallet</p>
            <div>
              <button
                type="button"
                onClick={() => void handleEvmSignIn()}
                disabled={busy}
                className="group flex min-h-[92px] w-full items-center gap-4 rounded-2xl border border-border bg-white/[0.035] p-4 text-left text-slate-100 transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/[0.06] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15"><Wallet className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{isConnected ? "Choose another wallet" : "Connect a wallet"}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">{walletPending ? "Waiting for signature..." : "MetaMask, Coinbase Wallet, WalletConnect, and more"}</span>
                </span>
                {walletPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" /> : <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-center text-xs leading-5 text-rose-700">
              {error}
            </p>
          )}

          <p className="mt-6 flex items-start gap-2 border-t border-white/10 pt-4 text-[11px] leading-5 text-slate-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Robina never asks for your recovery phrase, password, or private keys.
          </p>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
          <Check className="h-3.5 w-3.5 text-primary" /> Secure, non-custodial sign-in
        </p>
      </section>
    </main>
  );
}
