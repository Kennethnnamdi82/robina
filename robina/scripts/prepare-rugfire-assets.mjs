// Offline, reproducible preparation of the user's source assets. No network downloads.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = 'src/RUGFIRE_ASSETS/';
const pack = source + 'RUG_FIRE_TACTICAL_ASSET_PACK/rugfire/';
const destination = path.join(root, 'public/assets/rugfire');
await fs.mkdir(destination, { recursive: true });
const html = '<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>';
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (file.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  page.on('console', msg => console.log(msg.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.exposeFunction('writeAsset', async (name, base64) => {
    const bytes = Buffer.from(base64, 'base64');
    const target = path.join(destination, name); await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(bytes));
    console.log(name, (bytes.length / 1024).toFixed(0) + ' KB');
  });
  await page.evaluate(async ({ source, pack }) => {
    const write = async (name, buffer) => {
      const data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(new Blob([buffer])); });
      await window.writeAsset(name, data);
    };
    const T = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const { FBXLoader } = await import('/node_modules/three/examples/jsm/loaders/FBXLoader.js');
    const gltf = new GLTFLoader(), fbx = new FBXLoader(), exporter = new GLTFExporter();
    const character = await gltf.loadAsync('/' + source + 'Players_weapon/animated-cowboy-shoots-pistols-blast-graphics/source/Prop Character 03.glb');
    let skin; character.scene.traverse(o => { if (o.isSkinnedMesh) skin = o; });
    if (!skin) throw new Error('Human model has no skin');
    // This encounter has no facial dialogue; omit the unused facial morph targets.
    skin.geometry.morphAttributes = {}; skin.morphTargetInfluences = []; skin.morphTargetDictionary = {};
    const remove = []; character.scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) remove.push(o); });
    remove.forEach(o => o.removeFromParent());
    skin.skeleton.pose(); character.scene.updateMatrixWorld(true); console.log('Human decoded');
    // Both rigs have Mixamo's +Y bone axes. Transfer animated world orientations
    // directly: this human was bound in a posed stance, so bind-delta transfer
    // would incorrectly retain the cowboy's original arm pose.
    const rig = await fbx.loadAsync('/' + source + 'Players_weapon/Basic Shooter Pack/rifle aiming idle.fbx');
    rig.updateMatrixWorld(true);
    const targetBones = skin.skeleton.bones;
    const sourceBones = new Map(); rig.traverse(o => { if (o.isBone) sourceBones.set(o.name.replace(/^mixamorig:?/, ''), o); });
    const hip = targetBones.find(b => b.name === 'Hips'), baseHip = hip.position.clone();
    const sourceHip = sourceBones.get('Hips'), sourceHeight = sourceHip.position.y;
    // Four original FBXs fail the binary parser. Reverse the valid backwards gait.
    const files = { Idle: 'rifle aiming idle', Walk: 'walking backwards', Run: 'walking backwards', Back: 'walking backwards', Left: 'strafe left', Right: 'strafe right', Fire: 'firing rifle', Reload: 'reloading', Hit: 'hit reaction', Evade: 'rifle jump' };
    const clips = [];
    for (const [name, file] of Object.entries(files)) {
      console.log('Preparing', name);
      const data = await fbx.loadAsync('/' + source + 'Players_weapon/Basic Shooter Pack/' + file + '.fbx');
      const clip = data.animations[0], mixer = new T.AnimationMixer(rig);
      const action = mixer.clipAction(clip); action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      const samples = Math.ceil(clip.duration * 30), times = [], positions = [], values = new Map(targetBones.map(b => [b.name, []]));
      for (let i = 0; i <= samples; i++) {
        const time = Math.min(i / 30, clip.duration); times.push(time); mixer.setTime(name === 'Walk' || name === 'Run' ? clip.duration - time : time); rig.updateMatrixWorld(true);
        for (const bone of targetBones) {
          const from = sourceBones.get(bone.name);
          if (!from) continue;
          const world = from.getWorldQuaternion(new T.Quaternion());
          const parent = bone.parent.getWorldQuaternion(new T.Quaternion()).invert();
          bone.quaternion.copy(parent.multiply(world)); bone.updateMatrixWorld(true);
          values.get(bone.name).push(...bone.quaternion.toArray());
        }
        positions.push(baseHip.x, baseHip.y + (sourceHip.position.y - sourceHeight) * baseHip.y / sourceHeight, baseHip.z);
      }
      const tracks = targetBones.filter(b => values.get(b.name).length).map(b => new T.QuaternionKeyframeTrack(b.name + '.quaternion', times, values.get(b.name)));
      tracks.push(new T.VectorKeyframeTrack('Hips.position', times, positions));
      clips.push(new T.AnimationClip(name, clip.duration, tracks).optimize());
      mixer.stopAllAction(); mixer.uncacheRoot(rig); skin.skeleton.pose(); character.scene.updateMatrixWorld(true);
    }
    skin.skeleton.pose();
    for (const value of Object.values(skin.material)) if (value?.isTexture) value.userData.mimeType = 'image/jpeg';
    console.log('Exporting human');
    const output = await exporter.parseAsync(character.scene, { binary: true, animations: clips, maxTextureSize: 1024, onlyVisible: true });
    console.log('Human exported', output.byteLength);
    await write('characters/operator.glb', output);
    // Convert only the maps used by the runtime. Keep all original EXR/Blend files untouched.
    const textures = {
      'leafy-ground.webp': source + 'environment/grass_medium_01_4k.blend/leafy_grass_4k.blend/textures/leafy_grass_diff_4k.jpg',
      'grass-color.webp': source + 'environment/grass_medium_01_4k.blend/textures/grass_medium_01_diff_4k.jpg',
      'grass-alpha.webp': source + 'environment/grass_medium_01_4k.blend/textures/grass_medium_01_alpha_4k.png',
    };
    for (const [name, url] of Object.entries(textures)) {
      const bitmap = await createImageBitmap(await (await fetch('/' + url)).blob());
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = name.includes('ground') ? 1024 : 512;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .85));
      await write('textures/' + name, await blob.arrayBuffer());
    }
  }, { source, pack });
  for (const dir of ['characters', 'weapons', 'environment', 'props', 'audio/ogg']) {
    await fs.cp(path.join(root, pack, dir), path.join(destination, dir), { recursive: true });
  }
  await fs.copyFile(path.join(root, source, 'enemies/low_poly_ak-47_animated_shootingreloading.glb'), path.join(destination, 'weapons/ak47.glb'));
  await fs.copyFile(path.join(root, pack, 'README_FIRST.md'), path.join(destination, 'SOURCE_PACK_README.md'));
  const hash = createHash('sha256');
  for (const entry of (await fs.readdir(destination, { recursive: true })).sort()) {
    const file = path.join(destination, entry); if ((await fs.stat(file)).isFile()) hash.update(entry).update(await fs.readFile(file));
  }
  await fs.writeFile(path.join(root, 'src/features/rugfire/assetVersion.ts'), `// Generated by scripts/prepare-rugfire-assets.mjs\nexport const ASSET_VERSION = '${hash.digest('hex').slice(0, 16)}';\n`);
} finally { await browser.close(); server.close(); }
