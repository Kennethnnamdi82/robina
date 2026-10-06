import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";

interface PhantomSolanaWallet {
  name: string;
  accounts: readonly WalletAccount[];
  features: {
    "standard:connect": {
      connect(): Promise<{ accounts: readonly WalletAccount[] }>;
    };
    "standard:disconnect": {
      disconnect(): Promise<void>;
    };
    "solana:signMessage": {
      signMessage(input: {
        account: WalletAccount;
        message: Uint8Array;
      }): Promise<readonly { signature: Uint8Array }[]>;
    };
    "solana:signAndSendTransaction": {
      signAndSendTransaction(input: {
        account: WalletAccount;
        transaction: Uint8Array;
        chain: string;
        options?: {
          commitment?: "processed" | "confirmed" | "finalized";
          preflightCommitment?: "processed" | "confirmed" | "finalized";
        };
      }): Promise<readonly { signature: Uint8Array }[]>;
    };
  };
}

export type PhantomWallet = Wallet & PhantomSolanaWallet;

export function getPhantomWallet(): PhantomWallet | null {
  const wallet = getWallets().get().find((candidate) => candidate.name === "Phantom");
  if (!wallet) return null;
  const features = wallet.features;
  if (
    !("standard:connect" in features) ||
    !("standard:disconnect" in features) ||
    !("solana:signMessage" in features) ||
    !("solana:signAndSendTransaction" in features)
  ) {
    throw new Error("The installed Phantom wallet does not support required Solana wallet features.");
  }
  return wallet as PhantomWallet;
}
