import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const production = {
  NODE_ENV: 'production',
  DOTENV_CONFIG_PATH: 'test/nonexistent-auth-env-file',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/rivals-test-not-connected',
  JWT_SECRET: 'b612bd4394c61e9f581ce8d39ad113ce376ef893',
  SIWE_DOMAIN: 'rivals.example.invalid',
  SIWE_URI: 'https://rivals.example.invalid',
  CORS_ORIGIN: 'https://rivals.example.invalid',
  PRIVY_APP_ID: 'test-public-app',
  PRIVY_APP_SECRET: 'test-only-not-a-real-credential',
  COOKIE_SECURE: 'true',
  COOKIE_SAMESITE: 'none',
};

function check(overrides = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/config/env.js')"], {
    cwd: root, env: { ...production, ...overrides }, encoding: 'utf8', timeout: 10000,
  });
}

test('production auth boots without retired treasury, token or payment RPC configuration', () => {
  const result = check();
  assert.equal(result.status, 0, result.stderr);
});

for (const [name, overrides, error] of [
  ['weak session secrets', { JWT_SECRET: 'short' }, /JWT_SECRET must be at least 32/],
  ['insecure cross-site cookies', { COOKIE_SECURE: 'false' }, /COOKIE_SAMESITE=none requires COOKIE_SECURE=true/],
  ['mismatched sign-in origins', { SIWE_DOMAIN: 'other.example.invalid' }, /SIWE_DOMAIN and SIWE_URI must match/],
  ['missing auth credentials', { PRIVY_APP_SECRET: '' }, /Missing required PRIVY_APP_SECRET/],
  ['untrusted frontend configuration', { CORS_ORIGIN: 'https://other.example.invalid' }, /CORS_ORIGIN must include/],
]) {
  test('production auth still rejects ' + name, () => {
    const result = check(overrides);
    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
  });
}
