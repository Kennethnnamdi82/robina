import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';

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

test('retired BaseDrop APIs return 404 rather than performing legacy writes', async () => {
  const server = createApp(() => true).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const paths = [
    '/api/mining/status', '/api/mining/claim', '/api/tasks/catalogue',
    '/api/tasks/submit', '/api/tasks/daily', '/api/payments/quote',
    '/api/payments/intent', '/api/payments/verify', '/api/leaderboard',
    '/api/leaderboard/top', '/api/game/start', '/api/game/reveal',
    '/api/admin/users', '/api/admin/tasks', '/api/admin/seasons',
    '/api/admin/payments', '/api/admin/analytics', '/api/admin/leaderboard',
  ];
  try {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      for (const path of paths) {
        const response = await fetch(origin + path, { method });
        assert.equal(response.status, 404, method + ' ' + path);
        assert.equal((await response.json()).error, 'not_found');
      }
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('user and owner authentication remain mounted with the same security gates', async () => {
  const server = createApp(() => true).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(origin + '/ping')).status, 200);
    for (const path of ['/api/auth/me', '/api/admin/me']) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error, 'unauthenticated');
    }
    const nonce = await fetch(origin + '/api/auth/nonce?wallet=invalid&chainType=evm');
    assert.equal(nonce.status, 400);
    assert.equal((await nonce.json()).error, 'invalid_wallet');
    for (const path of ['/api/auth/wallet', '/api/auth/verify', '/api/auth/google']) {
      const response = await fetch(origin + path, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      });
      assert.equal(response.status, 400, path);
    }
    for (const path of ['/api/auth/logout', '/api/admin/logout']) {
      const response = await fetch(origin + path, { method: 'POST' });
      assert.equal(response.status, 200, path);
      assert.equal((await response.json()).ok, true);
      assert.match(response.headers.get('set-cookie'), /bd_(session|admin)=; Path=\//);
      assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    }
    const login = await fetch(origin + '/api/admin/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.invalid', password: 'invalid' }),
    });
    assert.equal(login.status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
