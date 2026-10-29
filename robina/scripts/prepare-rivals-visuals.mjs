// Deterministic frame normalization, atlas packing and WebP export. No paid services.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = path.join(root, 'public/assets/rivals/phase02');
const source = '/art/rivals/phase02/';
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<title>RIVALS asset authoring</title>'); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage();
  await page.exposeFunction('saveVisual', async (name, base64) => {
    if (!/^[a-z0-9_.-]+\.(webp|png|json)$/.test(name)) throw new Error('Invalid output name');
    await fs.writeFile(path.join(output, name), Buffer.from(base64, 'base64'));
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const prepared = await page.evaluate(async source => {
    const image = async file => {
      const response = await fetch(source + file); if (!response.ok) throw new Error('Missing art source: ' + file);
      return createImageBitmap(await response.blob());
    };
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const save = async (name, c, quality = .92) => {
      const type = name.endsWith('.webp') ? 'image/webp' : 'image/png';
      const url = c.toDataURL(type, quality); if (!url.startsWith(`data:${type};`)) throw new Error('Browser cannot export ' + type);
      await window.saveVisual(name, url.split(',')[1]);
    };
    const saveJSON = async (name, value) => {
      const bytes = new TextEncoder().encode(JSON.stringify(value)); let string = ''; for (const byte of bytes) string += String.fromCharCode(byte);
      await window.saveVisual(name, btoa(string));
    };
    const bounds = c => {
      const ctx = c.getContext('2d', { willReadFrequently: true }), pixels = ctx.getImageData(0, 0, c.width, c.height).data;
      let left = c.width, top = c.height, right = -1, bottom = -1, clear = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        if (pixels[(y * c.width + x) * 4 + 3] < 12) { clear++; continue; }
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      if (right < left) throw new Error('An authored frame is empty');
      return { x: left, y: top, w: right - left + 1, h: bottom - top + 1, transparentRatio: clear / (c.width * c.height) };
    };
    const frame = (x, y, w, h) => ({ frame: { x, y, w, h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h } });
    const makeAtlas = (width, height, frames) => ({ frames, meta: { app: 'RIVALS deterministic atlas exporter', version: '2', format: 'RGBA8888', size: { w: width, h: height }, scale: '1' } });
    const report = { characters: {}, props: {}, walls: {} };

    const floorImage = await image('neon-floor-source.png'), floor = canvas(512, 512);
    floor.getContext('2d').drawImage(floorImage, 0, 0, 512, 512); floorImage.close(); await save('neon-floor.webp', floor);

    // The generated machinery is intentionally repacked by explicit source rectangles;
    // a concept-sheet grid is never assumed to be a correctly aligned runtime atlas.
    const boxes = [
      ['crate', .008, .06, .232, .259], ['console', .275, .002, .455, .267],
      ['vault-door', .487, 0, .79, .265], ['reactor', .792, 0, 1, .27],
      ['pillar', .045, .259, .177, .514], ['security-door', .205, .28, .494, .495],
      ['barricade-h', .493, .338, .79, .497], ['barricade-v', .832, .267, .965, .51],
      ['camera', .028, .51, .188, .751], ['vent', .228, .54, .49, .746],
      ['lockers', .516, .507, .774, .749], ['hologram', .8, .499, .99, .754],
      ['pipes', .001, .764, .297, .99], ['light-column', .319, .75, .432, 1],
      ['cable-reel', .505, .75, .749, 1], ['equipment-case', .756, .785, 1, .981],
    ];
    const propsImage = await image('neon-machinery-source.png'), props = canvas(1024, 1024), propFrames = {};
    for (const [index, [name, x1, y1, x2, y2]] of boxes.entries()) {
      const crop = canvas(Math.ceil((x2 - x1) * propsImage.width), Math.ceil((y2 - y1) * propsImage.height));
      crop.getContext('2d').drawImage(propsImage, x1 * propsImage.width, y1 * propsImage.height, crop.width, crop.height, 0, 0, crop.width, crop.height);
      const b = bounds(crop); if (b.transparentRatio < .1) throw new Error(name + ': missing transparent background');
      const scale = Math.min(224 / b.w, 218 / b.h), w = b.w * scale, h = b.h * scale;
      const x = index % 4 * 256, y = Math.floor(index / 4) * 256;
      props.getContext('2d').drawImage(crop, b.x, b.y, b.w, b.h, x + (256 - w) / 2, y + 230 - h, w, h);
      propFrames[name] = frame(x, y, 256, 256); report.props[name] = { sourceBounds: b, outputCell: { x, y, w: 256, h: 256 }, anchor: { x: .5, y: 230 / 256 } };
    }
    propsImage.close(); await save('neon-props.webp', props); await saveJSON('neon-props.json', makeAtlas(1024, 1024, propFrames));

    const wallsImage = await image('neon-walls-source.png'), walls = canvas(1024, 512), wallFrames = {};
    for (const [index, name] of ['horizontal', 'vertical', 'corner', 'junction', 'lamp', 'glass', 'vent', 'end'].entries()) {
      const crop = canvas(512, 512), col = index % 4, row = Math.floor(index / 4);
      crop.getContext('2d').drawImage(wallsImage, col * wallsImage.width / 4, row * wallsImage.height / 2, wallsImage.width / 4, wallsImage.height / 2, 0, 0, 512, 512);
      const b = bounds(crop); if (b.transparentRatio < .12) throw new Error(name + ': opaque wall background');
      const scale = Math.min(240 / b.w, 226 / b.h), w = b.w * scale, h = b.h * scale;
      walls.getContext('2d').drawImage(crop, b.x, b.y, b.w, b.h, col * 256 + (256 - w) / 2, row * 256 + 238 - h, w, h);
      wallFrames[name] = frame(col * 256, row * 256, 256, 256); report.walls[name] = { sourceBounds: b };
    }
    wallsImage.close(); await save('neon-walls.webp', walls); await saveJSON('neon-walls.json', makeAtlas(1024, 512, wallFrames));

    const directions = ['down', 'left', 'right', 'up'];
    for (const id of ['vex', 'nyx', 'rook']) {
      const input = await image(id + '-walk-transparent.png'), cells = [], cellSize = 256;
      for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
        const c = canvas(cellSize, cellSize);
        c.getContext('2d').drawImage(input, col * input.width / 6, row * input.height / 4, input.width / 6, input.height / 4, 0, 0, cellSize, cellSize);
        const b = bounds(c); if (b.transparentRatio < .2 || b.transparentRatio > .96) throw new Error(id + ': invalid alpha/empty frame ' + col + ',' + row);
        cells.push({ c, b });
      }
      const maxHeight = Math.max(...cells.map(c => c.b.h)), maxWidth = Math.max(...cells.map(c => c.b.w));
      const scale = Math.min(160 / maxHeight, 160 / maxWidth), atlas = canvas(1152, 768), frames = {}, validations = [];
      for (let index = 0; index < cells.length; index++) {
        const { c, b } = cells[index], col = index % 6, row = Math.floor(index / 6);
        const w = cellSize * scale, h = b.h * scale;
        atlas.getContext('2d').drawImage(c, 0, b.y, cellSize, b.h, col * 192 + (192 - w) / 2, row * 192 + 174 - h, w, h);
        const name = `walk/${directions[row]}/${col}`; frames[name] = frame(col * 192, row * 192, 192, 192);
        validations.push({ name, sourceBounds: b, pivot: { x: 96, y: 174 } });
      }
      await save(id + '.webp', atlas, .94); await saveJSON(id + '.json', makeAtlas(1152, 768, frames));
      const portrait = canvas(128, 128); portrait.getContext('2d').drawImage(atlas, 2 * 192 + 48, 5, 96, 105, 0, 0, 128, 128); await save(id + '-portrait.webp', portrait, .94);
      report.characters[id] = { frameSize: 192, columns: 6, rows: 4, anchor: { x: .5, y: 174 / 192 }, frames: validations, fallbackStates: { idle: 'stationary walk pose 2 with subtle breathing', run: 'walk at increased rate', dash: 'walk pose fallback; no dash mechanic', attack: 'idle pose; no authored attack in this art style', hurt: 'idle pose; no authored hurt in this art style', defeat: 'idle pose; no authored defeat in this art style' } };
      input.close();
    }
    return report;
  }, source);
  const files = [];
  for (const file of (await fs.readdir(output)).sort()) {
    if (!/\.(webp|json)$/.test(file) || file === 'manifest.json') continue;
    const bytes = await fs.readFile(path.join(output, file));
    files.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const manifest = { version: 'phase02', files, layouts: prepared };
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const get = file => files.find(f => f.file === file);
  const runtime = {
    revision: createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12),
    floor: { ...get('neon-floor.webp'), width: 512, height: 512, frameSize: 128 },
    props: { ...get('neon-props.webp'), atlasFile: 'neon-props.json', width: 1024, height: 1024 },
    walls: { ...get('neon-walls.webp'), atlasFile: 'neon-walls.json', width: 1024, height: 512 },
    characters: Object.fromEntries(['vex', 'nyx', 'rook'].map(id => [id, { ...get(id + '.webp'), atlasFile: id + '.json', portraitFile: id + '-portrait.webp', width: 1152, height: 768, frameSize: 192, pivot: { x: .5, y: 174 / 192 } }])),
  };
  await fs.mkdir(path.join(root, 'src/features/rivals/data'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/features/rivals/data/visualManifest.ts'), '// Generated by scripts/prepare-rivals-visuals.mjs. Do not hand-edit.\nexport const VISUAL_MANIFEST = ' + JSON.stringify(runtime, null, 2) + ' as const;\n');
  await fs.writeFile(path.join(root, 'docs/rivals-phase02/atlas-validation.json'), JSON.stringify(prepared, null, 2) + '\n');
  console.log(`Exported ${files.length} runtime files, ${(files.reduce((sum, f) => sum + f.bytes, 0) / 1048576).toFixed(2)} MiB across all three operatives.`);
} finally { await browser.close(); server.close(); }
