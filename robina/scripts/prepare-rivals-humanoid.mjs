// Offline preparation of the supplied CC0 packs; no downloads or source edits.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const base = 'src/features/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf';
const library = 'src/features/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb';
const output = path.join(root, 'public/assets/rivals/characters');
await fs.mkdir(output, { recursive: true });
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
  await page.exposeFunction('writeHumanoid', async (data, audit) => {
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(path.join(output, 'universal-operative.glb'), buffer);
    audit.bytes = buffer.length; audit.sha256 = createHash('sha256').update(buffer).digest('hex');
    await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(audit, null, 2) + '\n');
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async ({ base, library }) => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const manager = new T.LoadingManager();
    // Two normal-map URIs in the supplied glTF have an extra _png suffix.
    manager.setURLModifier(url => url.replace(/(T_(?:Hair_1|Eye)_Normal)_png\.png$/, '$1.png'));
    const missing = []; manager.onError = url => missing.push(url);
    const loader = new GLTFLoader(manager);
    const [target, source] = await Promise.all([loader.loadAsync('/' + base), loader.loadAsync('/' + library)]);
    if (missing.length) throw new Error('Missing supplied textures: ' + missing.join(', '));
    target.scene.updateMatrixWorld(true); source.scene.updateMatrixWorld(true);
    const targetBones = [], sourceBones = new Map();
    target.scene.traverse(node => { if (node.isBone) targetBones.push(node); });
    source.scene.traverse(node => { if (node.isBone) sourceBones.set(node.name, node); });
    if (targetBones.length !== 65 || targetBones.some(b => !sourceBones.has(b.name))) throw new Error('Unexpected Universal skeleton; refusing incompatible retarget.');
    const rest = new Map(targetBones.map(b => [b.name, { position: b.position.clone(), rotation: b.getWorldQuaternion(new T.Quaternion()) }]));
    const referenceMixer = new T.AnimationMixer(source.scene);
    referenceMixer.clipAction(source.animations.find(c => c.name === 'A_TPose')).play(); referenceMixer.setTime(0); source.scene.updateMatrixWorld(true);
    const sourceRest = new Map([...sourceBones].map(([name, b]) => [name, b.getWorldQuaternion(new T.Quaternion()).invert()]));
    const sourceHip = sourceBones.get('pelvis'), sourceHeight = sourceHip.getWorldPosition(new T.Vector3()).y;
    const targetHip = targetBones.find(b => b.name === 'pelvis'), targetHeight = targetHip.getWorldPosition(new T.Vector3()).y;
    const scale = targetHeight / sourceHeight;
    referenceMixer.stopAllAction(); referenceMixer.uncacheRoot(source.scene);
    const selected = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Roll', 'Hit_Chest', 'Death01', 'Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down', 'Pistol_Shoot', 'Pistol_Reload', 'Interact', 'Sword_Idle', 'Sword_Attack', 'PickUp_Table', 'Spell_Simple_Shoot', 'Crouch_Fwd_Loop'];
    const clips = [];
    for (const name of selected) {
      const original = source.animations.find(c => c.name === name);
      if (!original) throw new Error('Missing supplied clip: ' + name);
      const mixer = new T.AnimationMixer(source.scene), action = mixer.clipAction(original);
      action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      const count = Math.ceil(original.duration * 30), times = [], rotations = new Map(targetBones.map(b => [b.name, []])), hipPositions = [];
      const world = new T.Quaternion(), parentInverse = new T.Quaternion(), delta = new T.Vector3();
      for (let frame = 0; frame <= count; frame++) {
        const time = Math.min(frame / 30, original.duration); times.push(time);
        mixer.setTime(time); source.scene.updateMatrixWorld(true);
        // In-place contract: retain pelvis bob, never copy horizontal travel or
        // the source proportions. Physics is the only owner of displacement.
        targetHip.position.copy(rest.get('pelvis').position);
        delta.set(0, (sourceHip.getWorldPosition(new T.Vector3()).y - sourceHeight) * scale, 0);
        delta.applyQuaternion(targetHip.parent.getWorldQuaternion(parentInverse).invert());
        targetHip.position.add(delta);
        for (const bone of targetBones) {
          sourceBones.get(bone.name).getWorldQuaternion(world);
          world.multiply(sourceRest.get(bone.name)).multiply(rest.get(bone.name).rotation);
          bone.parent.getWorldQuaternion(parentInverse).invert();
          bone.quaternion.copy(parentInverse.multiply(world)).normalize(); bone.updateMatrixWorld(true);
          const values = rotations.get(bone.name), q = bone.quaternion;
          // Preserve quaternion hemisphere continuity before interpolation.
          const sign = values.length && q.x * values.at(-4) + q.y * values.at(-3) + q.z * values.at(-2) + q.w * values.at(-1) < 0 ? -1 : 1;
          values.push(q.x * sign, q.y * sign, q.z * sign, q.w * sign);
        }
        hipPositions.push(...targetHip.position.toArray());
      }
      const tracks = targetBones.map(b => new T.QuaternionKeyframeTrack(b.name + '.quaternion', times, rotations.get(b.name)));
      tracks.push(new T.VectorKeyframeTrack('pelvis.position', times, hipPositions));
      clips.push(new T.AnimationClip(name, original.duration, tracks).optimize());
      mixer.stopAllAction(); mixer.uncacheRoot(source.scene);
      for (const bone of targetBones) { bone.position.copy(rest.get(bone.name).position); }
      target.scene.traverse(node => { if (node.isSkinnedMesh) node.skeleton.pose(); }); target.scene.updateMatrixWorld(true);
      console.log('Retargeted', name);
    }
    // A restrained RIVALS field-suit tint on the actual supplied skinned mesh,
    // retaining its UVs, skin weights, normal/roughness maps and facial detail.
    // This is a development operative finish, not final authored VEX armor.
    target.scene.traverse(node => {
      if (!node.isMesh) return;
      if (node.material.name === 'MI_Superhero_Male') {
        const positions = node.geometry.attributes.position, colors = new Float32Array(positions.count * 3);
        for (let i = 0; i < positions.count; i++) {
          const x = Math.abs(positions.getX(i)), y = positions.getY(i), z = positions.getZ(i);
          let color = [.12, .22, .34];
          if (y > 1.68 && y < 1.74 && z > .04) color = [1, 1, 1];
          else if (y < .2 || x > .65 && y > 1.1) color = [.09, .12, .16];
          else if (x < .16 && y > 1.23 && y < 1.28 && z > 0) color = [.15, .8, 1];
          colors.set(color, i * 3);
        }
        node.geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); node.material.vertexColors = true;
      }
      for (const value of Object.values(node.material)) if (value?.isTexture) value.userData.mimeType = 'image/webp';
    });
    const visor = new T.Mesh(new T.BoxGeometry(.125, .022, .018), new T.MeshStandardMaterial({ color: 0x79dfe9, emissive: 0x187a8b, emissiveIntensity: .8, roughness: .28, metalness: .25 }));
    visor.name = 'Operative-vis-or'; visor.position.set(0, 1.703, .094); target.scene.add(visor); target.scene.updateMatrixWorld(true);
    targetBones.find(b => b.name === 'Head').attach(visor);
    // Normalize by bind geometry, with feet at the physics origin and +Z forward.
    const bounds = new T.Box3().setFromObject(target.scene), size = bounds.getSize(new T.Vector3());
    const wrapper = new T.Group(); wrapper.name = 'RivalsUniversalOperative';
    wrapper.add(target.scene); target.scene.scale.setScalar(1.75 / size.y);
    target.scene.position.y = -bounds.min.y * target.scene.scale.x;
    const buffer = await new GLTFExporter().parseAsync(wrapper, { binary: true, animations: clips, maxTextureSize: 1024, onlyVisible: true });
    const data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(new Blob([buffer])); });
    let triangles = 0; target.scene.traverse(o => { if (o.isMesh) triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; });
    await window.writeHumanoid(data, { source: { model: base, animations: library }, license: 'CC0-1.0 / Quaternius', skeleton: targetBones.map(b => b.name), height: 1.75, forward: '+Z', triangles, strategy: 'T-pose world-rest retarget; fixed bone lengths; vertical pelvis only; physics owns travel', clips: clips.map(c => ({ name: c.name, duration: c.duration, tracks: c.tracks.length })), unavailable: ['authored backward walk', 'authored strafes', 'separate run', 'movement starts/stops', 'turn in place', 'rifle-specific aim'] });
  }, { base, library });
  await fs.copyFile(path.join(root, 'src/features/Universal Base Characters[Standard]/License_Standard.txt'), path.join(output, 'LICENSE-base.txt'));
  await fs.copyFile(path.join(root, 'src/features/Universal Animation Library[Standard]/License.txt'), path.join(output, 'LICENSE-animation.txt'));
  console.log('Prepared public/assets/rivals/characters/universal-operative.glb');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
