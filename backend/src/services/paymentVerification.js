import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  getAddress,
  http,
  parseAbi,
} from "viem";
import bs58 from "bs58";
import { env } from "../config/env.js";

const transferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const transferTopic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function verificationError(code, status = 400, details) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function evmClient(chainId) {
  const rpcUrl = env.evmRpcUrls[String(chainId)];
  if (!rpcUrl) throw verificationError("unsupported_chain");
  return createPublicClient({
    chain: defineChain({
      id: Number(chainId),
      name: `Configured EVM ${chainId}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    }),
    transport: http(rpcUrl),
  });
}

async function solanaRpc(method, params) {
  let response;
  try {
    response = await fetch(env.solanaRpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw verificationError("solana_rpc_unavailable", 503);
  }
  if (!response.ok) throw verificationError("solana_rpc_unavailable", 503);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw verificationError("solana_rpc_invalid_response", 503);
  }
  if (payload.error) throw verificationError("solana_rpc_unavailable", 503);
  return payload.result;
}

export async function verifyEvmIntent(intent, transactionHash) {
  const client = evmClient(intent.chainId);
  const configuredChainId = await client.getChainId();
  if (configuredChainId !== Number(intent.chainId)) {
    throw verificationError("rpc_chain_mismatch", 500);
  }

  let [transaction, receipt] = await Promise.all([
    client.getTransaction({ hash: transactionHash }).catch(() => null),
    client.getTransactionReceipt({ hash: transactionHash }).catch(() => null),
  ]);
  if (!transaction || !receipt) throw verificationError("transaction_not_found", 409);
  if (receipt.status !== "success") throw verificationError("transaction_reverted");

  const head = await client.getBlockNumber();
  const confirmations = Number(head - receipt.blockNumber + 1n);
  if (confirmations < env.minConfirmations) {
    throw verificationError("confirmations_pending", 409, {
      confirmations,
      required: env.minConfirmations,
    });
  }

  if (transaction.from.toLowerCase() !== intent.wallet.toLowerCase()) {
    throw verificationError("sender_mismatch");
  }

  const expectedAmount = BigInt(intent.amountAtomic);
  const expectedRecipient = getAddress(intent.recipient).toLowerCase();
  if (intent.assetType === "native") {
    if (!transaction.to || transaction.to.toLowerCase() !== expectedRecipient) {
      throw verificationError("recipient_mismatch");
    }
    if (transaction.value !== expectedAmount) throw verificationError("amount_mismatch");
  } else {
    if (!intent.assetAddress || transaction.to?.toLowerCase() !== intent.assetAddress.toLowerCase()) {
      throw verificationError("token_contract_mismatch");
    }
    const transfer = receipt.logs.find((log) => {
      if (log.address.toLowerCase() !== intent.assetAddress.toLowerCase()) return false;
      if (log.topics[0]?.toLowerCase() !== transferTopic) return false;
      try {
        const decoded = decodeEventLog({ abi: transferAbi, data: log.data, topics: log.topics });
        return (
          decoded.eventName === "Transfer" &&
          decoded.args.from.toLowerCase() === intent.wallet.toLowerCase() &&
          decoded.args.to.toLowerCase() === expectedRecipient &&
          BigInt(decoded.args.value) === expectedAmount
        );
      } catch {
        return false;
      }
    });
    if (!transfer) throw verificationError("token_transfer_mismatch");
  }

  return { chainType: "evm", blockNumber: Number(receipt.blockNumber), confirmations };
}

export async function verifySolanaIntent(intent, signature) {
  const [transaction, statusResult] = await Promise.all([
    solanaRpc("getTransaction", [
      signature,
      { commitment: "finalized", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]),
    solanaRpc("getSignatureStatuses", [[signature], { searchTransactionHistory: true }]),
  ]);
  const status = statusResult?.value?.[0];
  if (!transaction || !status) throw verificationError("transaction_not_found", 409);
  if (status.confirmationStatus !== "finalized") {
    throw verificationError("confirmations_pending", 409);
  }
  if (transaction.meta?.err) throw verificationError("transaction_reverted");
  if (intent.assetType !== "spl" || intent.assetAddress !== env.solanaUsdcMint) {
    throw verificationError("unsupported_solana_asset");
  }
  const expectedAmount = BigInt(intent.amountAtomic);
  const sender = intent.senderAddress;
  const recipient = intent.recipient;
  if (!sender || !recipient || !env.solanaTreasuryWallet || recipient !== env.solanaTreasuryWallet) {
    throw verificationError("solana_payment_configuration_invalid", 500);
  }
  const accountKeys = transaction.transaction.message.accountKeys;
  const keyString = (key) => typeof key === "string" ? key : key.pubkey;
  const tokenBalances = [
    ...(transaction.meta?.preTokenBalances || []),
    ...(transaction.meta?.postTokenBalances || []),
  ];
  const accountOwnerFor = (account) => {
    const index = accountKeys.findIndex((key) => keyString(key) === account);
    return tokenBalances.find((balance) =>
      balance.accountIndex === index && balance.mint === intent.assetAddress,
    )?.owner;
  };
  const senderIsSigner = accountKeys.some((key) =>
    keyString(key) === sender && typeof key !== "string" && key.signer,
  );
  if (!senderIsSigner) throw verificationError("sender_mismatch");
  const instructions = transaction.transaction.message.instructions;
  let matched = false;
  for (const instruction of instructions) {
    if (!("parsed" in instruction) || !instruction.parsed) continue;
    const info = instruction.parsed.info || {};
    if (instruction.program !== "spl-token" ||
        !["transfer", "transferChecked"].includes(instruction.parsed.type)) continue;
    const source = String(info.source || "");
    const destination = String(info.destination || "");
    const amount = info.tokenAmount?.amount ?? info.amount;
    matched = info.authority === sender &&
      accountOwnerFor(source) === sender &&
      accountOwnerFor(destination) === recipient &&
      BigInt(amount) === expectedAmount &&
      (!info.mint || info.mint === intent.assetAddress);
    if (matched) break;
  }
  if (!matched) throw verificationError("transfer_mismatch");

  for (const address of [sender, recipient, intent.assetAddress]) {
    try {
      if (bs58.decode(address).length !== 32) throw new Error("invalid address");
    } catch {
      throw verificationError("solana_payment_configuration_invalid", 500);
    }
  }
  return {
    chainType: "solana",
    slot: transaction.slot,
    confirmations: "finalized",
    amountAtomic: expectedAmount.toString(),
  };
}
