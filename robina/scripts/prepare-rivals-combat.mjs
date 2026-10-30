import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const pack = path.join(root, 'src/features/rugfire/RIVALS/RIVALS_ALL_IN_ONE_V4');
const out = path.join(root, 'public/assets/rivals/combat');
const files = [
  ['kenney_top-down-shooter/PNG/weapon_machine.png', 'carbine.png'],
  ['kenney_top-down-shooter/License.txt', 'KENNEY_LICENSE.txt'],
  ['01_V4_PLAYABLE_GAME/assets/vfx/muzzle_8x1.png', 'muzzle.png'],
  ['01_V4_PLAYABLE_GAME/assets/particles/projectile_impact_8x1.png', 'pulse.png'],
  ...['turret_fire', 'laser_hit', 'core_pickup', 'extract_success'].map(name => ['01_V4_PLAYABLE_GAME/assets/audio/sfx/' + name + '.wav', name + '.wav']),
];
await mkdir(out, { recursive: true });
const manifest = [];
for (const [source, file] of files) {
  const bytes = await readFile(path.join(pack, source));
  await copyFile(path.join(pack, source), path.join(out, file));
  manifest.push({ file, source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ source: 'RIVALS_ALL_IN_ONE_V4', files: manifest }, null, 2) + '\n');
console.log('Prepared combat exports:', manifest.length, 'files,', manifest.reduce((sum, file) => sum + file.bytes, 0), 'bytes.');
