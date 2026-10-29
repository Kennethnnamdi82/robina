import { build } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const out = path.join(root, 'test-results/rivals-preview');
await build({ configFile: path.join(root, 'vite.rivals.config.ts'), build: { outDir: out, emptyOutDir: true, copyPublicDir: false, rollupOptions: { input: path.join(root, 'tests/rivals/index.html') } } });
await fs.cp(path.join(root, 'public/assets/rivals'), path.join(out, 'assets/rivals'), { recursive: true });
console.log('Built isolated minified RIVALS QA entry. This is not the production authentication entry.');
