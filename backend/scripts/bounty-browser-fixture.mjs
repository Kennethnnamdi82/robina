// Disposable browser fixture. Never imported or mounted by production.
if (process.env.NODE_ENV !== 'test' || process.env.RIVALS_BOUNTY_BROWSER_QA !== '1') throw new Error('Explicit isolated browser-test mode required');
process.env.DOTENV_CONFIG_PATH = 'test/nonexistent-browser-env';
process.env.JWT_SECRET = 'isolated-bounty-browser-test-secret-32-characters';
process.env.CORS_ORIGIN = 'http://127.0.0.1:8086';
process.env.SIWE_URI = 'http://127.0.0.1:8086'; process.env.SIWE_DOMAIN = '127.0.0.1:8086';
process.env.CHAIN_ID = '4663'; process.env.ADMIN_EMAIL = 'bounty-qa@example.com';
process.env.BOUNTY_PAYOUTS_ENABLED = 'false';
const { default: bcrypt } = await import('bcryptjs');
process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('Bounty-QA-Only-Password!', 10);
const { default: express } = await import('express');
const { default: mongoose } = await import('mongoose');
const { MongoMemoryReplSet } = await import('mongodb-memory-server');
const { existsSync } = await import('node:fs'); const { fileURLToPath } = await import('node:url');
const { createApp } = await import('../src/app.js'); const { signSession } = await import('../src/middleware/auth.js');
const { User } = await import('../src/models/User.js'); const { initializeBounties } = await import('../src/bounties/models.js');
const service = await import('../src/bounties/service.js');
const prepared = fileURLToPath(new URL('../.cache/test-mongodb/mongod.exe', import.meta.url));
const mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.24', ...(process.platform === 'win32' && existsSync(prepared) ? { systemBinary: prepared } : {}) }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
await mongoose.connect(mongo.getUri(), { dbName: 'rivals-bounty-browser-tests' });
const app = express(); app.use(express.json());
// Local HTTP only; production Secure/HttpOnly cookie configuration is unchanged.
app.use((_req, res, next) => { const cookie = res.cookie.bind(res); res.cookie = (name, value, options) => cookie(name, value, { ...options, secure: false, sameSite: 'lax' }); next(); });
let player;
async function reset(seed = false) {
  if (mongoose.connection.db.databaseName !== 'rivals-bounty-browser-tests') throw new Error('Refusing to reset non-test database');
  await mongoose.connection.dropDatabase(); await User.createIndexes(); await initializeBounties();
  player = await User.create({ wallet: '0x' + '22'.repeat(20), email: 'creator-qa@example.com', referralCode: 'browser-test-player' });
  if (seed) for (const platform of ['x', 'tiktok']) {
    const task = await service.createTask('bounty-qa@example.com', { title: platform === 'x' ? 'RIVALS Original X Post' : 'RIVALS Original TikTok Video', platform, description: 'Create original RIVALS promotional content.',
      instructions: ['Use original gameplay.', 'Provide ownership and engagement analytics.'], disclosure: 'Clearly disclose the paid promotion, including #ad and applicable platform tools.', minimumEngagement: 5000, evidenceRequired: true });
    await service.changeTaskStatus('bounty-qa@example.com', String(task._id), { status: 'active' });
    const sub = await service.submit(player._id, String(task._id), { postUrl: platform === 'x' ? 'https://x.com/rivals/status/12345' : 'https://www.tiktok.com/@rivals/video/67890', evidenceUrl: 'https://evidence.example.com/analytics', confirmed: true }, 'isolated-browser-ip');
    if (platform === 'tiktok') await service.reviewSubmission('bounty-qa@example.com', String(sub._id), { decision: 'approve', rewardMicros: '5000000', verificationMethod: 'manual', ownershipVerified: true, engagementVerified: true, complianceVerified: true, disclosureVerified: true, observedEngagement: 5000, notes: 'Isolated test only; no social engagement or real funds.' });
  }
}
app.post('/__qa/reset', async (req, res) => { await reset(req.body?.seed === true); res.json({ ok: true }); });
app.post('/__qa/player-session', (_req, res) => { res.cookie('bd_session', signSession(player.wallet), { httpOnly: true, path: '/' }); res.json({ ok: true }); });
app.use(createApp(() => true, { bountyChain: { enabled: false } }));
await reset();
const server = app.listen(4012, '127.0.0.1', () => console.log('Isolated manual-bounty browser fixture ready. No blockchain or payment client.'));
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
process.once('SIGINT', () => void stop()); process.once('SIGTERM', () => void stop());
