// Selected local CC0 assets only. No downloads and no changes to source packs.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = path.join(root, 'public/assets/rivals/combat3d');
await fs.mkdir(output, { recursive: true });
const manifest = { license: 'CC0-1.0', sources: {
  models: 'https://quaternius.com/packs/ultimategun.html',
  firearms: 'https://lpc.opengameart.org/content/the-free-firearm-sound-library',
  foley: 'https://kenney.nl/assets/impact-sounds',
  particles: 'https://kenney.nl/assets/smoke-particles',
}, files: [] };
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>'); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (file.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  page.on('console', message => console.log(message.text()));
  await page.exposeFunction('saveCombatAsset', async (name, base64, info) => {
    const bytes = Buffer.from(base64, 'base64');
    const dest = path.join(output, name); await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.writeFile(dest, bytes);
    manifest.files.push({ file: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), ...info });
    console.log(name, bytes.length, 'bytes');
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { OBJLoader } = await import('/node_modules/three/examples/jsm/loaders/OBJLoader.js');
    const { MTLLoader } = await import('/node_modules/three/examples/jsm/loaders/MTLLoader.js');
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const { mergeGeometries } = await import('/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js');
    const save = async (name, data, info) => {
      const base64 = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(new Blob([data])); });
      await window.saveCombatAsset(name, base64, info);
    };
    const choices = [
      { id: 'rifle', source: 'AssaultRifle2_1', length: .82, support: [0, .045, -.19], recoil: .025 },
      { id: 'smg', source: 'SubmachineGun_3', length: .61, support: [0, .035, -.13], recoil: .018 },
      { id: 'pistol', source: 'Pistol_4', length: .30, support: null, recoil: .018 },
    ];
    for (const spec of choices) {
      const materialSource = await new MTLLoader().loadAsync('/src/features/OBJ/' + spec.source + '.mtl'); materialSource.preload();
      const original = await new OBJLoader().setMaterials(materialSource).loadAsync('/src/features/OBJ/' + spec.source + '.obj'); original.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(original), size = bounds.getSize(new T.Vector3());
      const scale = spec.length / size.x, transform = new T.Matrix4().makeScale(scale, scale, scale).multiply(new T.Matrix4().makeRotationY(Math.PI / 2));
      const groups = new Map(), materials = new Map(); let noseMin = Infinity, noseMax = -Infinity;
      original.traverse(node => {
        if (!node.isMesh) return;
        const position = node.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) if (position.getX(i) > bounds.max.x - size.x * .012) { noseMin = Math.min(noseMin, position.getY(i)); noseMax = Math.max(noseMax, position.getY(i)); }
        const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
        const ranges = node.geometry.groups.length ? node.geometry.groups : [{ start: 0, count: position.count, materialIndex: 0 }];
        for (const range of ranges) {
          const mat = sourceMaterials[range.materialIndex], geometry = new T.BufferGeometry();
          for (const [name, attribute] of Object.entries(node.geometry.attributes)) geometry.setAttribute(name, new T.BufferAttribute(attribute.array.slice(range.start * attribute.itemSize, (range.start + range.count) * attribute.itemSize), attribute.itemSize, attribute.normalized));
          geometry.applyMatrix4(node.matrixWorld).applyMatrix4(transform);
          if (!groups.has(mat.name)) groups.set(mat.name, []); groups.get(mat.name).push(geometry);
          if (!materials.has(mat.name)) materials.set(mat.name, new T.MeshStandardMaterial({ name: mat.name, color: mat.color.clone().convertLinearToSRGB(), roughness: /wood|black/i.test(mat.name) ? .78 : .48, metalness: /wood|black/i.test(mat.name) ? .05 : .55, emissive: mat.name === 'MainLight' ? 0x063847 : 0, emissiveIntensity: .35 }));
        }
      });
      const model = new T.Group(); model.name = 'RIVALS-' + spec.id;
      let triangles = 0;
      for (const [name, geometries] of groups) { const geometry = mergeGeometries(geometries); if (!geometry) throw new Error('Incompatible weapon parts: ' + spec.source); triangles += geometry.attributes.position.count / 3; model.add(new T.Mesh(geometry, materials.get(name))); }
      const muzzle = [0, (noseMin + noseMax) / 2 * scale, -bounds.max.x * scale];
      const sockets = { grip: [0, 0, 0], muzzle, support: spec.support, eject: [.035, muzzle[1] - .02, -.06], sight: [0, bounds.max.y * scale - .012, -.1] };
      model.userData.rivalsWeapon = { id: spec.id, length: spec.length, forward: '-Z', sockets, recoil: spec.recoil };
      for (const [name, value] of Object.entries(sockets)) if (value) { const marker = new T.Object3D(); marker.name = 'weapon-' + name; marker.position.fromArray(value); model.add(marker); }
      const data = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true });
      await save('weapons/' + spec.id + '.glb', data, { source: 'src/features/OBJ/' + spec.source + '.obj', triangles, materials: materials.size, sockets });
    }

    // Crop one actual transient from each supplied recording; retain a short
    // natural decay instead of shipping the multi-minute/raw source library.
    const shots = [
      ['rifle-0', 'AR-15/D_32P.wav', .62], ['rifle-1', 'AR-15/D_24P.wav', .62],
      ['pistol-0', '1911/A_42P.wav', .55], ['pistol-1', '1911/A_34P.wav', .55],
      ['smg-0', 'Carl Gustav M45/G_20P.wav', .40], ['smg-1', 'Carl Gustav M45/G_22P.wav', .40],
      ['shotgun-0', 'Mossberg/N_26P.wav', .85],
    ];
    const decoder = new OfflineAudioContext(1, 1, 44100);
    function wav(samples, rate) {
      const bytes = new ArrayBuffer(44 + samples.length * 2), view = new DataView(bytes);
      const string = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
      string(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); string(8, 'WAVE'); string(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); string(36, 'data'); view.setUint32(40, samples.length * 2, true);
      for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
      return bytes;
    }
    for (const [name, source, duration] of shots) {
      const response = await fetch('/src/features/Prepared SFX Library/' + source); if (!response.ok) throw new Error('Missing supplied shot ' + source);
      const decoded = await decoder.decodeAudioData(await response.arrayBuffer());
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel));
      const window = Math.max(1, Math.floor(decoded.sampleRate * .004)), levels = [];
      for (let offset = 0; offset < decoded.length; offset += window) { let energy = 0; for (let i = offset; i < Math.min(decoded.length, offset + window); i++) energy += channels[0][i] ** 2; levels.push(Math.sqrt(energy / window)); }
      const threshold = Math.max(...levels) * .62, first = levels.findIndex(value => value >= threshold);
      const start = Math.max(0, first * window / decoded.sampleRate - .012), rate = 44100;
      const context = new OfflineAudioContext(1, Math.ceil(duration * rate), rate), buffer = context.createBuffer(1, Math.ceil(duration * decoded.sampleRate), decoded.sampleRate);
      const mono = buffer.getChannelData(0), begin = Math.floor(start * decoded.sampleRate);
      for (let i = 0; i < mono.length; i++) { let value = 0; for (const channel of channels) value += channel[Math.min(channel.length - 1, begin + i)]; mono[i] = value / channels.length; }
      const src = context.createBufferSource(); src.buffer = buffer;
      const filter = context.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 65; src.connect(filter); filter.connect(context.destination); src.start();
      const rendered = (await context.startRendering()).getChannelData(0); let peak = 0;
      for (const value of rendered) peak = Math.max(peak, Math.abs(value));
      if (peak < .001) throw new Error('Silent selected shot: ' + source);
      const gain = .82 / peak;
      for (let i = 0; i < rendered.length; i++) { const fade = Math.min(1, (rendered.length - 1 - i) / (rate * .06)); rendered[i] *= gain * Math.max(0, fade); }
      await save('audio/' + name + '.wav', wav(rendered, rate), { source: 'src/features/Prepared SFX Library/' + source, sourceDuration: decoded.duration, start, duration, sampleRate: rate, channels: 1, peak: .82, processing: 'single transient crop, stereo fold-down, 65Hz high-pass, peak normalize, tail fade' });
    }
    for (const [name, source] of [['flash', 'Flash/flash04.png'], ['smoke', 'White puff/whitePuff00.png'], ['blast', 'Explosion/explosion04.png']]) {
      const bitmap = await createImageBitmap(await (await fetch('/src/features/PNG/' + source)).blob());
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128; canvas.getContext('2d').drawImage(bitmap, 0, 0, 128, 128); bitmap.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .9));
      await save('fx/' + name + '.webp', await blob.arrayBuffer(), { source: 'src/features/PNG/' + source, dimensions: [128, 128] });
    }
  });
  for (const [name, source] of [
    ['step-0', 'footstep_concrete_000'], ['step-1', 'footstep_concrete_001'], ['step-2', 'footstep_concrete_002'],
    ['metal-0', 'impactMetal_light_000'], ['metal-1', 'impactMetal_light_001'],
    ['clack', 'impactMetal_light_003'], ['body-hit', 'impactPunch_medium_001'], ['collapse', 'impactMetal_heavy_001'],
  ]) {
    const bytes = await fs.readFile(path.join(root, 'src/features/Audio/' + source + '.ogg'));
    await fs.writeFile(path.join(output, 'audio/' + name + '.ogg'), bytes);
    manifest.files.push({ file: 'audio/' + name + '.ogg', bytes: bytes.length, source: 'src/features/Audio/' + source + '.ogg', sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(path.join(output, 'CREDITS.txt'), 'RIVALS selected combat assets\n\nWeapon models: Quaternius, Ultimate Guns Pack, CC0-1.0.\nFirearm recordings: Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney, The Free Firearm Sound Library, CC0-1.0.\nFoley and particle textures: Kenney, Impact Sounds and Smoke Particles, CC0-1.0.\n\nPublisher license sources:\n' + Object.values(manifest.sources).join('\n') + '\n\nPrepared recordings are short edited mono cuts. Reload/click/death use edited impact foley; blast uses a filtered shotgun/metal layer, not a claimed field explosion recording.\n');
  console.log('Prepared', manifest.files.length, 'selected assets;', manifest.files.reduce((sum, file) => sum + file.bytes, 0), 'bytes total.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
