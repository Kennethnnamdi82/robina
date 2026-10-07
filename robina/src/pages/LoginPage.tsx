import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Check, ChevronRight, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { openWalletModal } from "@/lib/wagmi";

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
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#172b3a] ring-1 ring-white/10" aria-hidden="true">
      <span className="h-4 w-4 rotate-45 rounded-[4px] border-2 border-cyan-200" />
    </span>
  );
}

function PhantomMark() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ab9ff2]" aria-hidden="true">
      <span className="flex gap-0.5">
        <i className="h-3 w-1 rotate-[28deg] rounded-full bg-[#22203f]" />
        <i className="h-3 w-1 rotate-[28deg] rounded-full bg-[#22203f]" />
        <i className="h-3 w-1 rotate-[28deg] rounded-full bg-[#22203f]" />
      </span>
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
    signInWithGoogle,
    signInWithSolana,
    signInWithWallet,
    solanaWallet,
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

  async function handleSolanaSignIn() {
    setLocalError(null);
    try {
      await signInWithSolana();
    } catch (cause) {
      setLocalError(friendlyAuthError(cause));
    }
  }

  async function handleEvmSignIn() {
    setLocalError(null);
    if (isConnected && address && chainId) {
      try {
        await signInWithWallet(address, chainId);
      } catch (cause) {
        setLocalError(friendlyAuthError(cause));
      }
      return;
    }

    try {
      pendingEvmAuthentication.current = true;
      openWalletModal();
    } catch (cause) {
      pendingEvmAuthentication.current = false;
      setLocalError(friendlyAuthError(cause));
    }
  }

  const error = localError || authError;
  const busy = isSigningIn;

  return (
    <main
      className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-10"
      style={{ background: "#0a1822", color: "#f8fafc" }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-cyan-400/15 blur-[110px]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(46,133,168,0.22),transparent_68%)]" />
      </div>

      <section className="relative w-full max-w-[390px]">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-white">
          <RobinaMark />
          <span className="text-lg font-semibold tracking-[-0.03em]">Robina</span>
        </div>

        <div
          className="rounded-2xl p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)] sm:p-6"
          style={{ backgroundColor: "#f9fbfc", color: "#233746" }}
        >
          <header className="text-center">
            <h1 className="text-2xl font-semibold tracking-[-0.04em]" style={{ color: "#132635" }}>Sign in to Robina</h1>
            <p className="mt-2 text-sm leading-5" style={{ color: "#64748b" }}>Choose how you would like to continue.</p>
          </header>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={busy}
              className="mx-auto flex h-12 w-full max-w-[280px] items-center justify-center gap-2.5 rounded-lg px-4 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", color: "#263746" }}
            >
              {isSigningIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              Sign in with Google
            </button>
          </div>

          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1" style={{ backgroundColor: "#dbe3ea" }} />
            <span className="text-[10px] font-semibold tracking-[0.14em]" style={{ color: "#94a3b8" }}>OR</span>
            <span className="h-px flex-1" style={{ backgroundColor: "#dbe3ea" }} />
          </div>

          <div>
            <p className="mb-3 text-center text-xs font-medium" style={{ color: "#64748b" }}>Sign in with a wallet</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void handleEvmSignIn()}
                disabled={busy}
                className="group min-h-[118px] rounded-xl p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", color: "#233746" }}
              >
                <span className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: "#e7f7fa", color: "#1f8ba1" }}><Wallet className="h-[18px] w-[18px]" /></span>
                  {isSigningIn ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-700" />}
                </span>
                <span className="mt-4 block text-sm font-semibold">{isConnected ? "Connected wallet" : "EVM wallet"}</span>
                <span className="mt-1 block text-[11px] leading-4" style={{ color: "#64748b" }}>MetaMask and more</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSolanaSignIn()}
                disabled={busy}
                className="group min-h-[118px] rounded-xl p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", color: "#233746" }}
              >
                <span className="flex items-center justify-between">
                  <PhantomMark />
                  {isSigningIn ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-700" />}
                </span>
                <span className="mt-4 block text-sm font-semibold">Phantom</span>
                <span className="mt-1 block text-[11px] leading-4" style={{ color: "#64748b" }}>{solanaWallet ? "Solana wallet" : "Connect Solana"}</span>
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-center text-xs leading-5 text-rose-700">
              {error}
            </p>
          )}

          <p className="mt-6 flex items-start gap-2 pt-4 text-[11px] leading-5" style={{ borderTop: "1px solid #dbe3ea", color: "#475569" }}>
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#319db2]" />
            Robina never asks for your recovery phrase, password, or private keys.
          </p>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-300">
          <Check className="h-3.5 w-3.5 text-cyan-200" /> Secure, non-custodial sign-in
        </p>
      </section>
    </main>
  );
}
