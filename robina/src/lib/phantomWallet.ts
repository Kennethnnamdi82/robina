import bs58 from "bs58";
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
    "solana:signAndSendTransaction"?: {
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

type LegacyPhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toBase58(): string };
  connect(): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, display?: "utf8"): Promise<{ signature: Uint8Array }>;
};

function legacyAccount(address: string): WalletAccount {
  const publicKey = bs58.decode(address);
  if (publicKey.length !== 32) throw new Error('Phantom returned an invalid Solana public key.');
  return { address, publicKey, chains: ['solana:mainnet'], features: ['solana:signMessage'] };
}
function getLegacyPhantomWallet(): PhantomWallet | null {
  if (typeof window === "undefined") return null;
  const provider = (window as Window & {
    phantom?: { solana?: LegacyPhantomProvider };
  }).phantom?.solana;
  if (!provider?.isPhantom) return null;

  const accountForProvider = (connected: { publicKey?: { toBase58(): string } }) => {
    const address = connected.publicKey?.toBase58() || provider.publicKey?.toBase58();
    if (!address) throw new Error("Phantom did not provide a Solana account.");
    return legacyAccount(address);
  };

  return {
    version: "1.0.0",
    name: "Phantom",
    icon: "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E",
    get accounts() { return provider.publicKey ? [legacyAccount(provider.publicKey.toBase58())] : []; },
    chains: ["solana:mainnet"],
    features: {
      "standard:connect": {
        connect: async () => ({ accounts: [accountForProvider(await provider.connect())] }),
      },
      "standard:disconnect": {
        disconnect: () => provider.disconnect(),
      },
      "solana:signMessage": {
        signMessage: async ({ message }) => {
          const signed = await provider.signMessage(message, "utf8");
          return [{ signature: new Uint8Array(signed.signature) }];
        },
      },
    },
  } as unknown as PhantomWallet;
}

export function getPhantomWallet(): PhantomWallet | null {
  const wallet = getWallets().get().find((candidate) => candidate.name === "Phantom");
  if (!wallet) return getLegacyPhantomWallet();
  const features = wallet.features;
  if (
    !("standard:connect" in features) ||
    !("standard:disconnect" in features) ||
    !("solana:signMessage" in features)
  ) {
    throw new Error("The installed Phantom wallet does not support Solana message signing. Update Phantom and try again.");
  }
  return wallet as PhantomWallet;
}
