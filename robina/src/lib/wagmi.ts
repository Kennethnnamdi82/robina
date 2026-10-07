import { createAppKit } from "@reown/appkit/react";
import { base } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain, http } from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;
export const BASE_CHAIN_ID = 8453;

const robinhoodRpcUrl =
  import.meta.env.VITE_ROBINHOOD_RPC_URL?.trim() ||
  "https://rpc.mainnet.chain.robinhood.com";
const baseRpcUrl =
  import.meta.env.VITE_BASE_RPC_URL?.trim() ||
  "https://mainnet.base.org";

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [robinhoodRpcUrl] } },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});
export const supportedEvmChains = [robinhoodChain, base] as const;

export const USDC_DECIMALS = 6;

const reownProjectId = (
  import.meta.env.VITE_REOWN_PROJECT_ID || import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ""
).trim();

// AppKit owns the sole wagmi configuration. This avoids competing connector
// stores while enabling injected wallets, Coinbase, WalletConnect and Solana.
const wagmiAdapter = new WagmiAdapter({
  projectId: reownProjectId,
  networks: [...supportedEvmChains],
  transports: {
    [ROBINHOOD_CHAIN_ID]: http(robinhoodRpcUrl),
    [BASE_CHAIN_ID]: http(baseRpcUrl),
  },
});
const featuredWalletIds = (import.meta.env.VITE_REOWN_FEATURED_WALLET_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [...supportedEvmChains],
  projectId: reownProjectId,
  metadata: {
    name: "Robina",
    description: "Robina wallet authentication and checkout",
    url: window.location.origin,
    icons: [`${window.location.origin}/basedrop-logo.jpg`],
  },
  featuredWalletIds,
  coinbasePreference: "eoaOnly",
  features: { analytics: true, socials: false, email: false },
});

// Always start from the wallet directory. This keeps the login button
// predictable even when AppKit has remembered a previously connected wallet.
export const openWalletModal = () =>
  appKit.open({ view: "AllWallets", namespace: "eip155" });
export const wagmiConfig = wagmiAdapter.wagmiConfig;

export const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
