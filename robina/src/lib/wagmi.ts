import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";
import { Attribution } from "ox/erc8021";

export const BASE_CHAIN_ID = base.id; // 8453

// ADD THESE TWO LINES BACK IN:
export const USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const USDC_DECIMALS = 6;

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ["bc_i14ihftr"],
});

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: "BaseDrop",
      preference: "all",
      version: "4",
    }),
  ],
  transports: {
    [base.id]: http("https://mainnet.base.org"),
  },
  ssr: false,
  dataSuffix: DATA_SUFFIX,
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
