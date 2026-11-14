import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { request } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Never read a developer's credentials or connect to an inherited database.
process.env.DOTENV_CONFIG_PATH = 'test/nonexistent-bachs-env';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'bachs-webhook-test-only-session-secret';
const secret = 'whsec_bachs_webhook_test_only_not_a_real_credential';
process.env.BACHS_WEBHOOK_SECRET = secret;
await import('../src/db/mongo.js');
const { env } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');
const { BachsWebhookEvent } = await import('../src/payments/models.js');
let mongo, server, origin, ready = true, serial = 0;
const logs = [];
const path = '/api/payments/bachs/webhook';
const fixture = (type = 'collection.succeeded', extra = {}) => ({
  id: 'evt_bachs_test_' + ++serial, type, created_at: new Date().toISOString(),
  organization_id: 'acct_bachs_test', data: { checkout_id: 'chk_test_only',
    customer: { email: 'private-customer@example.invalid' },
    payment_method_details: { bank_account: 'sensitive-bank-details' },
    metadata: { '$preserve': 'untouched', 'original.key': 'utf8 café 🎮' } }, ...extra,
});
const digest = (bytes, timestamp, key = secret) => createHmac('sha256', key)
  .update(String(timestamp) + '.').update(bytes).digest('hex');
const v2 = (bytes, timestamp = Math.floor(Date.now() / 1000), key = secret) =>
  `t=${timestamp},v1=${digest(bytes, timestamp, key)}`;
async function send(body, { headers = {}, sign = true } = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const response = await fetch(origin + path, { method: 'POST', headers: {
    'content-type': 'application/json', ...(sign ? { 'x-bachs-signature-v2': v2(bytes) } : {}), ...headers,
  }, body: bytes });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function listen(app) {
  const listener = app.listen(0, '127.0.0.1');
  await new Promise(resolve => listener.once('listening', resolve));
  return listener;
}
before(async () => {
  const binary = fileURLToPath(new URL('../.cache/test-mongodb/mongod.exe', import.meta.url));
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.24',
    ...(process.platform === 'win32' && existsSync(binary) ? { systemBinary: binary } : {}) },
    instance: { ip: '127.0.0.1' } });
  await mongoose.connect(mongo.getUri(), { dbName: 'rivals-bachs-webhook-isolated-tests' });
  await BachsWebhookEvent.createCollection(); await BachsWebhookEvent.createIndexes();
  server = await listen(createApp(() => ready, { bachsWebhookLogger: entry => logs.push(entry) }));
  origin = 'http://127.0.0.1:' + server.address().port;
}, { timeout: 120000 });
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); await mongo?.stop();
});
beforeEach(async () => {
  await BachsWebhookEvent.deleteMany({}); logs.length = 0;
  ready = true; env.bachsWebhookSecret = secret;
});

for (const [type, outcome] of [['collection.succeeded', 'payment_succeeded'],
  ['collection.failed', 'payment_failed'], ['checkout.expired', 'checkout_expired']]) {
  test('verifies and durably records ' + type + ' without fulfillment', async () => {
    const event = fixture(type), bytes = Buffer.from(JSON.stringify(event, null, 2) + '\n');
    const result = await send(bytes);
    assert.equal(result.status, 200); assert.deepEqual(result.body, { received: true, ignored: false });
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
    const row = await BachsWebhookEvent.findById(event.id).lean();
    assert.equal(row.outcome, outcome); assert.equal(row.type, type); assert.equal(row.purpose, 'receipt_only');
    assert.equal(row.organizationId, event.organization_id);
    assert.equal(row.payloadSha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(Object.keys(row).sort(), ['_id', 'organizationId', 'outcome', 'payloadSha256', 'purpose', 'receivedAt', 'type']);
    const collections = await mongoose.connection.db.listCollections().toArray();
    assert.deepEqual(collections.map(c => c.name), ['bachswebhookevents'], 'no account, balance, product or gameplay writes');
    assert.equal(logs.at(-1).outcome, outcome);
  });
}

test('checks original bytes: reserialization, whitespace changes and wrong signing keys fail', async () => {
  const event = fixture(), pretty = JSON.stringify(event, null, 2), compact = JSON.stringify(event);
  for (const [body, signature] of [[compact, v2(pretty)], [pretty + ' ', v2(pretty)], [pretty, v2(pretty, undefined, 'wrong-secret')]]) {
    const result = await send(body, { headers: { 'x-bachs-signature-v2': signature } });
    assert.equal(result.status, 400); assert.equal(result.body.error, 'invalid_webhook');
  }
  assert.equal(await BachsWebhookEvent.countDocuments(), 0);
});

test('rejects unsigned requests and stale/future replay timestamps', async () => {
  const bytes = JSON.stringify(fixture()), now = Math.floor(Date.now() / 1000);
  assert.equal((await send(bytes, { sign: false })).status, 400);
  for (const timestamp of [now - 600, now + 600]) {
    assert.equal((await send(bytes, { headers: { 'x-bachs-signature-v2': v2(bytes, timestamp) } })).status, 400);
  }
  assert.equal(await BachsWebhookEvent.countDocuments(), 0);
});

test('supports SDK legacy signatures and multiple V2 rotation signatures', async () => {
  const bytes = JSON.stringify(fixture()), timestamp = Math.floor(Date.now() / 1000);
  assert.equal((await send(bytes, { sign: false, headers: { 'x-bachs-timestamp': String(timestamp),
    'x-bachs-signature': digest(bytes, timestamp) } })).status, 200);
  const other = JSON.stringify(fixture());
  assert.equal((await send(other, { headers: { 'x-bachs-signature-v2':
    `t=${timestamp},v1=${'0'.repeat(64)},v1=${digest(other, timestamp)}` } })).status, 200);
});

test('malformed V2 cannot fall back to an otherwise valid legacy signature', async () => {
  const bytes = JSON.stringify(fixture()), timestamp = Math.floor(Date.now() / 1000);
  const result = await send(bytes, { headers: { 'x-bachs-signature-v2': 'malformed',
    'x-bachs-timestamp': String(timestamp), 'x-bachs-signature': digest(bytes, timestamp) } });
  assert.equal(result.status, 400); assert.equal(await BachsWebhookEvent.countDocuments(), 0);
});

test('rejects duplicate physical HTTP signature headers', async () => {
  const bytes = JSON.stringify(fixture()), signature = v2(bytes);
  const status = await new Promise((resolve, reject) => {
    const req = request(origin + path, { method: 'POST', headers: [
      'Content-Type', 'application/json', 'X-Bachs-Signature-V2', signature,
      'X-Bachs-Signature-V2', signature,
    ] }, res => { res.resume(); res.once('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.end(bytes);
  });
  assert.equal(status, 400); assert.equal(await BachsWebhookEvent.countDocuments(), 0);
});

test('rejects signed malformed JSON, invalid UTF-8 and invalid event envelopes', async () => {
  for (const bytes of ['{', '{}', JSON.stringify(fixture('collection.succeeded', { data: null })),
    JSON.stringify(fixture('collection.succeeded', { id: 'x'.repeat(257) })), Buffer.from([0xff, 0xfe])]) {
    assert.equal((await send(bytes)).status, 400);
  }
  assert.equal(await BachsWebhookEvent.countDocuments(), 0);
});

test('rejects oversized, non-JSON and compressed bodies without logging raw parser errors', async () => {
  assert.equal((await send('x'.repeat(65537))).status, 413);
  assert.equal((await send(JSON.stringify(fixture()), { headers: { 'content-type': 'text/plain' } })).status, 415);
  const compressed = gzipSync(JSON.stringify(fixture()));
  assert.equal((await send(compressed, { headers: { 'content-encoding': 'gzip' } })).status, 415);
  assert.equal(await BachsWebhookEvent.countDocuments(), 0);
});

test('concurrent redeliveries across instances create one receipt and no repeated effects', async () => {
  const event = fixture(), bytes = JSON.stringify(event);
  const second = await listen(createApp(() => true, { bachsWebhookLogger: entry => logs.push(entry) }));
  try {
    const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => fetch(
      (i % 2 ? origin : 'http://127.0.0.1:' + second.address().port) + path,
      { method: 'POST', headers: { 'content-type': 'application/json', 'x-bachs-signature-v2': v2(bytes) }, body: bytes },
    )));
    assert.ok(responses.every(r => r.status === 200));
    const bodies = await Promise.all(responses.map(r => r.json()));
    assert.equal(bodies.filter(r => r.duplicate === true).length, 19);
    assert.equal(await BachsWebhookEvent.countDocuments(), 1);
    assert.equal(logs.filter(row => row.outcome === 'payment_succeeded').length, 1);
  } finally { await new Promise(resolve => second.close(resolve)); }
});

test('deduplication survives HTTP server recreation and keeps the first receipt unchanged', async () => {
  const event = fixture(), bytes = JSON.stringify(event);
  assert.equal((await send(bytes)).status, 200);
  const original = await BachsWebhookEvent.findById(event.id).lean();
  await new Promise(resolve => server.close(resolve));
  server = await listen(createApp(() => ready, { bachsWebhookLogger: entry => logs.push(entry) }));
  origin = 'http://127.0.0.1:' + server.address().port;
  assert.deepEqual((await send(JSON.stringify(event, null, 2))).body, { received: true, duplicate: true });
  assert.deepEqual(await BachsWebhookEvent.findById(event.id).lean(), original);
  assert.equal((await send(bytes, { sign: false })).status, 400, 'duplicates still require signature verification');
});

test('a signed conflicting event ID never overwrites the original receipt', async () => {
  const event = fixture(); await send(JSON.stringify(event));
  for (const conflict of [{ ...event, type: 'collection.failed' }, { ...event, organization_id: 'acct_other' }]) {
    assert.equal((await send(JSON.stringify(conflict))).status, 409);
  }
  assert.equal((await BachsWebhookEvent.findById(event.id)).outcome, 'payment_succeeded');
});

test('unknown verified events are ignored, not treated as successful payments', async () => {
  const event = fixture('checkout.completed');
  assert.deepEqual((await send(JSON.stringify(event))).body, { received: true, ignored: true });
  assert.equal((await BachsWebhookEvent.findById(event.id)).outcome, 'ignored');
});

test('missing signing secret fails closed without breaking existing app startup', async () => {
  env.bachsWebhookSecret = null;
  assert.equal((await send(JSON.stringify(fixture()))).status, 503);
  assert.equal((await fetch(origin + '/ping')).status, 200);
  assert.equal(await BachsWebhookEvent.countDocuments(), 0);
});

test('database unavailability is retryable, never acknowledged as received', async () => {
  const bytes = JSON.stringify(fixture()); ready = false;
  assert.equal((await send(bytes)).status, 503);
  assert.equal((await send(bytes, { sign: false })).status, 400);
  ready = true; assert.equal((await send(bytes)).status, 200);
});

test('write failures and uncertain outcomes remain retryable and safe', async t => {
  const event = fixture(), bytes = JSON.stringify(event);
  const insertion = t.mock.method(BachsWebhookEvent, 'create', async () => { throw Error(secret + ' sensitive-bank-details'); });
  assert.equal((await send(bytes)).status, 503);
  assert.equal(await BachsWebhookEvent.countDocuments(), 0);
  insertion.mock.restore(); assert.equal((await send(bytes)).status, 200);
  // A lost HTTP acknowledgement after a successful write resolves as duplicate.
  assert.equal((await send(bytes)).body.duplicate, true);
});

test('unexpected async handler failures are sanitized and retryable, not unhandled rejections', async () => {
  const secondLogs = [], second = await listen(createApp(() => { throw Error(secret); }, {
    bachsWebhookLogger: entry => secondLogs.push(entry),
  }));
  try {
    const bytes = JSON.stringify(fixture());
    const response = await fetch('http://127.0.0.1:' + second.address().port + path, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bachs-signature-v2': v2(bytes) }, body: bytes });
    assert.equal(response.status, 500); assert.deepEqual(await response.json(), { error: 'webhook_failed' });
    assert.equal(secondLogs[0].outcome, 'handler_error');
    assert.equal(JSON.stringify(secondLogs).includes(secret), false);
  } finally { await new Promise(resolve => second.close(resolve)); }
});

test('a duplicate is not acknowledged unless the first receipt is majority-visible', async t => {
  t.mock.method(BachsWebhookEvent, 'create', async () => { throw Object.assign(Error('duplicate'), { code: 11000 }); });
  let concern;
  t.mock.method(BachsWebhookEvent, 'findById', () => ({ select: () => ({ readConcern: value => {
    concern = value; return { lean: async () => null };
  } }) }));
  assert.equal((await send(JSON.stringify(fixture()))).status, 503);
  assert.equal(concern, 'majority');
});

test('webhooks use signature authentication, not player cookies, browser CORS or CSRF', async () => {
  assert.equal((await send(JSON.stringify(fixture()), { headers: { origin: 'https://bachs.example.invalid',
    'sec-fetch-site': 'cross-site' } })).status, 200);
  assert.equal((await send(JSON.stringify(fixture()), { sign: false, headers: {
    origin: 'https://bachs.example.invalid', 'sec-fetch-site': 'cross-site' } })).status, 400);
  assert.equal((await fetch(origin + '/api/auth/wallet', { method: 'POST', headers: {
    origin: 'https://bachs.example.invalid', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(origin + path)).status, 404);
  assert.equal((await fetch(origin + '/api/payments/quote', { method: 'POST' })).status, 404);
});

test('delivery logs and errors never expose payloads, signatures, secrets or customer data', async t => {
  const event = fixture(), bytes = JSON.stringify(event);
  await send(bytes); await send(bytes); await send('{');
  const insertion = t.mock.method(BachsWebhookEvent, 'create', async () => { throw Error(bytes + secret); });
  await send(JSON.stringify(fixture())); insertion.mock.restore();
  const serialized = JSON.stringify(logs);
  for (const value of [secret, bytes, event.id, event.organization_id, 'private-customer',
    'sensitive-bank-details', 'x-bachs-signature', digest(bytes, Math.floor(Date.now() / 1000))]) {
    assert.equal(serialized.includes(value), false, value);
  }
  assert.ok(logs.every(row => row.provider === 'bachs' && row.deliveryRef && Number.isInteger(row.status)));
  assert.ok(logs.some(row => row.outcome === 'duplicate'));
  assert.ok(logs.some(row => row.outcome === 'database_error'));
});
