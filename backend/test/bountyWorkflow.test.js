import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Explicit isolated test configuration. NEVER connect to an inherited production URI or RPC.
process.env.DOTENV_CONFIG_PATH = 'test/nonexistent-bounty-env';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'bounty-test-only-secret-32-characters-minimum';
process.env.ADMIN_EMAIL = 'reviewer@example.com';
process.env.BOUNTY_PAYOUTS_ENABLED = 'false';
const { env } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');
const { signSession } = await import('../src/middleware/auth.js');
const { User } = await import('../src/models/User.js');
const { RevokedToken } = await import('../src/models/RevokedToken.js');
const models = await import('../src/bounties/models.js');
const service = await import('../src/bounties/service.js');
let mongo, server, origin, counter = 100000, chain;
const address = '0x' + '22'.repeat(20);
const reviewer = 'reviewer@example.com';
const approval = { decision: 'approve', verificationMethod: 'manual', ownershipVerified: true,
  engagementVerified: true, complianceVerified: true, disclosureVerified: true,
  observedEngagement: 5000, notes: 'Verified original account ownership and live platform analytics, genuine engagement and #ad disclosure.' };
const taskData = (overrides = {}) => ({ title: 'Original RIVALS post', description: 'Promote RIVALS with original gameplay.', platform: 'x',
  instructions: ['Publish original content.', 'Supply ownership and engagement analytics.'], disclosure: 'Clearly disclose the reward using #ad.',
  minimumEngagement: 5000, rewardMicros: '10000000', budgetMicros: '100000000', participationLimit: 10, evidenceRequired: true, ...overrides });
function fakeChain() {
  const account = privateKeyToAccount('0x' + '01'.repeat(32)); // Public deterministic TEST key, never funded.
  return {
    enabled: true, preparations: 0, broadcasts: new Set(), outcome: 'pending', throwBroadcast: false, throwInspect: false,
    async prepare(withdrawal) {
      const nonce = this.preparations++;
      const rawTransaction = await account.signTransaction({ chainId: 8453, type: 'eip1559', nonce, gas: 100000n,
        maxFeePerGas: 1n, maxPriorityFeePerGas: 1n, to: withdrawal.address, value: 0n });
      return { rawTransaction, txHash: keccak256(rawTransaction), treasury: account.address, nonce, chainId: 8453 };
    },
    async broadcast(raw, hash) { assert.equal(keccak256(raw), hash); this.broadcasts.add(hash); if (this.throwBroadcast) throw new Error('timeout after acceptance'); },
    async inspect() { if (this.throwInspect) throw new Error('RPC unavailable'); return { status: this.outcome, blockNumber: '100' }; },
  };
}
before(async () => {
  const preparedBinary = fileURLToPath(new URL('../.cache/test-mongodb/mongod.exe', import.meta.url));
  mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.24', ...(process.platform === 'win32' && existsSync(preparedBinary) ? { systemBinary: preparedBinary } : {}) }, replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ ip: '127.0.0.1' }] });
  await mongoose.connect(mongo.getUri(), { dbName: 'rivals-bounty-isolated-tests' });
  await User.init(); await RevokedToken.init(); await models.initializeBounties();
  chain = fakeChain();
  server = createApp(() => true, { bountyChain: chain }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 240000 });
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
beforeEach(async () => {
  // No delete of financial/audit rows: use a fresh DB per test to exercise append-only guards.
  await mongoose.connection.dropDatabase();
  await User.createIndexes(); await RevokedToken.createIndexes(); await models.initializeBounties();
  Object.assign(chain, fakeChain());
});
async function player(extra = {}) {
  counter++;
  return User.create({ wallet: '0x' + counter.toString(16).padStart(40, '0'), referralCode: 'test-' + counter, ...extra });
}
const adminCookie = (jti = 'test-admin-session') => 'bd_admin=' + jwt.sign({ sub: 'admin', role: 'admin', email: reviewer }, env.jwtSecret,
  { issuer: 'basedrop-admin', audience: 'basedrop-admin', expiresIn: '1h', jwtid: jti });
const cookie = user => 'bd_session=' + signSession(user.wallet);
async function api(path, { method = 'GET', body, cookie: sessionCookie, key, headers = {} } = {}) {
  const response = await fetch(origin + path, { method, headers: {
    ...(body !== undefined ? { 'content-type': 'application/json', 'x-rivals-bounty': '1' } : {}),
    ...(sessionCookie ? { cookie: sessionCookie } : {}), ...(key ? { 'idempotency-key': key } : {}), ...headers,
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function activeTask(overrides) {
  const task = await service.createTask(reviewer, taskData(overrides));
  return service.changeTaskStatus(reviewer, String(task._id), { status: 'active' });
}
async function submitted(user, task, overrides = {}) {
  return service.submit(user._id, String(task._id), { postUrl: `https://x.com/player/status/${++counter}`,
    evidenceUrl: 'https://evidence.example.com/analytics', evidenceNotes: 'Ownership and engagement analytics', confirmed: true, ...overrides }, 'test-network');
}
async function funded(user, rewardMicros = '10000000') {
  const task = await activeTask({ rewardMicros });
  const submission = await submitted(user, task);
  await service.reviewSubmission(reviewer, String(submission._id), approval);
  return submission;
}
async function authorized(user, key = 'withdrawal-key-00001', amountMicros = '5000000') {
  const withdrawal = await service.requestWithdrawal(user._id, key, { amountMicros, address, confirmed: true });
  await service.reviewWithdrawal(reviewer, String(withdrawal._id), { decision: 'approve', notes: 'Destination and source reviewed.' });
  return String(withdrawal._id);
}
test('HTTP complete workflow: admin task → pending → exactly-once reward → authorized verified payout', async () => {
  const user = await player(), admin = adminCookie();
  let response = await api('/api/admin/bounties/tasks', { method: 'POST', cookie: admin, body: taskData() });
  assert.equal(response.status, 201); const taskId = response.body._id;
  response = await api(`/api/admin/bounties/tasks/${taskId}/status`, { method: 'PATCH', cookie: admin, body: { status: 'active' } });
  assert.equal(response.status, 200);
  response = await api('/api/bounties/tasks', { cookie: cookie(user) });
  assert.equal(response.body.items.length, 1);
  response = await api(`/api/bounties/tasks/${taskId}/submissions`, { method: 'POST', cookie: cookie(user), body: {
    postUrl: 'https://twitter.com/player/status/98765?tracking=1', evidenceUrl: 'https://evidence.example.com/analytics', confirmed: true } });
  assert.equal(response.status, 201); assert.equal(response.body.status, 'pending');
  assert.equal(response.body.ipHash, undefined); const submissionId = response.body._id;
  response = await api('/api/bounties/wallet', { cookie: cookie(user) });
  assert.equal(response.body.pendingMicros, '10000000'); assert.equal(response.body.availableMicros, '0');
  response = await api(`/api/admin/bounties/submissions/${submissionId}/review`, { method: 'POST', cookie: admin, body: approval });
  assert.equal(response.status, 200); assert.equal(response.body.status, 'approved');
  response = await api(`/api/admin/bounties/submissions/${submissionId}/review`, { method: 'POST', cookie: admin, body: approval });
  assert.equal(response.status, 200);
  response = await api('/api/bounties/wallet', { cookie: cookie(user) });
  assert.equal(response.body.availableMicros, '10000000'); assert.equal(response.body.earnedMicros, '10000000');
  assert.equal(response.body.pendingMicros, '0');
  const request = { method: 'POST', cookie: cookie(user), key: 'http-withdrawal-00001', body: { amountMicros: '5000000', address, confirmed: true } };
  response = await api('/api/bounties/withdrawals', request); assert.equal(response.status, 201);
  const withdrawalId = response.body._id;
  assert.equal((await api('/api/bounties/withdrawals', request)).body._id, withdrawalId);
  response = await api(`/api/admin/bounties/withdrawals/${withdrawalId}/execute`, { method: 'POST', cookie: admin, body: {} });
  assert.equal(response.status, 409); // No payout before authorization.
  response = await api(`/api/admin/bounties/withdrawals/${withdrawalId}/review`, { method: 'POST', cookie: admin, body: { decision: 'approve', notes: 'Verified payout destination.' } });
  assert.equal(response.status, 200);
  chain.outcome = 'paid';
  response = await api(`/api/admin/bounties/withdrawals/${withdrawalId}/execute`, { method: 'POST', cookie: admin, body: {} });
  assert.equal(response.status, 200); assert.equal(response.body.status, 'paid'); assert.equal(response.body.rawTransaction, undefined);
  await api(`/api/admin/bounties/withdrawals/${withdrawalId}/execute`, { method: 'POST', cookie: admin, body: {} });
  assert.equal(chain.broadcasts.size, 1);
  response = await api('/api/bounties/wallet', { cookie: cookie(user) });
  assert.equal(response.body.availableMicros, '5000000'); assert.equal(response.body.reservedMicros, '0'); assert.equal(response.body.withdrawnMicros, '5000000');
  response = await api('/api/bounties/ledger', { cookie: cookie(user) });
  assert.deepEqual(response.body.items.map(v => v.kind).sort(), ['reward', 'withdrawal_paid', 'withdrawal_reserved']);
  response = await api('/api/bounties/notifications', { cookie: cookie(user) });
  for (const kind of ['published', 'received', 'approved', 'credited', 'withdrawal']) assert.ok(response.body.items.some(n => n.kind === kind));
  assert.equal((await api('/api/bounties/notifications/read', { method: 'POST', cookie: cookie(user), body: {} })).status, 200);
  assert.ok((await api('/api/bounties/notifications', { cookie: cookie(user) })).body.items.every(n => n.read));
  assert.ok(await models.BountyAudit.countDocuments({ action: 'payout_paid' }));
});
test('authorization, revoked admin cookies, CSRF, strict validation and private histories', async () => {
  const a = await player(), b = await player();
  for (const path of ['/api/bounties/tasks', '/api/bounties/wallet', '/api/admin/bounties/tasks']) assert.equal((await api(path)).status, 401);
  assert.equal((await api('/api/admin/bounties/tasks', { cookie: cookie(a) })).status, 401);
  await RevokedToken.create({ jti: 'revoked-bounty-admin', kind: 'admin', expiresAt: new Date(Date.now() + 60000) });
  assert.equal((await api('/api/admin/bounties/tasks', { cookie: adminCookie('revoked-bounty-admin') })).status, 401);
  let r = await api('/api/admin/bounties/tasks', { method: 'POST', cookie: adminCookie(), body: taskData(), headers: { 'x-rivals-bounty': '' } });
  assert.equal(r.status, 403);
  r = await api('/api/admin/bounties/tasks', { method: 'POST', cookie: adminCookie(), body: { ...taskData(), playerId: String(a._id) } });
  assert.equal(r.status, 400);
  await funded(a);
  assert.equal((await api('/api/bounties/submissions', { cookie: cookie(b) })).body.items.length, 0);
  assert.equal((await api('/api/bounties/ledger', { cookie: cookie(b) })).body.items.length, 0);
  assert.equal((await api('/api/bounties/wallet?playerId=' + a._id, { cookie: cookie(b) })).body.availableMicros, '0');
  assert.equal((await api('/api/bounties/tasks/not-an-id', { cookie: cookie(a) })).status, 400);
});
test('duplicate account/task and cross-account post aliases rejected, including concurrent submissions', async () => {
  const a = await player(), b = await player(), task = await activeTask();
  const first = await submitted(a, task, { postUrl: 'https://twitter.com/alice/status/12345?s=1' });
  assert.equal(first.status, 'pending');
  await assert.rejects(submitted(a, task), /already_submitted/);
  await assert.rejects(submitted(b, task, { postUrl: 'https://x.com/other/status/12345' }), /post_already_submitted/);
  const c = await player(), d = await player();
  const results = await Promise.allSettled([submitted(c, task, { postUrl: 'https://x.com/a/status/67890' }), submitted(d, task, { postUrl: 'https://x.com/b/status/67890' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await models.BountySubmission.countDocuments({ postKey: 'x:67890' }), 1);
});
test('published terms are snapshotted; insufficient manual verification never credits rewards', async () => {
  const user = await player(), task = await activeTask();
  const submission = await submitted(user, task);
  await service.editTask(reviewer, String(task._id), taskData({ rewardMicros: '15000000', minimumEngagement: 10000 }));
  await assert.rejects(service.reviewSubmission(reviewer, String(submission._id), { ...approval, observedEngagement: 4999 }), /engagement_requirement/);
  await assert.rejects(service.reviewSubmission(reviewer, String(submission._id), { decision: 'approve' }), /invalid_request/);
  await service.reviewSubmission(reviewer, String(submission._id), approval);
  assert.equal((await service.wallet(user._id)).earnedMicros, 10_000_000n);
  assert.equal((await models.BountySubmission.findById(submission._id)).terms.minimumEngagement, 5000);
});
test('concurrent approvals credit exactly once; ledger append failure rolls everything back', async () => {
  const user = await player(), task = await activeTask(), sub = await submitted(user, task);
  await Promise.all(Array.from({ length: 6 }, () => service.reviewSubmission(reviewer, String(sub._id), approval)));
  assert.equal((await service.wallet(user._id)).earnedMicros, 10_000_000n);
  assert.equal(await models.BountyLedger.countDocuments({ kind: 'reward' }), 1);
  const other = await player(), sub2 = await submitted(other, task);
  const original = models.BountyLedger.create;
  models.BountyLedger.create = async () => { throw new Error('injected ledger failure'); };
  try { await assert.rejects(service.reviewSubmission(reviewer, String(sub2._id), approval), /injected ledger failure/); }
  finally { models.BountyLedger.create = original; }
  assert.equal((await models.BountySubmission.findById(sub2._id)).status, 'pending');
  assert.equal((await service.wallet(other._id)).availableMicros, 0n);
  assert.equal((await service.wallet(other._id)).pendingMicros, 10_000_000n);
});
test('budget and participation caps survive concurrency; rejection releases commitment but never permits resubmission', async () => {
  const task = await activeTask({ budgetMicros: '10000000' }), a = await player(), b = await player();
  const results = await Promise.allSettled([submitted(a, task), submitted(b, task)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const first = results.find(r => r.status === 'fulfilled').value;
  await service.reviewSubmission(reviewer, String(first._id), { decision: 'reject', reason: 'Ownership was not verified.' });
  assert.equal((await service.wallet(first.playerId)).pendingMicros, 0n);
  await assert.rejects(service.submit(first.playerId, String(task._id), { postUrl: `https://x.com/a/status/${++counter}`, evidenceUrl: 'https://evidence.example.com/a', confirmed: true }, 'test-network'), /already_submitted/);
  const loser = String(first.playerId) === String(a._id) ? b : a;
  await submitted(loser, task);
  const limited = await activeTask({ participationLimit: 1 });
  await submitted(a, limited); await assert.rejects(submitted(b, limited), /participation_limit/);
  await service.changeTaskStatus(reviewer, String(limited._id), { status: 'paused' });
  await assert.rejects(submitted(await player(), limited), /task_not_active/);
});
test('TikTok initial requirement/reward and supporting evidence are enforced', async () => {
  const user = await player(), task = await activeTask({ platform: 'tiktok', rewardMicros: '5000000' });
  await assert.rejects(submitted(user, task), /invalid_post_url/);
  await assert.rejects(submitted(user, task, { postUrl: 'https://www.tiktok.com/@player/video/12345', evidenceUrl: '' }), /evidence_required/);
  const sub = await submitted(user, task, { postUrl: 'https://www.tiktok.com/@player/video/12345' });
  await service.reviewSubmission(reviewer, String(sub._id), approval);
  assert.equal((await service.wallet(user._id)).availableMicros, 5_000_000n);
});
test('concurrent withdrawals cannot overspend; idempotency conflicts and minimums rejected', async () => {
  const user = await player(); await funded(user);
  const results = await Promise.allSettled(Array.from({ length: 4 }, (_, i) => service.requestWithdrawal(user._id, `concurrent-key-${i}0000`, { amountMicros: '5000000', address, confirmed: true })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 2);
  const account = await service.wallet(user._id); assert.equal(account.availableMicros, 0n); assert.equal(account.reservedMicros, 10_000_000n);
  await assert.rejects(service.requestWithdrawal(user._id, 'minimum-key-000000', { amountMicros: '4999999', address, confirmed: true }), /invalid_request/);
  const first = results.find(r => r.status === 'fulfilled').value;
  await assert.rejects(service.requestWithdrawal(user._id, first.requestKey, { amountMicros: '6000000', address, confirmed: true }), /idempotency_key_conflict/);
  await service.reviewWithdrawal(reviewer, String(first._id), { decision: 'reject', reason: 'Destination not verified.' });
  assert.equal((await service.wallet(user._id)).availableMicros, 5_000_000n);
});
test('signing failure cannot reserve a treasury nonce; unsigned authorization can be safely cancelled', async () => {
  const user = await player(); await funded(user); const id = await authorized(user);
  const originalPrepare = chain.prepare;
  chain.prepare = async () => { throw new Error('treasury RPC unavailable before signing'); };
  await assert.rejects(service.executeWithdrawal(reviewer, id, chain), /RPC unavailable/);
  assert.equal((await models.BountyWithdrawal.findById(id)).status, 'approved');
  assert.equal((await models.BountyTreasuryLane.findById('base-usdc')).activeWithdrawalId, null);
  assert.equal((await service.wallet(user._id)).reservedMicros, 5_000_000n);
  chain.prepare = originalPrepare;
  await service.reviewWithdrawal(reviewer, id, { decision: 'reject', reason: 'Unsigned payout cancelled; treasury needs funding.' });
  assert.equal((await service.wallet(user._id)).availableMicros, 10_000_000n);
  assert.equal(chain.broadcasts.size, 0);
});
test('cancellation racing payout preparation never refunds a signed intent', async () => {
  const user = await player(); await funded(user); const id = await authorized(user);
  const results = await Promise.allSettled([
    service.executeWithdrawal(reviewer, id, chain),
    service.reviewWithdrawal(reviewer, id, { decision: 'reject', reason: 'Cancel before signing only.' }),
  ]);
  assert.ok(results.some(r => r.status === 'fulfilled'));
  const withdrawal = await models.BountyWithdrawal.findById(id).select('+rawTransaction');
  const account = await service.wallet(user._id);
  if (withdrawal.rawTransaction) {
    assert.equal(account.availableMicros, 5_000_000n); assert.equal(account.reservedMicros, 5_000_000n);
    assert.ok(['prepared', 'broadcast'].includes(withdrawal.status));
  } else {
    assert.equal(withdrawal.status, 'rejected'); assert.equal(account.reservedMicros, 0n);
    assert.equal(account.availableMicros, 10_000_000n); assert.equal(chain.broadcasts.size, 0);
  }
});
test('micro-unit values are BSON Int64 and APIs never expose signing bytes', async () => {
  const user = await player(); await funded(user, '10000001');
  const [types] = await models.BountyAccount.aggregate([{ $project: { availableType: { $type: '$availableMicros' }, earnedType: { $type: '$earnedMicros' } } }]);
  assert.equal(types.availableType, 'long'); assert.equal(types.earnedType, 'long');
  assert.equal((await api('/api/bounties/wallet', { cookie: cookie(user) })).body.availableMicros, '10000001');
  const id = await authorized(user);
  await service.executeWithdrawal(reviewer, id, chain);
  assert.ok((await models.BountyWithdrawal.findById(id).select('+rawTransaction')).rawTransaction);
  for (const [path, sessionCookie] of [['/api/bounties/withdrawals', cookie(user)], ['/api/admin/bounties/withdrawals', adminCookie()]]) {
    const result = await api(path, { cookie: sessionCookie });
    assert.equal(result.status, 200); assert.equal(result.body.items[0].rawTransaction, undefined);
    assert.equal(result.body.items[0].amountMicros, '5000000');
  }
});
test('accepted-but-timed-out broadcast survives restart; uncertainty never releases funds or creates a new payment', async () => {
  const user = await player(); await funded(user); const id = await authorized(user);
  chain.throwBroadcast = true; chain.throwInspect = true;
  const initial = await service.executeWithdrawal(reviewer, id, chain);
  assert.equal(initial.status, 'prepared');
  assert.equal((await service.wallet(user._id)).reservedMicros, 5_000_000n);
  const durable = await models.BountyWithdrawal.findById(id).select('+rawTransaction');
  assert.equal(keccak256(durable.rawTransaction), durable.txHash);
  const preparations = chain.preparations;
  chain.throwInspect = false; chain.throwBroadcast = false;
  await Promise.all([service.executeWithdrawal(reviewer, id, chain), service.executeWithdrawal(reviewer, id, chain)]);
  assert.equal(chain.preparations, preparations); assert.equal(chain.broadcasts.size, 1);
  assert.equal((await service.wallet(user._id)).reservedMicros, 5_000_000n);
  chain.outcome = 'paid';
  await Promise.all([service.reconcileWithdrawal(reviewer, id, chain), service.reconcileWithdrawal(reviewer, id, chain)]);
  assert.equal(await models.BountyLedger.countDocuments({ kind: 'withdrawal_paid' }), 1);
  assert.equal((await service.wallet(user._id)).withdrawnMicros, 5_000_000n);
});
test('treasury serializes nonces; only a finalized reverted transaction can release signed payout funds', async () => {
  const user = await player(); await funded(user);
  const a = await authorized(user, 'first-withdrawal-key'), b = await authorized(user, 'other-withdrawal-key');
  await service.executeWithdrawal(reviewer, a, chain);
  await assert.rejects(service.executeWithdrawal(reviewer, b, chain), /treasury_busy/);
  await assert.rejects(service.reviewWithdrawal(reviewer, a, { decision: 'reject', reason: 'Do not release signed intent.' }), /already_reviewed/);
  assert.equal((await service.wallet(user._id)).reservedMicros, 10_000_000n);
  chain.outcome = 'reverted';
  await service.reconcileWithdrawal(reviewer, a, chain);
  await service.reconcileWithdrawal(reviewer, a, chain);
  assert.equal((await service.wallet(user._id)).availableMicros, 5_000_000n);
  assert.equal(await models.BountyLedger.countDocuments({ eventKey: `release:${a}` }), 1);
  chain.outcome = 'paid'; await service.executeWithdrawal(reviewer, b, chain);
  assert.equal((await service.wallet(user._id)).withdrawnMicros, 5_000_000n);
});
test('risk flags require manual acknowledgement; durable rate limiting and append-only ledger guards', async () => {
  const a = await player({ email: 'shared@example.com' }); await player({ email: 'shared@example.com' });
  const task = await activeTask(), sub = await submitted(a, task);
  assert.ok(sub.riskFlags.includes('shared_account_email'));
  await assert.rejects(service.reviewSubmission(reviewer, String(sub._id), approval), /risk_acknowledgement_required/);
  await service.reviewSubmission(reviewer, String(sub._id), { ...approval, acknowledgeRisk: true });
  const w = await service.requestWithdrawal(a._id, 'flagged-account-key', { amountMicros: '5000000', address, confirmed: true });
  await assert.rejects(service.reviewWithdrawal(reviewer, String(w._id), { decision: 'approve', notes: 'Reviewed.' }), /risk_acknowledgement_required/);
  await service.consumeRate('test-limit', 1); await assert.rejects(service.consumeRate('test-limit', 1), /rate_limited/);
  await assert.rejects(models.BountyLedger.updateOne({}, { $set: { amountMicros: 0n } }), /immutable_bounty_ledger/);
  await assert.rejects(models.BountyLedger.deleteMany({}), /immutable_bounty_ledger/);
});
test('standalone admin summaries, searchable earnings and private player histories use exact server records', async () => {
  const admin = adminCookie(), a = await player({ email: 'creator-alpha@example.com' }), b = await player({ email: 'creator-beta@example.com' });
  let response = await api('/api/admin/bounties/summary', { cookie: admin });
  assert.equal(response.status, 200); assert.equal(response.body.rewardsIssuedMicros, '0'); assert.equal(response.body.activeBounties, 0);
  const sub = await funded(a, '10000001'); await funded(b, '5000000');
  const withdrawal = await service.requestWithdrawal(a._id, 'admin-earnings-test-key', { amountMicros: '5000000', address, confirmed: true });
  response = await api('/api/admin/bounties/summary', { cookie: admin });
  assert.equal(response.status, 200); assert.equal(response.body.activeBounties, 2); assert.equal(response.body.approvedSubmissions, 2);
  assert.equal(response.body.rewardsIssuedMicros, '15000001'); assert.equal(response.body.outstandingMicros, '15000001');
  assert.equal(response.body.reservedMicros, '5000000'); assert.equal(response.body.withdrawnMicros, '0'); assert.equal(response.body.pendingWithdrawals, 1);
  response = await api('/api/admin/bounties/players?q=creator-alpha', { cookie: admin });
  assert.equal(response.status, 200); assert.equal(response.body.items.length, 1); assert.equal(response.body.items[0].player.email, a.email);
  assert.equal(response.body.items[0].approvedTasks, 1); assert.equal(response.body.items[0].availableMicros, '5000001');
  response = await api('/api/admin/bounties/players?q=%28', { cookie: admin });
  assert.equal(response.status, 200); assert.equal(response.body.items.length, 0); // literal search, no regex injection
  response = await api('/api/admin/bounties/players?limit=1', { cookie: admin });
  assert.equal(response.body.items.length, 1); assert.ok(response.body.nextBefore);
  const next = await api('/api/admin/bounties/players?limit=1&before=' + response.body.nextBefore, { cookie: admin });
  assert.equal(next.body.items.length, 1); assert.notEqual(next.body.items[0]._id, response.body.items[0]._id);
  response = await api(`/api/admin/bounties/players/${a._id}/ledger`, { cookie: admin });
  assert.equal(response.status, 200); assert.equal(response.body.items.length, 2);
  response = await api(`/api/admin/bounties/players/${a._id}`, { cookie: admin });
  assert.equal(response.body.wallet.earnedMicros, '10000001'); assert.equal(response.body.approvedTasks, 1);
  response = await api('/api/admin/bounties/submissions?status=approved&q=creator-alpha', { cookie: admin });
  assert.equal(response.status, 200); assert.equal(response.body.items.length, 1); assert.equal(response.body.items[0]._id, String(sub._id));
  response = await api('/api/admin/bounties/withdrawals?status=pending&q=creator-alpha', { cookie: admin });
  assert.equal(response.body.items[0]._id, String(withdrawal._id)); assert.equal(response.body.items[0].wallet.reservedMicros, '5000000');
  assert.equal(response.body.items[0].rawTransaction, undefined);
  for (const path of ['/api/admin/bounties/summary', '/api/admin/bounties/players', `/api/admin/bounties/players/${a._id}/ledger`]) {
    assert.equal((await api(path, { cookie: cookie(a) })).status, 401);
  }
});
test('scheduled campaigns are server-gated and stale opened briefs cannot silently change the accepted reward', async () => {
  const user = await player(), future = new Date(Date.now() + 3600000).toISOString();
  const scheduled = await activeTask({ startsAt: future, expiresAt: new Date(Date.now() + 7200000).toISOString() });
  let response = await api('/api/bounties/tasks', { cookie: cookie(user) });
  assert.equal(response.body.items.length, 0);
  await assert.rejects(submitted(user, scheduled), /task_outside_schedule/);
  const task = await activeTask();
  await service.editTask(reviewer, String(task._id), taskData({ rewardMicros: '5000000' }));
  await assert.rejects(submitted(user, task, { termsRevision: 1 }), /task_terms_changed/);
  const sub = await submitted(user, task, { termsRevision: 2 }); assert.equal(sub.terms.rewardMicros, 5_000_000n);
  await service.reviewSubmission(reviewer, String(sub._id), approval);
  await models.BountyTask.updateOne({ _id: task._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  response = await api('/api/bounties/tasks', { cookie: cookie(user) });
  assert.equal(response.body.items.length, 0);
  assert.equal((await service.wallet(user._id)).earnedMicros, 5_000_000n); // expiration does not invalidate accepted terms
  await assert.rejects(service.changeTaskStatus(reviewer, String(task._id), { status: 'paused' }).then(() => service.changeTaskStatus(reviewer, String(task._id), { status: 'active' })), /task_expired/);
});
test('operational totals remain exact when summed accounts exceed the BSON Int64 range', async () => {
  const amount = 9_000_000_000_000_000n;
  await models.BountyAccount.insertMany(Array.from({ length: 1100 }, () => ({ playerId: new mongoose.Types.ObjectId(), availableMicros: amount, earnedMicros: amount })));
  const response = await api('/api/admin/bounties/summary', { cookie: adminCookie() });
  assert.equal(response.status, 200);
  assert.equal(response.body.rewardsIssuedMicros, (1100n * amount).toString());
  assert.equal(response.body.outstandingMicros, (1100n * amount).toString());
  assert.equal(response.body.reservedMicros, '0');
});
