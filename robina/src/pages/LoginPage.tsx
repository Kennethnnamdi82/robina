import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ArrowLeft, ArrowRight, Chrome, Droplet, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { appKit, openWalletModal } from "@/lib/wagmi";

function friendlyAuthError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  if (/user rejected|denied|cancelled|canceled/i.test(message)) {
    return "Request cancelled. You can try again whenever you're ready.";
  }
  if (/fetch|network|timeout/i.test(message)) {
    return "The authentication service is unavailable right now. Please try again shortly.";
  }
  if (/provider not found|wallet not found/i.test(message)) {
    return "No compatible wallet was found. Install or unlock a supported wallet, then try again.";
  }
  if (message === "privy_not_configured") {
    return "Google sign-in is not configured for this environment.";
  }
  return "Sign-in could not be completed. Check your wallet and try again.";
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
  const { chainId, isConnected } = useAccount();
  const navigate = useNavigate();
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [waitingForEvmWallet, setWaitingForEvmWallet] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn) navigate("/", { replace: true });
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (!waitingForEvmWallet || !isConnected || !chainId) return;
    setWaitingForEvmWallet(false);
    setLocalError(null);
    void signInWithWallet(chainId).catch((cause: unknown) => {
      setLocalError(friendlyAuthError(cause));
    });
  }, [chainId, isConnected, signInWithWallet, waitingForEvmWallet]);

  useEffect(() => {
    if (!waitingForEvmWallet) return;
    let modalWasOpened = appKit.isOpen();
    const unsubscribe = appKit.subscribeState(({ open }) => {
      if (open) {
        modalWasOpened = true;
      } else if (modalWasOpened && !isConnected) {
        setWaitingForEvmWallet(false);
      }
    });
    return unsubscribe;
  }, [isConnected, waitingForEvmWallet]);

  async function handleGoogleSignIn() {
    setWaitingForEvmWallet(false);
    setLocalError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setLocalError(friendlyAuthError(cause));
    }
  }

  async function handleSolanaSignIn() {
    setWaitingForEvmWallet(false);
    setLocalError(null);
    try {
      await signInWithSolana();
    } catch (cause) {
      setLocalError(friendlyAuthError(cause));
    }
  }

  function handleEvmWallet() {
    setLocalError(null);
    if (isConnected && chainId) {
      setWaitingForEvmWallet(false);
      void signInWithWallet(chainId).catch((cause: unknown) => {
        setLocalError(friendlyAuthError(cause));
      });
      return;
    }
    setWaitingForEvmWallet(true);
    try {
      openWalletModal();
    } catch {
      setWaitingForEvmWallet(false);
      setLocalError("The wallet selector could not be opened. Please try again.");
    }
  }

  const error = localError || authError;
  const busy = isSigningIn;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07090d] px-5 py-12 text-white">
      <section className="relative w-full max-w-[400px]">
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.045]">
            <Droplet className="h-[21px] w-[21px] text-cyan-200" strokeWidth={2} />
          </div>
          <div className="text-xs font-semibold tracking-[0.2em] text-white/55">ROBINA</div>
          <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.04em] sm:text-[32px]">
            Welcome back
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-white/50">
            Sign in to continue to your account.
          </p>
        </header>

        <div className="rounded-[20px] border border-white/[0.09] bg-[#101318] p-5 sm:p-6">
          <p className="mb-3 text-xs font-medium text-white/45">Continue with</p>
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={busy}
            className="flex min-h-[50px] w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#f6f6f7] text-sm font-semibold text-[#17181b] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-[18px] w-[18px]" />}
            Continue with Google
          </button>

          <div className="my-[18px] flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-white/[0.09]" />
            <span className="text-[11px] font-medium text-white/35">or</span>
            <span className="h-px flex-1 bg-white/[0.09]" />
          </div>

          {!walletPickerOpen ? (
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                setWalletPickerOpen(true);
              }}
              disabled={busy}
              className="group flex min-h-[50px] w-full items-center justify-center gap-3 rounded-xl border border-white/[0.13] bg-white/[0.025] text-sm font-medium text-white transition-colors hover:border-white/25 hover:bg-white/[0.055] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Wallet className="h-[18px] w-[18px] text-cyan-200" />
              Choose wallet
              <ArrowRight className="ml-auto mr-1 h-4 w-4 text-white/35 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setWalletPickerOpen(false)}
                className="mb-1 flex items-center gap-2 text-xs font-medium text-white/45 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign-in options
              </button>
              <button
                type="button"
                onClick={handleEvmWallet}
                disabled={busy}
                className="flex min-h-[58px] w-full items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.02] px-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.045] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.055] text-white/75">
                  <Wallet className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">EVM wallet</span>
                  <span className="mt-0.5 block text-xs text-white/45">
                    MetaMask, Coinbase, Phantom and more
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-white/35" />
              </button>

              <button
                type="button"
                onClick={() => void handleSolanaSignIn()}
                disabled={busy || !solanaWallet}
                className="flex min-h-[58px] w-full items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.02] px-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.045] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.055] text-white/75">
                  {isSigningIn && solanaWallet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">Phantom · Solana</span>
                  <span className="mt-0.5 block text-xs text-white/45">
                    {solanaWallet ? "Sign in with your Solana account" : "Phantom Solana wallet not detected"}
                  </span>
                </span>
                {solanaWallet && <ArrowRight className="h-4 w-4 text-white/35" />}
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.07] px-3 py-2.5 text-sm leading-5 text-rose-200/90">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-start justify-center gap-2 border-t border-white/[0.08] pt-4 text-center text-xs leading-5 text-white/40">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
            <p>Your wallet signs a one-time message. We never ask for your recovery phrase or private keys.</p>
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] text-white/30">
          Secure authentication powered by Robina
        </p>
      </section>
    </main>
  );
}
