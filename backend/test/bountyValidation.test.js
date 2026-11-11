import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeEventTopics, encodeAbiParameters, encodeFunctionData, keccak256, parseAbi, parseTransaction, decodeFunctionData, recoverTransactionAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseAddress, normalizePost, evidenceUrl, parse, taskInput, withdrawalInput, wire, BASE_USDC } from '../src/bounties/validation.js';
import { createBaseTreasury, inspectBasePayout } from '../src/bounties/baseTreasury.js';

test('platform URLs normalize by immutable post ID across hosts, handles and tracking', () => {
  assert.deepEqual(normalizePost('x', 'https://twitter.com/Alice/status/12345?s=20#x'), normalizePost('x', 'https://x.com/Other/status/12345'));
  assert.equal(normalizePost('tiktok', 'https://www.tiktok.com/@Alice/video/12345?share=1').postKey, 'tiktok:12345');
  for (const url of ['http://x.com/a/status/123', 'https://x.com.evil.com/a/status/123', 'https://x.com@evil.com/a/status/123', 'https://x.com:444/a/status/123', 'https://x.com/a/status/123/photo/1', 'https://t.co/short']) {
    assert.throws(() => normalizePost('x', url), /invalid_post_url/);
  }
  assert.throws(() => normalizePost('x', 'https://www.tiktok.com/@a/video/123'), /invalid_post_url/);
  assert.throws(() => normalizePost('tiktok', 'https://vm.tiktok.com/short'), /invalid_post_url/);
});
test('evidence is external HTTPS link data, not embedded uploads or local requests', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a', 'https://a.internal/x', 'https://user:pass@example.com/a']) assert.throws(() => evidenceUrl(url));
  assert.equal(evidenceUrl('https://evidence.example.com/view/123'), 'https://evidence.example.com/view/123');
});
test('USDC accepts bounded integer micro-unit strings only and serializes without precision loss', () => {
  const input = { amountMicros: '5000001', address: '0x' + '11'.repeat(20), confirmed: true };
  assert.equal(parse(withdrawalInput, input).amountMicros, '5000001');
  for (const amountMicros of [5_000_000, '4.999999', '4999999', '05', '1e9', '-5000000', '9000000000000001']) assert.throws(() => parse(withdrawalInput, { ...input, amountMicros }));
  assert.equal(wire({ amountMicros: 9_000_000_000_000_000n }).amountMicros, '9000000000000000');
  assert.throws(() => parse(taskInput, { status: 'active' }));
});
test('payout addresses reject zero, token contract, invalid checksum and non-EVM values', () => {
  assert.equal(baseAddress('0x' + '11'.repeat(20)), '0x' + '11'.repeat(20));
  for (const value of ['0x' + '00'.repeat(20), BASE_USDC, 'solana:123', '0x123']) assert.throws(() => baseAddress(value));
});
test('treasury is disabled by default; enabling it fails closed without backend configuration', () => {
  assert.deepEqual(createBaseTreasury({}), { enabled: false });
  assert.throws(() => createBaseTreasury({ BOUNTY_PAYOUTS_ENABLED: 'true' }), /Invalid bounty treasury/);
});
function treasuryFixture() {
  const privateKey = '0x' + '01'.repeat(32); // Test-only deterministic, never funded.
  const account = privateKeyToAccount(privateKey);
  const state = { chainId: 8453, decimals: 6, usdc: 100_000_000n, eth: 1_000_000_000_000_000_000n, fee: 1_000_000n, broadcasts: [] };
  const publicClient = {
    getChainId: async () => state.chainId,
    readContract: async args => args.functionName === 'decimals' ? state.decimals : state.usdc,
    getTransactionCount: async () => 7, estimateGas: async () => 80_000n,
    estimateFeesPerGas: async () => ({ maxFeePerGas: state.fee, maxPriorityFeePerGas: state.fee }),
    getBalance: async () => state.eth,
    sendRawTransaction: async ({ serializedTransaction }) => { state.broadcasts.push(serializedTransaction); return keccak256(serializedTransaction); },
  };
  const gateway = createBaseTreasury({ BOUNTY_PAYOUTS_ENABLED: 'true', BOUNTY_BASE_RPC_URL: 'https://base-rpc.example.com',
    BOUNTY_TREASURY_PRIVATE_KEY: privateKey, BOUNTY_TREASURY_ADDRESS: account.address }, { publicClient });
  return { gateway, state, account, withdrawal: { amountMicros: 5_000_001n, address: '0x' + '22'.repeat(20) } };
}
test('production treasury prepares an exact Base USDC transfer, without broadcasting while signing', async () => {
  const f = treasuryFixture(), signed = await f.gateway.prepare(f.withdrawal);
  assert.equal(f.state.broadcasts.length, 0);
  assert.equal(signed.txHash, keccak256(signed.rawTransaction));
  const transaction = parseTransaction(signed.rawTransaction);
  assert.equal(transaction.chainId, 8453); assert.equal(transaction.nonce, 7);
  assert.equal(transaction.to.toLowerCase(), BASE_USDC.toLowerCase());
  assert.equal(await recoverTransactionAddress({ serializedTransaction: signed.rawTransaction }), f.account.address);
  const call = decodeFunctionData({ abi: parseAbi(['function transfer(address to, uint256 value) returns (bool)']), data: transaction.data });
  assert.equal(call.functionName, 'transfer'); assert.equal(call.args[1], 5_000_001n);
  await f.gateway.broadcast(signed.rawTransaction, signed.txHash); assert.equal(f.state.broadcasts.length, 1);
  await assert.rejects(f.gateway.broadcast(signed.rawTransaction, '0x' + 'ff'.repeat(32)), /intent_mismatch/);
});
test('provider errors cannot leak RPC credential URLs through the backend error handler', async () => {
  const privateKey = '0x' + '01'.repeat(32);
  const gateway = createBaseTreasury({ BOUNTY_PAYOUTS_ENABLED: 'true', BOUNTY_BASE_RPC_URL: 'https://base-rpc.example.com/secret-provider-token',
    BOUNTY_TREASURY_PRIVATE_KEY: privateKey, BOUNTY_TREASURY_ADDRESS: privateKeyToAccount(privateKey).address },
  { publicClient: { getChainId: async () => { throw Object.assign(new Error('RPC failure /secret-provider-token'), { status: 503 }); } } });
  await assert.rejects(gateway.prepare({ amountMicros: 5_000_000n, address: '0x' + '22'.repeat(20) }), error =>
    error.code === 'base_treasury_unavailable' && !error.message.includes('secret-provider-token'));
});
for (const [name, corrupt] of [
  ['wrong RPC chain', f => { f.state.chainId = 1; }],
  ['wrong token decimals', f => { f.state.decimals = 18; }],
  ['insufficient treasury USDC', f => { f.state.usdc = 1n; }],
  ['insufficient gas', f => { f.state.eth = 0n; }],
  ['excessive gas fee', f => { f.state.fee = 100_000_000_000n; }],
  ['per-payment limit', f => { f.withdrawal.amountMicros = 100_000_001n; }],
]) test('treasury refuses signing for ' + name, async () => {
  const f = treasuryFixture(); corrupt(f); await assert.rejects(f.gateway.prepare(f.withdrawal)); assert.equal(f.state.broadcasts.length, 0);
});

const abi = parseAbi(['function transfer(address to, uint256 value) returns (bool)', 'event Transfer(address indexed from, address indexed to, uint256 value)']);
function chainFixture() {
  const intent = { rawTransaction: '0x0102', txHash: keccak256('0x0102'), chainId: 8453,
    treasury: '0x' + '11'.repeat(20), address: '0x' + '22'.repeat(20), nonce: 3, amountMicros: 5_000_000n };
  const blockHash = '0x' + 'aa'.repeat(32);
  const receipt = { transactionHash: intent.txHash, from: intent.treasury, to: BASE_USDC, blockNumber: 100n, blockHash, status: 'success',
    logs: [{ address: BASE_USDC, topics: encodeEventTopics({ abi, eventName: 'Transfer', args: { from: intent.treasury, to: intent.address } }),
      data: encodeAbiParameters([{ type: 'uint256' }], [intent.amountMicros]) }] };
  const transaction = { hash: intent.txHash, from: intent.treasury, to: BASE_USDC, chainId: 8453, nonce: 3, value: 0n, blockHash,
    input: encodeFunctionData({ abi, functionName: 'transfer', args: [intent.address, intent.amountMicros] }) };
  const state = { chainId: 8453, finalized: 101n, receipt, transaction, blockHash };
  const client = { getChainId: async () => state.chainId, getTransactionReceipt: async () => state.receipt,
    getBlock: async args => args.blockTag ? { number: state.finalized } : { hash: state.blockHash }, getTransaction: async () => state.transaction };
  return { intent, client, state };
}
test('Base verifier requires finalized canonical native-USDC receipt and exact transfer event', async () => {
  const f = chainFixture();
  assert.deepEqual(await inspectBasePayout(f.client, f.intent), { status: 'paid', blockNumber: '100' });
  f.state.finalized = 99n;
  assert.deepEqual(await inspectBasePayout(f.client, f.intent), { status: 'pending' });
  f.state.finalized = 101n; f.state.receipt.status = 'reverted';
  assert.deepEqual(await inspectBasePayout(f.client, f.intent), { status: 'reverted', blockNumber: '100' });
});
for (const [name, corrupt] of [
  ['wrong chain', f => { f.state.chainId = 1; }],
  ['noncanonical block', f => { f.state.blockHash = '0x' + 'bb'.repeat(32); }],
  ['wrong destination', f => { f.state.transaction.to = f.intent.address; }],
  ['wrong recipient or amount calldata', f => { f.state.transaction.input = '0x'; }],
  ['wrong sender', f => { f.state.transaction.from = f.intent.address; }],
  ['missing Transfer event', f => { f.state.receipt.logs = []; }],
  ['bridged or counterfeit token', f => { f.state.receipt.logs[0].address = f.intent.address; }],
  ['wrong transfer amount', f => { f.state.receipt.logs[0].data = encodeAbiParameters([{ type: 'uint256' }], [1n]); }],
  ['changed intent hash', f => { f.intent.txHash = '0x' + 'ff'.repeat(32); }],
]) test('Base verifier rejects ' + name, async () => {
  const f = chainFixture(); corrupt(f); await assert.rejects(inspectBasePayout(f.client, f.intent));
});
