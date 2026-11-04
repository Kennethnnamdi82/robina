// Curate the supplied city atlas without changing the source pack.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'src/features/free_low_poly_simple_urban_city_3d_asset_pack.glb');
const target = path.join(root, 'public/assets/rivals/city');
const bytes = await fs.readFile(source);
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
if (!gltf.asset.extras?.license?.includes('CC-BY-4.0')) throw new Error('Expected supplied attribution license.');
await fs.mkdir(target, { recursive: true });
await fs.copyFile(source, path.join(target, 'living-city.glb'));
await fs.writeFile(path.join(target, 'LIVING-CITY-CREDITS.txt'), [
  gltf.asset.extras.title, 'By ' + gltf.asset.extras.author,
  gltf.asset.extras.source, gltf.asset.extras.license,
  'Adaptation: selected vehicle, vegetation and street furniture meshes are normalized, instanced and animated in RIVALS.',
  'Architecture: Quaternius Downtown City MegaKit, CC0. Existing source and texture manifest: manifest.json.',
].join('\n') + '\n');
console.log('Prepared living city atlas:', bytes.length, 'bytes; attribution preserved.');
