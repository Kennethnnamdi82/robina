// Disposable browser-integration fixture. Never imported by the production server.
if (process.env.NODE_ENV !== 'test' || process.env.RIVALS_BOUNTY_BROWSER_QA !== '1') throw new Error('Explicit isolated browser-test mode required');
process.env.DOTENV_CONFIG_PATH = 'test/nonexistent-browser-env';
process.env.JWT_SECRET = 'isolated-bounty-browser-test-secret-32-characters';
process.env.CORS_ORIGIN = 'http://127.0.0.1:8086';
process.env.SIWE_URI = 'http://127.0.0.1:8086';
process.env.SIWE_DOMAIN = '127.0.0.1:8086';
process.env.CHAIN_ID = '4663';
process.env.ADMIN_EMAIL = 'bounty-qa@example.com';
process.env.BOUNTY_PAYOUTS_ENABLED = 'false';
const { default: bcrypt } = await import('bcryptjs');
process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('Bounty-QA-Only-Password!', 6);
const { default: mongoose } = await import('mongoose');
const { default: express } = await import('express');
const { existsSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const { MongoMemoryReplSet } = await import('mongodb-memory-server');
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { signSession } = await import('../src/middleware/auth.js');
const { initializeBounties } = await import('../src/bounties/models.js');
const service = await import('../src/bounties/service.js');
const { createBaseTreasury } = await import('../src/bounties/baseTreasury.js');
const { BASE_USDC } = await import('../src/bounties/validation.js');
const { privateKeyToAccount } = await import('viem/accounts');
const { keccak256, parseTransaction, decodeFunctionData, parseAbi, encodeEventTopics, encodeAbiParameters } = await import('viem');
const key = '0x' + '01'.repeat(32); // Public deterministic TEST key, never funded.
const signer = privateKeyToAccount(key), transactions = new Map();
const abi = parseAbi(['function transfer(address to,uint256 value) returns (bool)', 'event Transfer(address indexed from,address indexed to,uint256 value)']);
const blockHash = '0x' + 'aa'.repeat(32);
const client = {
  getChainId: async () => 8453, readContract: async args => args.functionName === 'decimals' ? 6 : 1_000_000_000_000n,
  getTransactionCount: async () => transactions.size, estimateGas: async () => 80000n,
  estimateFeesPerGas: async () => ({ maxFeePerGas: 1000000n, maxPriorityFeePerGas: 1000000n }), getBalance: async () => 10n ** 18n,
  sendRawTransaction: async ({ serializedTransaction }) => {
    const hash = keccak256(serializedTransaction), tx = parseTransaction(serializedTransaction);
    transactions.set(hash, { hash, from: signer.address, to: tx.to, input: tx.data, value: tx.value || 0n, nonce: tx.nonce, chainId: tx.chainId, blockHash }); return hash;
  },
  getTransaction: async ({ hash }) => { if (!transactions.has(hash)) throw new Error('transaction_not_found'); return transactions.get(hash); },
  getBlock: async args => args.blockTag ? { number: 101n } : { number: 100n, hash: blockHash },
  getTransactionReceipt: async ({ hash }) => {
    const tx = transactions.get(hash); if (!tx) throw new Error('receipt_not_found');
    const { args } = decodeFunctionData({ abi, data: tx.input });
    return { transactionHash: hash, from: signer.address, to: BASE_USDC, blockNumber: 100n, blockHash, status: 'success', logs: [{ address: BASE_USDC,
      topics: encodeEventTopics({ abi, eventName: 'Transfer', args: { from: signer.address, to: args[0] } }), data: encodeAbiParameters([{ type: 'uint256' }], [args[1]]) }] };
  },
};
const chain = createBaseTreasury({ BOUNTY_PAYOUTS_ENABLED: 'true', BOUNTY_BASE_RPC_URL: 'https://isolated-test.example.com', BOUNTY_TREASURY_PRIVATE_KEY: key, BOUNTY_TREASURY_ADDRESS: signer.address }, { publicClient: client });
const prepared = fileURLToPath(new URL('../.cache/test-mongodb/mongod.exe', import.meta.url));
const mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.24', ...(process.platform === 'win32' && existsSync(prepared) ? { systemBinary: prepared } : {}) }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
await mongoose.connect(mongo.getUri(), { dbName: 'rivals-bounty-browser-tests' });
const app = express(); app.use(express.json());
// Local HTTP test origin only. Production cookie configuration is unchanged.
app.use((_req, res, next) => { const cookie = res.cookie.bind(res); res.cookie = (name, value, options) => cookie(name, value, { ...options, secure: false, sameSite: 'lax' }); next(); });
let player;
async function reset(seed = false) {
  if (mongoose.connection.db.databaseName !== 'rivals-bounty-browser-tests') throw new Error('Refusing to reset non-test database');
  await mongoose.connection.dropDatabase(); await User.createIndexes(); await initializeBounties(); transactions.clear();
  player = await User.create({ wallet: '0x' + '22'.repeat(20), email: 'creator-qa@example.com', referralCode: 'browser-test-player' });
  if (seed) for (const platform of ['x', 'tiktok']) {
    const task = await service.createTask('bounty-qa@example.com', { title: platform === 'x' ? 'RIVALS Original X Post' : 'RIVALS Original TikTok Video', platform, description: 'Create original RIVALS promotional content.',
      instructions: ['Use original gameplay.', 'Provide ownership and engagement analytics.'], disclosure: 'Clearly disclose the paid promotion, including #ad and applicable platform tools.',
      minimumEngagement: 5000, rewardMicros: platform === 'x' ? '10000000' : '5000000', budgetMicros: '100000000', participationLimit: 10, evidenceRequired: true });
    await service.changeTaskStatus('bounty-qa@example.com', String(task._id), { status: 'active' });
    const sub = await service.submit(player._id, String(task._id), { postUrl: platform === 'x' ? 'https://x.com/rivals/status/12345' : 'https://www.tiktok.com/@rivals/video/67890', evidenceUrl: 'https://evidence.example.com/analytics', confirmed: true }, 'isolated-browser-ip');
    if (platform === 'tiktok') await service.reviewSubmission('bounty-qa@example.com', String(sub._id), { decision: 'approve', verificationMethod: 'manual', ownershipVerified: true, engagementVerified: true, complianceVerified: true, disclosureVerified: true, observedEngagement: 5000, notes: 'Isolated test fixture; not actual social engagement or funds.' });
  }
}
app.post('/__qa/reset', async (req, res) => { await reset(req.body?.seed === true); res.json({ ok: true }); });
app.post('/__qa/player-session', (_req, res) => { res.cookie('bd_session', signSession(player.wallet), { httpOnly: true, path: '/' }); res.json({ ok: true }); });
app.use(createApp(() => true, { bountyChain: chain }));
await reset();
const server = app.listen(4012, '127.0.0.1', () => console.log('Isolated bounty browser fixture ready on 127.0.0.1:4012; RPC is simulated.'));
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
process.once('SIGINT', () => void stop()); process.once('SIGTERM', () => void stop());
