import { parseUnits } from "viem";
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  getAddressEncoder,
  getProgramDerivedAddress,
  getTransactionEncoder,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import type { Signature } from "@solana/keys";
import bs58 from "bs58";
import type { WalletAccount } from "@wallet-standard/base";
import type { PhantomWallet } from "@/lib/phantomWallet";
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

export async function sendSolanaUsdc(
  wallet: PhantomWallet,
  account: WalletAccount,
  recipientOwner: string,
  mintAddress: string,
  amountAtomic: string,
): Promise<string> {
  const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
  const rpc = createSolanaRpc(rpcUrl);
  const sender = address(account.address);
  const recipient = address(recipientOwner);
  const mint = address(mintAddress);
  const amount = BigInt(amountAtomic);
  if (amount <= 0n || amount > 0xffffffffffffffffn) throw new Error("Invalid payment amount.");

  const tokenProgram = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const associatedTokenProgram = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const systemProgram = address("11111111111111111111111111111111");
  const addressEncoder = getAddressEncoder();
  const [senderTokenAccount] = await getProgramDerivedAddress({
    programAddress: associatedTokenProgram,
    seeds: [addressEncoder.encode(sender), addressEncoder.encode(tokenProgram), addressEncoder.encode(mint)],
  });
  const [recipientTokenAccount] = await getProgramDerivedAddress({
    programAddress: associatedTokenProgram,
    seeds: [addressEncoder.encode(recipient), addressEncoder.encode(tokenProgram), addressEncoder.encode(mint)],
  });

  const transferData = new Uint8Array(10);
  transferData[0] = 12;
  let amountToEncode = amount;
  for (let index = 0; index < 8; index += 1) {
    transferData[index + 1] = Number(amountToEncode & 0xffn);
    amountToEncode >>= 8n;
  }
  transferData[9] = 6;
  const instructions = [
    {
      programAddress: associatedTokenProgram,
      accounts: [
        { address: sender, role: AccountRole.WRITABLE_SIGNER },
        { address: recipientTokenAccount, role: AccountRole.WRITABLE },
        { address: recipient, role: AccountRole.READONLY },
        { address: mint, role: AccountRole.READONLY },
        { address: systemProgram, role: AccountRole.READONLY },
        { address: tokenProgram, role: AccountRole.READONLY },
      ],
      data: new Uint8Array([1]),
    },
    {
      programAddress: tokenProgram,
      accounts: [
        { address: senderTokenAccount, role: AccountRole.WRITABLE },
        { address: mint, role: AccountRole.READONLY },
        { address: recipientTokenAccount, role: AccountRole.WRITABLE },
        { address: sender, role: AccountRole.READONLY_SIGNER },
      ],
      data: transferData,
    },
  ];
  const latestBlockhash = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = appendTransactionMessageInstructions(
    instructions,
    setTransactionMessageLifetimeUsingBlockhash(
      latestBlockhash.value,
      setTransactionMessageFeePayer(sender, createTransactionMessage({ version: "legacy" })),
    ),
  );
  const transactionBytes = getTransactionEncoder().encode(compileTransaction(message));
  const [sent] = await wallet.features["solana:signAndSendTransaction"].signAndSendTransaction({
    account,
    transaction: transactionBytes,
    chain: "solana:mainnet",
    options: { preflightCommitment: "confirmed", commitment: "finalized" },
  });
  if (!sent?.signature) throw new Error("Phantom did not return a transaction signature.");
  const transactionSignature = bs58.encode(sent.signature);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const statuses = await rpc.getSignatureStatuses(
      [transactionSignature as Signature],
      { searchTransactionHistory: true },
    ).send();
    const status = statuses.value[0];
    if (status?.err) throw new Error("Solana payment transaction failed.");
    if (status?.confirmationStatus === "finalized") return transactionSignature;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Solana transaction ${transactionSignature} was submitted but did not finalize in time.`);
}

/**
 * Send a USDC transfer on Robinhood Chain from the connected wallet.
 * Validates the transaction via simulation before prompting the wallet.
 */
export async function sendUsdcOnEvm(
  to: `0x${string}`,
  amountUsdc: number,
  usdcAddress: `0x${string}`,
  targetChainId = ROBINHOOD_CHAIN_ID,
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
  if (currentChain !== targetChainId) {
    try {
      await switchChain(wagmiConfig, { chainId: targetChainId });
    } catch {
      throw new Error(`Please switch your wallet network to chain ${targetChainId}.`);
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
      chainId: targetChainId,
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
      throw new Error(`Insufficient native token for gas fees on chain ${targetChainId}.`);
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
export async function waitForUsdcTx(
  hash: `0x${string}`,
  chainId = ROBINHOOD_CHAIN_ID,
) {
  return waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId,
    confirmations: 1, // Wait for at least 1 block confirmation
  });
}
