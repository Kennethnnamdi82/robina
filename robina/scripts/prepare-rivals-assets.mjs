import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const pack = path.join(root, 'src/features/rugfire/RIVALS/RIVALS_ALL_IN_ONE_V4');
const destination = path.join(root, 'public/assets/rivals/v4');
// Curated runtime exports only. The original pack and its standalone demos stay intact.
const files = [
  ['02_V4_VISUAL_TARGETS/visual_showroom/01_lobby_and_navigation.png', 'art/chamber-reference.png'],
  ...['idle_4x4', 'walk_6x4'].map(animation => [`01_V4_PLAYABLE_GAME/assets/characters/vex_base_${animation}.png`, `characters/vex_${animation}.png`]),
  ['01_V4_PLAYABLE_GAME/assets/characters/vex_base_portrait.png', 'characters/vex_portrait.png'],
  ['01_V4_PLAYABLE_GAME/assets/tilesets/neon_atlas_4x4.png', 'tiles/neon.png'],
  ...['vault_door', 'light_column', 'storage_box', 'crate', 'data_console', 'extraction_portal', 'power_generator', 'terminal_on'].map(name => [`01_V4_PLAYABLE_GAME/assets/props/${name}.png`, `props/${name}.png`]),
  ['01_V4_PLAYABLE_GAME/assets/audio/music/neon_ambient.wav', 'audio/neon_ambient.wav'],
];
await mkdir(destination, { recursive: true });
const manifest = [];
for (const [source, target] of files) {
  const output = path.join(destination, target);
  await mkdir(path.dirname(output), { recursive: true });
  await copyFile(path.join(pack, source), output);
  manifest.push({ file: target, source, bytes: (await stat(output)).size, sha256: createHash('sha256').update(await readFile(output)).digest('hex') });
}
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ version: 4, pack: 'RIVALS_ALL_IN_ONE_V4', files: manifest }, null, 2) + '\n');
console.log(`Prepared ${manifest.length} RIVALS assets (${(manifest.reduce((sum, file) => sum + file.bytes, 0) / 1048576).toFixed(2)} MiB).`);
const controls = path.join(root, 'public/assets/rivals/controls');
await mkdir(controls, { recursive: true });
const sounds = [];
for (const name of ['player_dash', 'player_hit', 'terminal_success', 'ui_confirm']) {
  const file = name + '.wav', source = path.join(pack, '01_V4_PLAYABLE_GAME/assets/audio/sfx', file);
  await copyFile(source, path.join(controls, file));
  const bytes = await readFile(source);
  sounds.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(path.join(controls, 'manifest.json'), JSON.stringify({ source: 'RIVALS_ALL_IN_ONE_V4/01_V4_PLAYABLE_GAME/assets/audio/sfx', files: sounds }, null, 2) + '\n');
console.log('Prepared four optional movement/interaction audio cues.');
