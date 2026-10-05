import { defineChain, http } from "viem";
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

export const ROBINHOOD_CHAIN_ID = 4663;

const robinhoodRpcUrl =
  import.meta.env.VITE_ROBINHOOD_RPC_URL?.trim() ||
  "https://rpc.mainnet.chain.robinhood.com";

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

export const USDC_DECIMALS = 6;

export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [
    injected({
      target: {
        id: "robinhoodWallet",
        name: "Robinhood Wallet",
        provider: (window) => window?.ethereum,
      },
    }),
  ],
  transports: {
    [robinhoodChain.id]: http(robinhoodRpcUrl),
  },
  ssr: false,
});

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
