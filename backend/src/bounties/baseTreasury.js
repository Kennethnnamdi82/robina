import { createPublicClient, http, encodeFunctionData, parseAbi, parseEventLogs, keccak256, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { BASE_USDC, fail, MIN_WITHDRAWAL } from './validation.js';

const abi = parseAbi([
  'function transfer(address to, uint256 value) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const transferData = withdrawal => encodeFunctionData({ abi, functionName: 'transfer', args: [withdrawal.address, BigInt(withdrawal.amountMicros)] });

/** Only used by the backend. Never imported by a frontend/serverless asset bundle. */
export function createBaseTreasury(configuration = process.env, dependencies = {}) {
  if (configuration.BOUNTY_PAYOUTS_ENABLED !== 'true') return { enabled: false };
  let account, rpcUrl, maxPayout, maxFee;
  try {
    rpcUrl = new URL(configuration.BOUNTY_BASE_RPC_URL);
    if (rpcUrl.protocol !== 'https:' || rpcUrl.username || rpcUrl.password) throw new Error();
    if (!/^0x[a-f\d]{64}$/i.test(configuration.BOUNTY_TREASURY_PRIVATE_KEY || '')) throw new Error();
    account = privateKeyToAccount(configuration.BOUNTY_TREASURY_PRIVATE_KEY);
    if (!configuration.BOUNTY_TREASURY_ADDRESS || !same(account.address, getAddress(configuration.BOUNTY_TREASURY_ADDRESS))) throw new Error();
    maxPayout = BigInt(configuration.BOUNTY_MAX_PAYOUT_MICROS || '100000000');
    maxFee = BigInt(configuration.BOUNTY_MAX_FEE_PER_GAS_WEI || '1000000000');
    if (maxPayout < MIN_WITHDRAWAL || maxPayout > 9_000_000_000_000_000n || maxFee < 1n || maxFee > 100_000_000_000n) throw new Error();
  } catch { throw new Error('Invalid bounty treasury configuration; check backend-only BOUNTY_* settings'); }
  const client = dependencies.publicClient ?? createPublicClient({ chain: base, transport: http(rpcUrl.href, { timeout: 5000, retryCount: 0 }) });
  return {
    enabled: true,
    async prepare(withdrawal) {
      try {
        if (BigInt(withdrawal.amountMicros) > maxPayout) fail('payout_above_treasury_limit', 409);
        if (same(withdrawal.address, account.address)) fail('payout_to_treasury_forbidden', 400);
        if (await client.getChainId() !== 8453) throw new Error();
        if (await client.readContract({ address: BASE_USDC, abi, functionName: 'decimals' }) !== 6) throw new Error();
        const balance = await client.readContract({ address: BASE_USDC, abi, functionName: 'balanceOf', args: [account.address] });
        if (balance < BigInt(withdrawal.amountMicros)) fail('treasury_usdc_insufficient', 503);
        const nonce = await client.getTransactionCount({ address: account.address, blockTag: 'pending' });
        const data = transferData(withdrawal);
        const estimate = await client.estimateGas({ account: account.address, to: BASE_USDC, data, value: 0n });
        const gas = estimate * 120n / 100n;
        if (gas > 250_000n) throw new Error();
        const fees = await client.estimateFeesPerGas();
        if (!fees.maxFeePerGas || fees.maxFeePerGas > maxFee || fees.maxPriorityFeePerGas > maxFee) fail('treasury_gas_limit', 503);
        // Additional ETH margin covers rollup data fees. No gas is deducted from the user's USDC.
        if (await client.getBalance({ address: account.address }) < gas * fees.maxFeePerGas + 100_000_000_000_000n) fail('treasury_gas_insufficient', 503);
        const rawTransaction = await account.signTransaction({ type: 'eip1559', chainId: 8453, to: BASE_USDC,
          data, value: 0n, nonce, gas, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
        return { rawTransaction, txHash: keccak256(rawTransaction), treasury: account.address, nonce, chainId: 8453 };
      } catch (error) {
        // Do not leak RPC credential URLs, raw signing data or provider error payloads to logs/API.
        if (['payout_above_treasury_limit', 'payout_to_treasury_forbidden', 'treasury_usdc_insufficient',
          'treasury_gas_limit', 'treasury_gas_insufficient'].includes(error.code)) throw error;
        fail('base_treasury_unavailable', 503);
      }
    },
    async broadcast(rawTransaction, expectedHash) {
      if (keccak256(rawTransaction) !== expectedHash) fail('payout_intent_mismatch');
      const hash = await client.sendRawTransaction({ serializedTransaction: rawTransaction });
      if (hash.toLowerCase() !== expectedHash.toLowerCase()) fail('payout_hash_mismatch');
    },
    async inspect(withdrawal) {
      return inspectBasePayout(client, withdrawal);
    },
  };
}

/** Injectable read-only verifier, shared by production and deterministic chain fixtures. */
export async function inspectBasePayout(client, withdrawal) {
  if (withdrawal.chainId !== 8453 || keccak256(withdrawal.rawTransaction) !== withdrawal.txHash) throw new Error('intent_mismatch');
  if (await client.getChainId() !== 8453) throw new Error('wrong_chain');
  const receipt = await client.getTransactionReceipt({ hash: withdrawal.txHash });
  const finalized = await client.getBlock({ blockTag: 'finalized' });
  if (receipt.blockNumber > finalized.number) return { status: 'pending' };
  const canonical = await client.getBlock({ blockNumber: receipt.blockNumber });
  if (!same(canonical.hash, receipt.blockHash)) throw new Error('noncanonical_receipt');
  const transaction = await client.getTransaction({ hash: withdrawal.txHash });
  if (!same(transaction.hash, withdrawal.txHash) || !same(receipt.transactionHash, withdrawal.txHash) ||
      !same(transaction.from, withdrawal.treasury) || !same(receipt.from, withdrawal.treasury) ||
      !same(transaction.to, BASE_USDC) || !same(receipt.to, BASE_USDC) ||
      transaction.chainId !== 8453 || transaction.nonce !== withdrawal.nonce ||
      transaction.value !== 0n || !same(transaction.input, transferData(withdrawal)) ||
      !same(transaction.blockHash, receipt.blockHash)) throw new Error('transaction_mismatch');
  if (receipt.status === 'reverted') return { status: 'reverted', blockNumber: receipt.blockNumber.toString() };
  const transfers = parseEventLogs({ abi, eventName: 'Transfer', logs: receipt.logs });
  const payment = transfers.some(log => same(log.address, BASE_USDC) &&
    same(log.args.from, withdrawal.treasury) && same(log.args.to, withdrawal.address) &&
    log.args.value === BigInt(withdrawal.amountMicros));
  if (receipt.status !== 'success' || !payment) throw new Error('usdc_transfer_not_proven');
  return { status: 'paid', blockNumber: receipt.blockNumber.toString() };
}
