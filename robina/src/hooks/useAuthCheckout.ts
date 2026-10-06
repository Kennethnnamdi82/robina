import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useAuth } from "@/context/AuthContext";
import { paymentsApi, type PaymentAction } from "@/services/api";
import { sendSolanaUsdc, sendUsdcOnEvm, waitForUsdcTx } from "@/services/usdc";

export type PaymentProgress =
  | "idle"
  | "preparing"
  | "connecting_wallet"
  | "switching_network"
  | "broadcasting"
  | "confirming"
  | "server_verification"
  | "success"
  | "error";

/**
 * The single frontend orchestration point for identity and checkout. Backend
 * verification is authoritative: `success` is reached only after it accepts
 * the payment intent and on-chain transaction.
 */
export function useAuthCheckout() {
  const auth = useAuth();
  const { address, chainId, isConnected } = useAccount();
  const [paymentState, setPaymentState] = useState<PaymentProgress>("idle");
  const [error, setError] = useState<string | null>(null);

  const paymentMutation = useMutation({
    mutationFn: async ({ action, targetMultiplier }: { action: PaymentAction; targetMultiplier?: number }) => {
      setError(null);
      setPaymentState("preparing");
      const { intent } = await paymentsApi.createIntent(
        action,
        targetMultiplier,
        chainId,
        auth.authChainType === "solana" ? "solana" : "evm",
      );
      if (intent.chainType === "solana") {
        if (intent.asset.type !== "spl" || !intent.asset.address) throw new Error("Solana USDC quote unavailable.");
        const { wallet, account } = await auth.connectSolanaWallet();
        if (account.address !== auth.baseUser?.wallet) {
          throw new Error("Reconnect the same Phantom Solana wallet you used to sign in.");
        }
        setPaymentState("broadcasting");
        const signature = await sendSolanaUsdc(
          wallet,
          account,
          intent.recipient,
          intent.asset.address,
          intent.amountAtomic,
        );
        setPaymentState("confirming");
        setPaymentState("server_verification");
        await paymentsApi.verifyIntent(intent.id, signature);
        setPaymentState("success");
        return signature;
      }
      if (intent.asset.type !== "erc20" || !intent.asset.address) {
        throw new Error("This checkout client does not support the requested payment asset");
      }
      if (!isConnected || !address) {
        setPaymentState("connecting_wallet");
        throw new Error("Connect an external wallet before paying");
      }
      setPaymentState("switching_network");
      setPaymentState("broadcasting");
      const transactionHash = await sendUsdcOnEvm(
        intent.recipient as `0x${string}`,
        Number(intent.amount),
        intent.asset.address as `0x${string}`,
        Number(intent.chainId),
      );
      setPaymentState("confirming");
      await waitForUsdcTx(transactionHash, Number(intent.chainId));
      setPaymentState("server_verification");
      await paymentsApi.verifyIntent(intent.id, transactionHash);
      setPaymentState("success");
      return transactionHash;
    },
    onError: (cause) => {
      setPaymentState("error");
      setError(cause instanceof Error ? cause.message : "Payment failed");
    },
  });

  const loginWithWallet = useCallback(async () => {
    setError(null);
    try {
      await auth.signInWithRobinhood();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet sign-in failed";
      setError(message);
      throw cause;
    }
  }, [auth]);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    try {
      await auth.signInWithGoogle();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Google sign-in failed";
      setError(message);
      throw cause;
    }
  }, [auth]);

  return useMemo(() => ({
    isAuthenticated: auth.isLoggedIn,
    authMethod: auth.authChainType === "solana" ? "wallet_solana" : address ? "wallet_evm" : "unknown",
    email: null as string | null,
    walletAddress: auth.authChainType === "solana" ? auth.solanaAddress || null : address || auth.baseUser?.wallet || null,
    chainType: auth.authChainType,
    chainId: chainId || null,
    backendSession: auth.isLoggedIn,
    loginWithGoogle,
    loginWithWallet,
    connectWallet: loginWithWallet,
    executePayment: paymentMutation.mutateAsync,
    logout: auth.signOut,
    paymentState,
    error,
  }), [address, auth, chainId, error, loginWithGoogle, loginWithWallet, paymentMutation.mutateAsync, paymentState]);
}
