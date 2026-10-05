import { useAuth } from "@/context/AuthContext";
import { Droplet, ArrowRight, Loader2, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function LoginPage() {
  const { signInWithRobinhood, isConnecting } = useAuth();
  const navigate = useNavigate();

  async function handleSignIn() {
    try {
      await signInWithRobinhood();

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
          onClick={handleSignIn}
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
              Connect Robinhood Wallet
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
        <p className="text-xs text-muted-foreground text-center">
          Open this page in Robinhood Wallet to connect and sign in.
        </p>
      </div>
    </div>
  );
}
