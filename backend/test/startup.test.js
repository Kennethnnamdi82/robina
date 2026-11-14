import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io } from 'socket.io-client';

test('real production entrypoint cold-starts and ensures indexes before accepting mission requests', { timeout: 120000 }, async () => {
  const binary = fileURLToPath(new URL('../.cache/test-mongodb/mongod.exe', import.meta.url));
  const mongo = await MongoMemoryReplSet.create({
    binary: { version: '7.0.24', ...(process.platform === 'win32' && existsSync(binary) ? { systemBinary: binary } : {}) },
    replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ ip: '127.0.0.1' }],
  });
  let child, client, socket, output = '';
  try {
    const probe = createServer().listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const uri = mongo.getUri('isolated-production-startup');
    child = spawn(process.execPath, ['src/server.js'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, NODE_ENV: 'production', DOTENV_CONFIG_PATH: 'test/nonexistent-startup-env',
        PORT: String(port), MONGODB_URI: uri, CHAIN_ID: '4663',
        JWT_SECRET: 'startup-test-only-secret-with-32-characters',
        SIWE_DOMAIN: 'rivals.example.invalid', SIWE_URI: 'https://rivals.example.invalid',
        CORS_ORIGIN: 'https://rivals.example.invalid', COOKIE_SECURE: 'true', COOKIE_SAMESITE: 'none',
        PRIVY_APP_ID: 'test-public-app', PRIVY_APP_SECRET: 'test-only-not-a-real-credential',
        MISSION_SOCKET_ORIGIN: `http://127.0.0.1:${port}`, RENDER_EXTERNAL_URL: '', BOUNTY_BASE_RPC_URL: '',
      }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', error => { output += error.message; });
    const origin = `http://127.0.0.1:${port}`, deadline = Date.now() + 30000;
    let ready = false;
    while (Date.now() < deadline) {
      assert.equal(child.exitCode, null, output);
      try { const response = await fetch(origin + '/health', { signal: AbortSignal.timeout(500) }); ready = response.status === 200; } catch { /* Still booting. */ }
      if (ready) break;
      await delay(100);
    }
    assert.equal(ready, true, output);
    assert.equal((await fetch(origin + '/api/missions/eligibility')).status, 401);
    const transportProbe = await fetch(origin + '/socket.io/?EIO=4&transport=polling');
    assert.equal(transportProbe.status, 400, 'live socket server is attached, not a missing route');
    client = new mongoose.mongo.MongoClient(uri);
    await client.connect();
    const db = client.db('isolated-production-startup');
    const collections = await db.listCollections().toArray();
    for (const name of ['missionsessions', 'missionlives', 'verifiedmissionresults', 'bountyaccounts', 'bountyledgers']) {
      assert.ok(collections.some(row => row.name === name), name + ' must exist before transactional writes');
    }
    const indexes = await db.collection('missionsessions').indexes();
    assert.ok(indexes.some(index => index.unique && index.key.playerId === 1 && index.partialFilterExpression?.status === 'active'));
    const wallet = '0x' + 'a'.repeat(40);
    await db.collection('users').insertOne({ wallet, referralCode: 'startup-fixture', sessionVersion: 0, accountStatus: 'active' });
    const token = jwt.sign({ sub: wallet, sv: 0, started: Math.floor(Date.now() / 1000) },
      'startup-test-only-secret-with-32-characters', { issuer: 'basedrop', audience: 'basedrop-users', jwtid: 'startup-fixture', expiresIn: 60 });
    const headers = { cookie: 'bd_session=' + token, 'content-type': 'application/json' };
    const started = await fetch(origin + '/api/missions/sessions', { method: 'POST', headers,
      body: JSON.stringify({ missionId: 'assignment-reserve', seed: 42 }) });
    const startData = await started.json();
    assert.equal(started.status, 201, JSON.stringify(startData));
    const ticketResponse = await fetch(origin + `/api/missions/sessions/${startData.session._id}/connect`, { method: 'POST', headers, body: '{}' });
    const ticket = await ticketResponse.json();
    assert.equal(ticketResponse.status, 200, JSON.stringify(ticket));
    assert.equal(ticket.origin, origin);
    socket = io(origin, { transports: ['websocket'], autoConnect: false, reconnection: false, auth: { ticket: ticket.ticket } });
    const state = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Initial mission state timed out')), 10000);
      socket.once('mission:state', value => { clearTimeout(timer); resolve(value); });
      socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
      socket.connect();
    });
    assert.equal(state.health, 100);
    assert.equal(await db.collection('missioncheckpoints').countDocuments({ sessionId: new mongoose.Types.ObjectId(startData.session._id) }), 1);
  } finally {
    socket?.disconnect();
    if (child && child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; }
    await client?.close();
    await mongo.stop();
  }
});
