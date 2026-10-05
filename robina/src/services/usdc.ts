import { parseUnits } from "viem";
import {
  writeContract,
  waitForTransactionReceipt,
  switchChain,
  getChainId,
  getAccount,
  simulateContract,
} from "wagmi/actions";
import {
  wagmiConfig,
  USDC_DECIMALS,
  ROBINHOOD_CHAIN_ID,
  erc20Abi,
} from "@/lib/wagmi";

type SimulationLikeError = {
  message?: string;
  shortMessage?: string;
};

/**
 * Send a USDC transfer on Robinhood Chain from the connected wallet.
 * Validates the transaction via simulation before prompting the wallet.
 */
export async function sendUsdcOnRobinhood(
  to: `0x${string}`,
  amountUsdc: number,
  usdcAddress: `0x${string}`,
): Promise<`0x${string}`> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(usdcAddress)) {
    throw new Error("Payment token address was not provided by the backend");
  }

  const account = getAccount(wagmiConfig);

  // 1. Connection Check
  if (!account.address) {
    throw new Error("Wallet not connected. Please connect your wallet.");
  }

  // 2. Network Check
  const currentChain = getChainId(wagmiConfig);
  if (currentChain !== ROBINHOOD_CHAIN_ID) {
    try {
      await switchChain(wagmiConfig, { chainId: ROBINHOOD_CHAIN_ID });
    } catch {
      throw new Error("Please switch your wallet network to Robinhood Chain.");
    }
  }

  const value = parseUnits(amountUsdc.toString(), USDC_DECIMALS);

  try {
    // 3. ✅ THE SIMULATION STEP
    // This pre-runs the transaction on the Robinhood Chain RPC.
    // If you have $0 USDC or 0 ETH for gas, this throws an error IMMEDIATELY.
    const { request } = await simulateContract(wagmiConfig, {
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, value],
      account: account.address,
      chainId: ROBINHOOD_CHAIN_ID,
    });

    // 4. Actual Execution
    // This only runs if the simulation above passes.
    const hash = await writeContract(wagmiConfig, request);
    return hash;
  } catch (error: unknown) {
    // Handle specific blockchain errors gracefully
    const details = error as SimulationLikeError;
    console.error("Payment Simulation Error:", error);

    if (details.message?.includes("insufficient funds")) {
      throw new Error("Insufficient ETH for gas fees on Robinhood Chain.");
    }
    if (details.message?.includes("ERC20: transfer amount exceeds balance")) {
      throw new Error(
        `Insufficient USDC. You need ${amountUsdc} USDC to complete this.`,
      );
    }
    if (details.message?.includes("user rejected")) {
      throw new Error("Transaction rejected by user.");
    }

    throw new Error(
      details.shortMessage ||
        details.message ||
        "Transaction simulation failed.",
    );
  }
}

/**
 * Waits for the transaction to be mined on Robinhood Chain.
 */
export async function waitForUsdcTx(hash: `0x${string}`) {
  return waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId: ROBINHOOD_CHAIN_ID,
    confirmations: 1, // Wait for at least 1 block confirmation
  });
}
