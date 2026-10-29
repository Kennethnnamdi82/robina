import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const pack = path.join(root, 'src/features/rugfire/RIVALS/RIVALS_ALL_IN_ONE_V4');
const game = path.join(pack, '01_V4_PLAYABLE_GAME/assets');
const files = await fs.readdir(game, { recursive: true });
const inventory = [], hashes = new Map();
for (const file of files.sort()) {
  const absolute = path.join(game, file), stat = await fs.stat(absolute);
  if (!stat.isFile()) continue;
  const bytes = await fs.readFile(absolute);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const entry = { file: file.replaceAll('\\', '/'), bytes: bytes.length, sha256: hash };
  if (file.endsWith('.png')) {
    entry.width = bytes.readUInt32BE(16); entry.height = bytes.readUInt32BE(20);
    entry.alphaChannel = [4, 6].includes(bytes[25]);
    const layout = file.match(/_(\d+)x(\d+)\.png$/);
    if (layout) entry.frames = { columns: +layout[1], rows: +layout[2], width: entry.width / +layout[1], height: entry.height / +layout[2] };
  }
  if (hashes.has(hash)) entry.duplicateOf = hashes.get(hash); else hashes.set(hash, entry.file);
  inventory.push(entry);
}
const models = [];
for (const file of await fs.readdir(path.join(root, 'public/assets/rugfire/characters'))) {
  if (!file.endsWith('.glb')) continue;
  const buffer = await fs.readFile(path.join(root, 'public/assets/rugfire/characters', file));
  const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  models.push({ file, meshes: json.meshes?.length, nodes: json.nodes?.length, skinned: json.skins?.length || 0, animationClips: json.animations?.map(a => a.name) || [] });
}
const report = {
  pack: 'RIVALS_ALL_IN_ONE_V4', assets: inventory,
  summary: { files: inventory.length, bytes: inventory.reduce((sum, a) => sum + a.bytes, 0), duplicateFiles: inventory.filter(a => a.duplicateOf).length },
  rugfireModels: models,
  notes: ['PNG metadata validates frame division, not pose quality; alpha coverage is validated by the runtime export tool.', 'The standalone prototypes and V3 copies are retained as references, not imported application code.', 'No native run sheets exist in the V4 character pack; walk-at-speed is an explicit fallback.'],
};
await fs.mkdir(path.join(root, 'docs/rivals-phase02'), { recursive: true });
await fs.writeFile(path.join(root, 'docs/rivals-phase02/source-asset-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ summary: report.summary, models }, null, 2));
