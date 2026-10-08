import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
export default defineConfig({ cacheDir: 'node_modules/.vite-rugfire', plugins: [react()], server: { host: '127.0.0.1', port: 8081, strictPort: true }, resolve: { alias: { '@': path.resolve(__dirname, './src') } }, optimizeDeps: { entries: ['tests/rugfire/index.html'], include: ['react', 'react-dom/client', 'react-router-dom', 'lucide-react', 'three', 'three/addons/utils/BufferGeometryUtils.js', 'three/addons/geometries/RoundedBoxGeometry.js'] } });
