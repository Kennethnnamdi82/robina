import { useAuth } from "@/context/AuthContext";
import { Droplet, ArrowRight, Loader2, Wallet, Chrome } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BASE_CHAIN_ID, ROBINHOOD_CHAIN_ID, openWalletModal } from "@/lib/wagmi";

export default function LoginPage() {
  const { signInWithRobinhood, signInWithSolana, signInWithGoogle, isConnecting } = useAuth();
  const navigate = useNavigate();

  async function handleSignIn(chainId: number) {
    try {
      await signInWithRobinhood(chainId);

      toast.success("Welcome to BaseDrop!");

      setTimeout(() => {
        navigate("/", { replace: true });
      }, 150);
    } catch (e) {
      const error = e as Error;
      const msg = error?.message || "Sign-in failed";

      if (msg.includes("fetch") || msg.includes("Network Error")) {
        toast.error("Server is waking up. Please try again in a few seconds.");
        return;
      }

      if (!/user rejected|denied/i.test(msg)) {
        toast.error(msg);
      }
    }
  }

  async function handleGoogleSignIn() {
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.error((e as Error).message || "Google sign-in could not start");
    }
  }

  async function handleSolanaSignIn() {
    try {
      await signInWithSolana();
      toast.success("Welcome to BaseDrop!");
      setTimeout(() => navigate("/", { replace: true }), 150);
    } catch (e) {
      const message = (e as Error).message || "Solana sign-in failed";
      if (!/user rejected|denied/i.test(message)) toast.error(message);
    }
  }

  return (
    <div className="min-h-screen level-bg-beginner flex flex-col items-center justify-center px-6 animate-fade-in relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full border border-accent/10 animate-ping"
          style={{ animationDuration: "3s" }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-sm w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center neon-glow animate-float">
            <Droplet className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-accent to-primary">
            BaseDrop
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Earn BD Coins. Level up. Compete on Robinhood Chain.
          </p>
        </div>

        <button
          onClick={openWalletModal}
          className="w-full py-3 rounded-2xl border border-border bg-card text-foreground font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          <Wallet className="w-5 h-5" />
          Choose wallet
        </button>
        <button
          onClick={() => handleSignIn(ROBINHOOD_CHAIN_ID)}
          disabled={isConnecting}
          className="w-full py-4 rounded-2xl gradient-primary text-primary-foreground font-bold text-sm transition-all active:scale-95 neon-glow flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isConnecting ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Connecting...</span>
            </div>
          ) : (
            <>
              <Wallet className="w-5 h-5" />
              Sign in with Robinhood Chain
              <ArrowRight className="w-4 h-4" />
          </>
          )}
      </button>
      <button
          onClick={() => handleSignIn(BASE_CHAIN_ID)}
          disabled={isConnecting}
          className="w-full py-4 rounded-2xl border border-border bg-card text-foreground font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
      >
          <Wallet className="w-5 h-5" />
          Sign in with Base
        </button>
        <button
          onClick={handleSolanaSignIn}
          className="w-full py-4 rounded-2xl border border-border bg-card text-foreground font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          <Wallet className="w-5 h-5" />
          Sign in with Phantom (Solana)
        </button>
        <button
          onClick={handleGoogleSignIn}
          className="w-full py-4 rounded-2xl border border-border bg-card text-foreground font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          <Chrome className="w-5 h-5" />
          Continue with Google
        </button>
        <p className="text-xs text-muted-foreground text-center">
          MetaMask, Coinbase Wallet, Robinhood Wallet, and Phantom EVM work on Robinhood Chain or Base. Phantom’s Solana wallet uses the separate Solana sign-in button.
        </p>
      </div>
    </div>
  );
}
