import { useEffect, useRef, useState } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';
import { sendSolanaUsdc, sendUsdcOnEvm, waitForUsdcTx } from '@/services/usdc';
import { paymentsApi, type PaymentAction, type ApiError } from '@/services/api';
import { HAS_BACKEND } from '@/lib/backend';
import { useAuth } from "@/context/AuthContext";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  amount: number;
  recipient?: `0x${string}`;
  action?: PaymentAction;
  onConfirm: (txHash?: string) => void | Promise<void>;
}

const VERIFY_MAX_ATTEMPTS = 18;
const VERIFY_RETRY_MS = 4000;
const AUTH_ERRORS = new Set(["unauthenticated", "invalid_token", "token_revoked"]);

export default function USDCPaymentModal({
  open,
  onClose,
  title,
  amount,
  recipient,
  action,
  onConfirm,
}: Props) {
  const [status, setStatus] = useState<'confirm' | 'processing' | 'done' | 'error'>('confirm');
  const [errorMsg, setErrorMsg] = useState('');
  const [displayAmount, setDisplayAmount] = useState(amount);
  const cancelledRef = useRef(false);
  const { isConnected, chainId } = useAccount();
  const {
    authChainType,
    baseUser,
    connectSolanaWallet,
  } = useAuth();

  useEffect(() => {
    setDisplayAmount(amount);
  }, [amount, open]);

  if (!open) return null;

  async function handleConfirm() {
    setErrorMsg('');
    setStatus('processing');
    cancelledRef.current = false;

    try {
      let to: `0x${string}` | undefined = recipient;
      let quotedAmount = amount;
      let quotedUsdcContract: `0x${string}` | undefined;
      let paymentIntentId: string | undefined;
      let paymentIntent: Awaited<ReturnType<typeof paymentsApi.createIntent>>["intent"] | null = null;

      if (action) {
        try {
          const chainType = authChainType === "solana" ? "solana" : "evm";
          const { intent } = await paymentsApi.createIntent(action, undefined, chainId, chainType);
          paymentIntent = intent;
          paymentIntentId = intent.id;
          to = intent.recipient as `0x${string}`;
          quotedAmount = Number(intent.amount);
          quotedUsdcContract = intent.asset.address as `0x${string}`;
          setDisplayAmount(quotedAmount);
        } catch (e) {
          const code = String((e as Error)?.message || "");
          if (
            code === "unauthenticated" ||
            code === "invalid_token" ||
            code === "token_revoked"
          ) {
            throw new Error("Session expired. Please sign in again.");
          }
          throw new Error("Payment quote unavailable. Please refresh and try again.");
        }
      }

      if (paymentIntent?.chainType === "solana") {
        const { wallet, account } = await connectSolanaWallet();
        if (account.address !== baseUser?.wallet) {
          throw new Error("Reconnect the same Phantom Solana wallet you used to sign in.");
        }
        const signature = await sendSolanaUsdc(
          wallet,
          account,
          paymentIntent.recipient,
          paymentIntent.asset.address || "",
          paymentIntent.amountAtomic,
        );
        toast.message("Transaction submitted", {
          description: `${signature.slice(0, 10)}...`,
        });
        let verified = false;
        let lastErr: ApiError | null = null;
        for (let attempt = 1; attempt <= VERIFY_MAX_ATTEMPTS; attempt += 1) {
          if (cancelledRef.current) return;
          try {
            await paymentsApi.verifyIntent(paymentIntent.id, signature);
            verified = true;
            break;
          } catch (e) {
            const err = e as ApiError;
            lastErr = err;
            const code = String(err.message || "");
            const retryable =
              code === "confirmations_pending" ||
              code === "verification_in_progress" ||
              code === "transaction_not_found" ||
              code === "tx_not_found_yet";
            if (!retryable || attempt === VERIFY_MAX_ATTEMPTS) break;
            await new Promise((resolve) => setTimeout(resolve, VERIFY_RETRY_MS));
          }
        }
        if (!verified) throw lastErr || new Error("payment_verification_failed");
        setStatus("done");
        await onConfirm(signature);
        toast.success("Payment successful");
        setTimeout(() => {
          setStatus("confirm");
          onClose();
        }, 1400);
        return;
      }

      if (!quotedUsdcContract || !/^0x[0-9a-fA-F]{40}$/.test(quotedUsdcContract)) {
        throw new Error("Payment token address unavailable from the backend");
      }
      if (!to) {
        throw new Error('Payment recipient unavailable');
      }
      if (!isConnected) {
        throw new Error('Connect your Robinhood Wallet first');
      }

      const paymentChainId = Number(paymentIntent?.chainId || chainId || 4663);
      const hash = await sendUsdcOnEvm(to, quotedAmount, quotedUsdcContract, paymentChainId);
      toast.message('Transaction submitted', {
        description: `${hash.slice(0, 10)}...`,
      });

      await waitForUsdcTx(hash, paymentChainId);
      if (cancelledRef.current) return;

      if (HAS_BACKEND && action) {
        let verified = false;
        let lastErr: ApiError | null = null;
        for (let attempt = 1; attempt <= VERIFY_MAX_ATTEMPTS; attempt += 1) {
          if (cancelledRef.current) return;
          try {
            if (!paymentIntentId) throw new Error("Payment intent unavailable");
            await paymentsApi.verifyIntent(paymentIntentId, hash);
            verified = true;
            break;
          } catch (e) {
            const err = e as ApiError;
            lastErr = err;
            const code = String(err.message || "");
            const retryable =
              code === "confirmations_pending" ||
              code === "verification_in_progress" ||
              code === "tx_not_found_yet";
            if (!retryable || attempt === VERIFY_MAX_ATTEMPTS) break;
            toast.message(
              `Confirming payment on-chain (${attempt}/${VERIFY_MAX_ATTEMPTS})...`,
            );
            await new Promise((resolve) => setTimeout(resolve, VERIFY_RETRY_MS));
          }
        }
        if (!verified) {
          throw lastErr || new Error("payment_verification_failed");
        }
        if (cancelledRef.current) return;
      }

      setStatus('done');
      await onConfirm(hash);
      toast.success('Payment successful');
      setTimeout(() => {
        setStatus('confirm');
        onClose();
      }, 1400);
    } catch (e) {
      const rawMsg = (e as Error)?.message || "Transaction failed";
      const msg = AUTH_ERRORS.has(rawMsg)
        ? "Session expired. Please sign in again."
        : rawMsg;
      setErrorMsg(msg);
      setStatus('error');
      if (!/user rejected|denied/i.test(msg)) {
        if (rawMsg === 'confirmations_pending' || rawMsg === 'verification_in_progress') {
          toast.error('Payment sent, but confirmation timed out. Please retry verification in a moment.');
        } else {
          toast.error(msg);
        }
      }
    }
  }

  function handleCancel() {
    cancelledRef.current = true;
    setStatus('confirm');
    setErrorMsg('');
    setDisplayAmount(amount);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-lg glass-card rounded-t-3xl p-6 pb-10 animate-slide-up space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={handleCancel} className="p-1 rounded-lg hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-accent to-primary">
            ${displayAmount} USDC
          </p>
        </div>

        <div className="glass-card rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted-foreground">
          Payment is sent from your connected wallet and independently verified on-chain.
          </p>
          <p className="text-[10px] text-muted-foreground">
          Network: {authChainType === "solana" ? "Solana Mainnet (Phantom)" : chainId === 8453 ? "Base" : "Robinhood Chain"}
          </p>
        </div>

        {status === 'done' ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle className="w-12 h-12 text-green-400 animate-count-up" />
            <p className="text-sm font-bold text-green-400">Transaction Successful</p>
          </div>
        ) : status === 'error' ? (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 py-2">
              <AlertTriangle className="w-10 h-10 text-destructive" />
              <p className="text-sm font-bold text-destructive text-center">Transaction failed</p>
              {errorMsg && (
                <p className="text-[11px] text-muted-foreground text-center break-words">
                  {errorMsg}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setStatus('confirm');
                setErrorMsg('');
              }}
              className="w-full py-3 rounded-2xl gradient-primary text-primary-foreground font-bold text-sm transition-all active:scale-95"
            >
              Try again
            </button>
            <button
              onClick={handleCancel}
              className="w-full py-3 rounded-2xl border border-border text-muted-foreground text-sm font-medium hover:bg-secondary/50"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleConfirm}
              disabled={status === 'processing'}
              className="w-full py-4 rounded-2xl font-bold text-sm gradient-primary text-primary-foreground transition-all active:scale-95 disabled:opacity-70 neon-glow"
            >
              {status === 'processing' ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </div>
              ) : (
                'Confirm Payment'
              )}
            </button>

            <button
              onClick={handleCancel}
              className="w-full py-3 rounded-2xl border border-border text-muted-foreground text-sm font-medium hover:bg-secondary/50 transition-all active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
