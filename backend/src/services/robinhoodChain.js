import {
  createPublicClient,
  http,
  decodeEventLog,
  parseAbi,
  getAddress,
  defineChain,
} from "viem";
import { env } from "../config/env.js";

function clientForChain(chainId) {
  const config = env.evmChains[String(chainId)];
  if (!config) {
    const error = new Error("unsupported_chain");
    error.code = "unsupported_chain";
    error.status = 400;
    throw error;
  }
  const chain = defineChain({
    id: config.chainId,
    name: config.name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  return { client: createPublicClient({ chain, transport: http(config.rpcUrl) }), config };
}

export const publicClient = clientForChain(env.chainId).client;

const erc20Abi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function toUsdcUnits(value) {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    const e = new Error("invalid_amount_format");
    e.status = 400;
    throw e;
  }
  const [whole, fraction = ""] = normalized.split(".");
  const fractionPadded = `${fraction}000000`.slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(fractionPadded);
}

function fromUsdcUnits(units) {
  return Number(units) / 1_000_000;
}

/**
 * Verify a USDC transfer on a configured EVM payment chain.
 */
export async function verifyUsdcTransfer({
  txHash,
  expectedTo,
  minAmount,
  chainId = env.chainId,
  exactAmount = false,
}) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    const e = new Error("invalid_tx_hash");
    e.code = "invalid_tx_hash";
    e.status = 400;
    throw e;
  }

  const { client, config } = clientForChain(Number(chainId));
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch (err) {
    const e = new Error("tx_not_found_yet");
    e.code = "confirmations_pending";
    e.status = 409;
    throw e;
  }

  if (!receipt) {
    const e = new Error("confirmations_pending");
    e.code = "confirmations_pending";
    e.status = 409;
    throw e;
  }

  if (receipt.status !== "success") {
    const e = new Error("tx_failed_on_chain");
    e.code = "tx_failed";
    e.status = 400;
    throw e;
  }

  let tx;
  try {
    tx = await client.getTransaction({ hash: txHash });
  } catch {
    const e = new Error("tx_data_unavailable");
    e.code = "confirmations_pending";
    e.status = 409;
    throw e;
  }

  // Chain & Contract Verification
  const txChainId = Number(tx.chainId);
  if (txChainId !== Number(chainId)) {
    const e = new Error("wrong_chain");
    e.code = "wrong_chain";
    e.status = 400;
    throw e;
  }

  // IMPORTANT:
  // Do not hard-fail on tx.to mismatch. Smart-account / relayer flows can wrap
  // ERC20 transfers in a different top-level call target while still emitting
  // a valid USDC Transfer log from the USDC contract.

  // Confirmation Logic
  let currentBlock = await client.getBlockNumber();
  const confirmations = Number(currentBlock - receipt.blockNumber + 1n);

  // Set env.minConfirmations to 1 in your .env for the fastest experience!
  if (confirmations < (env.minConfirmations || 1)) {
    const e = new Error("confirmations_pending");
    e.code = "confirmations_pending";
    e.status = 409;
    e.details = { confirmations, required: env.minConfirmations };
    throw e;
  }

  const expected = getAddress(expectedTo);
  let found = null;

  for (const log of receipt.logs) {
    if ((log.address || "").toLowerCase() !== config.usdcContract.toLowerCase())
      continue;
    if (!log.topics?.[0] || log.topics[0].toLowerCase() !== TRANSFER_TOPIC)
      continue;

    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") continue;
      if (getAddress(decoded.args.to) === expected) {
        found = decoded.args;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!found) {
    const e = new Error("transfer_not_found_in_logs");
    e.code = "transfer_not_found";
    e.status = 400;
    throw e;
  }

  const amountUnits = BigInt(found.value);
  const minAmountUnits = toUsdcUnits(minAmount);

  if (exactAmount ? amountUnits !== minAmountUnits : amountUnits < minAmountUnits) {
    const e = new Error(exactAmount ? "amount_mismatch" : "amount_too_low");
    e.code = exactAmount ? "amount_mismatch" : "amount_too_low";
    e.status = 400;
    e.details = {
      paid: fromUsdcUnits(amountUnits),
      required: Number(minAmount),
    };
    throw e;
  }

  return {
    ok: true,
    amount: fromUsdcUnits(amountUnits),
    from: found.from.toLowerCase(),
    to: found.to.toLowerCase(),
    blockNumber: Number(receipt.blockNumber),
  };
}
