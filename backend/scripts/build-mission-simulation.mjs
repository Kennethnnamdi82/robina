import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
await build({ entryPoints: {missionSimulation:path.resolve(root, '../robina/src/features/rivals/authority/MissionSimulation.ts'),missionReplay:path.resolve(root, '../robina/src/features/rivals/authority/MissionReplay.ts'),missionScore:path.resolve(root,'../robina/src/features/rivals/authority/MissionScore.ts')},
  outdir: path.resolve(root, 'generated'),outExtension:{'.js':'.mjs'}, bundle: true, platform: 'node', format: 'esm',
  target: 'node22', alias: { three: path.resolve(root, 'node_modules/three/build/three.module.js') }, logLevel: 'warning' });
