import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { startPeriodicWorker } from '../src/services/periodicWorker.js';

test('readiness reflects connection loss and rejects API work without buffering', async () => {
  let ready = false;
  const server = createApp(() => ready).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    let response = await fetch(origin + '/health');
    assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
    response = await fetch(origin + '/api/auth/me');
    assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).error, 'service_unavailable');
    ready = true;
    response = await fetch(origin + '/health');
    assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
    response = await fetch(origin + '/api/auth/me');
    assert.equal(response.status, 401);
    response = await fetch(origin + '/api/auth/me', { headers: { origin: 'https://unauthorized.invalid' } });
    assert.equal(response.status, 403); assert.equal((await response.json()).error, 'untrusted_origin');
    response = await fetch(origin + '/api/auth/wallet', { method: 'POST', headers: { origin: 'https://unauthorized.invalid' } });
    assert.equal(response.status, 403);
    response = await fetch(origin + '/api/auth/wallet', { method: 'POST', headers: { origin: env.corsOrigins[0], 'content-type': 'application/json' }, body: '{' });
    assert.equal(response.status, 400);
    ready = false; response = await fetch(origin + '/health'); assert.equal(response.status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('periodic workers do not overlap and stop waits for the active run', async () => {
  let calls = 0;
  let resolveRun;
  const stop = startPeriodicWorker(() => { calls++; return new Promise(resolve => { resolveRun = resolve; }); }, 1);
  await delay(15); assert.equal(calls, 1);
  let stopped = false; const stopping = stop().then(() => { stopped = true; });
  await delay(5); assert.equal(stopped, false);
  resolveRun(); await stopping; await delay(5); assert.equal(calls, 1);
});
test('worker errors are reported and the next run can proceed', async () => {
  let calls = 0; const errors = [];
  const stop = startPeriodicWorker(async () => { calls++; if (calls === 1) throw new Error('failed run'); }, 5, error => errors.push(error.message));
  await delay(30); await stop();
  assert.deepEqual(errors, ['failed run']); assert.ok(calls > 1);
});
