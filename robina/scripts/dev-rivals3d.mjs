import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Invoking this dedicated development command explicitly enables the isolated,
// account-free sandbox. The normal website and its authentication are untouched.
const frontend = fileURLToPath(new URL('../', import.meta.url));
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
console.log('Starting RIVALS local test. No wallet or Google sign-in is required.');
const server = spawn(process.execPath, [vite, '--config', 'vite.rivals3d.config.ts', '--clearScreen', 'false', ...process.argv.slice(2)], {
  cwd: frontend,
  env: { ...process.env, VITE_RIVALS_3D_SANDBOX: 'true' },
  stdio: 'inherit',
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { server.kill(signal); });
}
