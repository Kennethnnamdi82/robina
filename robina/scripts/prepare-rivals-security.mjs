import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../',import.meta.url));
const source = 'src/features/rugfire/RIVALS/RIVALS_ALL_IN_ONE_V4/01_V4_PLAYABLE_GAME/assets/audio/sfx';
const output = path.join(root,'public/assets/rivals/security'); await mkdir(output,{ recursive: true });
const files = [];
for (const name of ['drone_alert','terminal_fail','vault_open']) {
  const file = name + '.wav', bytes = await readFile(path.join(root,source,file));
  await copyFile(path.join(root,source,file),path.join(output,file)); files.push({ file,source: source + '/' + file,bytes: bytes.length,sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(path.join(output,'manifest.json'),JSON.stringify({ files },null,2) + '\n'); console.log('Prepared',files.length,'optional security cues.');
