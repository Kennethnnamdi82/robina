import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

// Isolated development/QA entry. Production continues to use the authenticated /gaming route.
export default defineConfig({
  cacheDir: 'node_modules/.vite-rivals', plugins: [react()],
  server: { host: '127.0.0.1', port: 8082, strictPort: true },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  optimizeDeps: { entries: ['tests/rivals/index.html'], include: ['react', 'react-dom/client', 'react-router-dom', 'lucide-react', 'phaser'] },
});
