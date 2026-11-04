import { createServer, build } from 'vite';
import assert from 'node:assert/strict';
delete process.env.VITE_RIVALS_3D_SANDBOX;
const server = await createServer({ configFile: 'vite.rivals3d.config.ts',cacheDir: 'node_modules/.vite-rivals3d-disabled',server: { host: '127.0.0.1',port: 8085,strictPort: true },optimizeDeps: { noDiscovery: true,include: [] } });
try {
  await server.listen();
  for (const entry of ['/', '/gaming', '/login', '/tests/rivals3d/index.html']) {
    const response = await fetch('http://127.0.0.1:8085' + entry);
    assert.equal(response.status,404); assert.match(await response.text(),/sandbox disabled/i);
  }
  console.log('PASS: missing explicit flag returns HTTP 404.');
} finally { await server.close(); }
let blocked = false;
try { await build({ configFile: 'vite.rivals3d.config.ts' }); }
catch (error) { blocked = /development-only/.test(String(error)); }
assert.equal(blocked,true,'The experimental entry must reject deployment builds.');
console.log('PASS: sandbox deployment build rejected.');
