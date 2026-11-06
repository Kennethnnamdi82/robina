// Offline asset preparation from the user's supplied packs, never game startup.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { chromium } from '@playwright/test';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url))), output = path.join(root, 'public/assets/rivals/store');
await mkdir(path.join(output, 'models'), { recursive: true });
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end('<html><head><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head><body style="margin:0"></body></html>');
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    if (!path.extname(file)) file += '.ts';
    const source = await readFile(file); res.setHeader('Content-Type', /\.[jt]s$/.test(file) ? 'text/javascript' : 'application/octet-stream');
    res.end(file.endsWith('.ts') ? ts.transpileModule(source.toString(), { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.ESNext } }).outputText : source);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const manifest = { version: 2, source: 'Locally supplied source packs — originals unchanged', files: [] };
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 720, height: 880 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.exposeFunction('saveCollection', async (id, base64, art, source) => {
    const bytes = Buffer.from(base64, 'base64');
    await writeFile(path.join(output, 'models', id + '.glb'), bytes);
    await writeFile(path.join(output, id + '.webp'), Buffer.from(art.split(',')[1], 'base64'));
    manifest.files.push({ id, source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    console.log('Prepared', id, bytes.length, 'bytes');
  });
  await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const { MeshoptDecoder } = await import('/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js');
    const { FBXLoader } = await import('/node_modules/three/examples/jsm/loaders/FBXLoader.js');
    const { OBJLoader } = await import('/node_modules/three/examples/jsm/loaders/OBJLoader.js');
    const { RoomEnvironment } = await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
    const { dressCollection } = await import('/src/features/rivals/store/collectionStudio.ts');
    const { OUTFITS } = await import('/src/features/rivals/store/outfits.ts');
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.setSize(720, 880); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .98;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(31, 720 / 880, .01, 100);
    const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment(), environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; pmrem.dispose(); room.dispose();
    scene.add(new T.HemisphereLight(0xe8f0ff, 0x44433d, 1.3));
    for (const [color, power, position] of [[0xffe7c8, 4.5, [3, 5, 4]], [0x9bdcff, 4, [-3, 2, -3]], [0xffffff, 1.1, [-3, 3, 4]]]) { const light = new T.DirectionalLight(color, power); light.position.set(...position); scene.add(light); }
    const release = root => { const textures = new Set(), materials = new Set(), geometries = new Set(); root.traverse(n => { if (n.isMesh) { geometries.add(n.geometry); (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => materials.add(m)); } }); materials.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) textures.add(v); }); m.dispose(); }); textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose()); };
    const capture = async (id, model, source, character) => {
      model.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3()), centre = bounds.getCenter(new T.Vector3());
      const display = new T.Group(); model.position.sub(centre); display.add(model); display.scale.setScalar((character ? 2.35 : 2.65) / Math.max(size.x, size.y, size.z));
      if (character) display.rotation.y = -.24; else display.rotation.set(.08, 1.03, -.18);
      scene.add(display); camera.position.set(character ? .15 : .08, .12, character ? 5.2 : 5.5); camera.lookAt(0, 0, 0);
      await renderer.compileAsync(scene, camera); renderer.render(scene, camera);
      const art = renderer.domElement.toDataURL('image/webp', .94);
      display.rotation.set(0,0,0);display.updateMatrixWorld(true);
      // Export precisely the same posed, dressed model shown in its photograph.
      const bytes = await new GLTFExporter().parseAsync(display, { binary: true, onlyVisible: true, maxTextureSize:1024 });
      let binary = ''; const array = new Uint8Array(bytes); for (let i = 0; i < array.length; i += 32768) binary += String.fromCharCode(...array.subarray(i, i + 32768));
      await window.saveCollection(id, btoa(binary), art, source); scene.remove(display); release(display);
    };
    for (const [id, outfit] of Object.entries(OUTFITS)) {
      const source = '/src/features/' + outfit.source, gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(source);
      await capture(id, dressCollection(gltf.scene, gltf.animations, id), source, true);
    }
    const weapons = [
      ['mp5', 'WeaponsPack/MP5/SKM_MP5.fbx', 'T_MP5_C.png'],
      ['m4a1', 'Guns&Explosives/M4A1/M4A1.fbx', 'M4A1_Base_Color.png'],
      ['scar', 'OBJ/AssaultRifle2_2.obj'], ['m249', 'OBJ/AssaultRifle2_4.obj'], ['elite', 'OBJ/AssaultRifle_5.obj'],
      ['grenade', 'Guns&Explosives/FragGrenade/FragGrenadeModel.fbx', 'FragGrenade_Base_Color.png'],
    ];
    for (const [id, file, texture] of weapons) {
      const source = '/src/features/' + file, manager = new T.LoadingManager(), folder = source.slice(0, source.lastIndexOf('/') + 1);
      manager.setURLModifier(url => /\.(png|jpg|jpeg|tga)$/i.test(url) ? folder + url.replaceAll('\\', '/').split('/').pop() : url);
      const model = file.endsWith('.obj') ? await new OBJLoader(manager).loadAsync(source) : await new FBXLoader(manager).loadAsync(source);
      let map; if (texture) { map = await new T.TextureLoader().loadAsync(folder + texture); map.colorSpace = T.SRGBColorSpace; }
      model.traverse(n => { if (n.isMesh) n.material = new T.MeshStandardMaterial({ color: id === 'elite' ? 0x626e78 : id === 'scar' ? 0x7c7364 : 0x454e51, map, roughness: .64, metalness: .38 }); });
      // Posed firearm meshes only; source files and mission equipment stay intact.
      await capture(id, model, source, false);
    }
    for (const [id, color] of [['desert','#c4ae7d'],['pulse','#9dcf91'],['steel','#8e9ba7'],['fire','#d17f70'],['frost','#95d5e5'],['protocol','#d8b86c'],['diamond','#c7d1e5']]) {
      const source='/public/assets/rivals/combat3d/weapons/rifle.glb',gltf=await new GLTFLoader().loadAsync(source);
      gltf.scene.traverse(n=>{if(n.isMesh){for(const m of Array.isArray(n.material)?n.material:[n.material]){m.color.lerp(new T.Color(color),.72);m.roughness=id==='diamond'?.24:.6;m.metalness=id==='protocol'?.72:.42;}}});
      await capture(id,gltf.scene,source,false);
    }
    environment.dispose(); renderer.dispose(); renderer.forceContextLoss();
  });
  await writeFile(path.join(output, 'collection-manifest.json'), JSON.stringify(manifest, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
