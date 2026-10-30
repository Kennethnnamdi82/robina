import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { existsSync } from 'node:fs';
export default defineConfig(({ mode, command }) => {
  // Support the existing local src/.env without copying its values into source control.
  // An explicitly configured root environment retains standard Vite precedence.
  const root = process.cwd();
  const hasRootEnv = ['.env', '.env.local', '.env.' + mode, '.env.' + mode + '.local'].some(file => existsSync(path.join(root, file)));
  const envDir = hasRootEnv ? root : path.join(root, 'src');
  const publicEnv = loadEnv(mode, envDir, 'VITE_');
  if (command === 'build' && mode === 'production') {
    for (const key of ['VITE_API_URL', 'VITE_PRIVY_APP_ID', 'VITE_REOWN_PROJECT_ID']) {
      if (!publicEnv[key]?.trim()) throw new Error('Production configuration is missing ' + key);
    }
    const api = new URL(publicEnv.VITE_API_URL);
    if (api.protocol !== 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(api.hostname)) throw new Error('VITE_API_URL must point to the HTTPS production backend');
    const forbidden = Object.keys(publicEnv).filter(key => /SECRET|PRIVATE_KEY|PASSWORD|MONGODB|JWT_SECRET/.test(key));
    if (forbidden.length) throw new Error('Server secrets must not use the VITE_ prefix: ' + forbidden.join(', '));
  }
  return {
    envDir,
    server: { host: '::', port: 8080 },
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') }, dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@tanstack/react-query', '@tanstack/query-core'] },
    define: { global: 'globalThis', 'process.env': {} },
    optimizeDeps: { include: ['buffer', 'ethers', 'siwe'] },
    build: {
      target: 'es2021', sourcemap: false,
      rollupOptions: {
        output: {
          onlyExplicitManualChunks: false,
          manualChunks(id) {
            const normalized = id.replace(/\\/g, '/');
            if (!normalized.includes('/node_modules/')) return;
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(normalized)) return 'react-vendor';
            if (normalized.includes('/node_modules/phaser/')) return 'rivals-engine';
            if (normalized.includes('/node_modules/three/')) return 'engine-vendor';
            return 'platform-vendor';
          },
        },
      },
    },
  };
});
