// Studio photographs of existing shipped models, not generated product assets.
// Run manually when reference models change. Never runs during game startup.
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import ts from 'typescript';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = path.join(root, 'public/assets/rivals/store');
const models = { rifle: 'rivals/combat3d/weapons/rifle.glb', ak47: 'rugfire/weapons/ak47.glb', smg: 'rivals/combat3d/weapons/smg.glb', pistol: 'rivals/combat3d/weapons/pistol.glb', operative: 'rivals/characters/universal-operative.glb', health: 'rugfire/props/health_kit.glb' };
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<html><head><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script></head><body style="margin:0;background:transparent"></body></html>'); return; }
    const pathname = new URL(req.url, 'http://localhost').pathname;
    let file = path.resolve(root, '.' + pathname);
    if (pathname.startsWith('/src/') && !path.extname(file)) file += '.ts';
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', /\.[jt]s$/.test(file) ? 'text/javascript' : 'application/octet-stream');
    const source = await readFile(file);
    res.end(file.endsWith('.ts') ? ts.transpileModule(source.toString(), { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.ESNext } }).outputText : source);
  } catch { res.writeHead(404).end(); }
});
await mkdir(output, { recursive: true });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:' + server.address().port);
  for (const [id, model] of Object.entries(models)) {
    await page.evaluate(async ({ id, model }) => {
      const T = await import('/node_modules/three/build/three.module.js');
      const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const { RoomEnvironment } = await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
      const { studioPose } = await import('/src/features/rivals/store/studioPose.ts');
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(720, 720); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(35, 1, .01, 100);
      const generator = new T.PMREMGenerator(renderer), room = new RoomEnvironment(), environment = generator.fromScene(room, .04);
      scene.environment = environment.texture; generator.dispose(); room.dispose();
      scene.add(new T.HemisphereLight(0xdfefff, 0x28252e, 2.4));
      for (const [color, intensity, position] of [[0xffe3bd, 4, [3, 5, 4]], [0x83b8d7, 3, [-4, 2, -2]]]) {
        const light = new T.DirectionalLight(color, intensity); light.position.set(...position); scene.add(light);
      }
      const { scene: root, animations } = await new GLTFLoader().loadAsync('/public/assets/' + model);
      studioPose(root, animations, id === 'operative');
      const box = new T.Box3().setFromObject(root), size = box.getSize(new T.Vector3()), centre = box.getCenter(new T.Vector3()), group = new T.Group();
      root.position.sub(centre); group.add(root); group.scale.setScalar(2.35 / Math.max(size.x, size.y, size.z));
      if (id === 'operative') group.rotation.y = -.22; else group.rotation.set(.05, 1.15, -.12);
      scene.add(group); camera.position.set(id === 'operative' ? .4 : .15, .2, 4.6); camera.lookAt(0, 0, 0);
      await renderer.compileAsync(scene, camera); renderer.render(scene, camera);
      document.body.replaceChildren(renderer.domElement);
      // Keep it alive for capture, then dispose before the next model.
      window.releaseStudio = () => { root.traverse(n => { if (n.isMesh) { n.geometry.dispose(); for (const m of Array.isArray(n.material) ? n.material : [n.material]) { Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); }); m.dispose(); } } }); environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); };
    }, { id, model });
    await page.screenshot({ path: path.join(output, id + '.png'), omitBackground: true });
    await page.evaluate(() => window.releaseStudio());
    console.log('Prepared existing reference:', id);
  }
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
