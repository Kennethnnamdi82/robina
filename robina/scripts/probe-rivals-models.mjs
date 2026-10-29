import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>'); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (file.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 550 } });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1200, 550); renderer.setClearColor('#111827'); renderer.outputColorSpace = T.SRGBColorSpace;
    document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
    const results = [];
    for (const [index, name] of ['operator.glb', 'KAI_BELMONT_PLAYER.glb', 'RUG_PULLER_RAIDER.glb'].entries()) {
      const scene = new T.Scene(); scene.add(new T.HemisphereLight(0xaacfff, 0x49314c, 2));
      const key = new T.DirectionalLight(0xffdbb2, 4); key.position.set(-3, 5, 4); scene.add(key);
      const rim = new T.DirectionalLight(0x50baff, 3); rim.position.set(3, 3, -2); scene.add(rim);
      const model = await new GLTFLoader().loadAsync('/public/assets/rugfire/characters/' + name);
      const actor = model.scene; scene.add(actor); actor.rotation.y = Math.PI * 0.15;
      const bounds = new T.Box3().setFromObject(actor), size = bounds.getSize(new T.Vector3());
      actor.scale.multiplyScalar(2.2 / size.y); actor.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(actor); actor.position.y -= box.min.y;
      if (model.animations[0]) { const mixer = new T.AnimationMixer(actor); mixer.clipAction(model.animations[0]).play(); mixer.update(.3); }
      const camera = new T.OrthographicCamera(-1.35, 1.35, 1.85, -1.85, .01, 100); camera.position.set(0, 5.2, 7.2); camera.lookAt(0, 1, 0);
      renderer.setViewport(index * 400, 0, 400, 550); renderer.setScissor(index * 400, 0, 400, 550); renderer.setScissorTest(true); renderer.render(scene, camera);
      results.push({ name, clips: model.animations.map(a => a.name) });
    }
    const alpha = [];
    for (const name of ['vex-walk-transparent', 'nyx-walk-transparent', 'rook-walk-transparent', 'neon-machinery-source']) {
      const bitmap = await createImageBitmap(await (await fetch('/art/rivals/phase02/' + name + '.png')).blob());
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bitmap, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 8) transparent++;
      alpha.push({ name, width: canvas.width, height: canvas.height, transparentRatio: transparent / (canvas.width * canvas.height), corner: Array.from(pixels.slice(0, 4)) });
      bitmap.close();
    }
    return { image: renderer.domElement.toDataURL('image/png').split(',')[1], models: results, alpha };
  });
  await fs.mkdir(path.join(root, 'docs/rivals-phase02'), { recursive: true });
  await fs.writeFile(path.join(root, 'docs/rivals-phase02/rugfire-model-audit.png'), Buffer.from(result.image, 'base64'));
  console.log(JSON.stringify(result.models));
  console.log(JSON.stringify(result.alpha));
} finally { await browser.close(); server.close(); }
