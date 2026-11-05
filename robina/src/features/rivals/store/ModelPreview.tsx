import { useEffect, useRef, useState } from 'react';
import { Box3, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer, ACESFilmicToneMapping, PMREMGenerator } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { studioPose } from './studioPose';
import type { ModelAsset } from './catalog';
import { MODEL_URLS } from './modelAssets';
/** Only mounted on explicit request inside one dialog. Demand rendering, no
 * animation loop, game asset owner, mixer, skeleton or shared material mutation. */
export default function ModelPreview({ model, finish, reduced = false }: { model: ModelAsset; finish?: string; reduced?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let disposed = false, renderer: WebGLRenderer | undefined, controls: OrbitControls | undefined;
    let resize: ResizeObserver | undefined, scene: Scene | undefined, environment: import('three').WebGLRenderTarget | undefined;
    setStatus('loading');
    const release = (root: import('three').Object3D) => {
      const geometries = new Set<import('three').BufferGeometry>(), materials = new Set<import('three').Material>(), textures = new Set<import('three').Texture>();
      root.traverse(node => { if (node instanceof Mesh) { geometries.add(node.geometry); for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m); } });
      materials.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) textures.add(v); }); m.dispose(); });
      textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose());
    };
    void (async () => {
      try {
        renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping;
        renderer.domElement.setAttribute('aria-label', 'Interactive reference model'); renderer.domElement.setAttribute('role', 'img');
        host.current?.appendChild(renderer.domElement);
        scene = new Scene();
        const generator = new PMREMGenerator(renderer), room = new RoomEnvironment();
        environment = generator.fromScene(room, .04); scene.environment = environment.texture;
        generator.dispose(); room.dispose();
        const camera = new PerspectiveCamera(35, 1, .01, 100);
        scene.add(new HemisphereLight(0xdfefff, 0x28252e, 2.4));
        for (const [color, intensity, position] of [[0xffe3bd, 4, [3, 5, 4]], [0x83b8d7, 3, [-4, 2, -2]]] as const) {
          const light = new DirectionalLight(color, intensity); light.position.set(position[0], position[1], position[2]); scene.add(light);
        }
        const gltf = await new GLTFLoader().loadAsync(MODEL_URLS[model]);
        if (disposed) { release(gltf.scene); return; }
        const root = gltf.scene, group = new Group();
        studioPose(root, gltf.animations, model === 'operative');
        // This is a private loader instance: color studies never touch game materials.
        if (finish) root.traverse(node => { if (node instanceof Mesh) for (const m of Array.isArray(node.material) ? node.material : [node.material]) if (m instanceof MeshStandardMaterial) { m.color.lerp(new Color(finish), .6); m.metalness = .5; } });
        const box = new Box3().setFromObject(root), size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
        root.position.sub(centre); group.add(root); group.scale.setScalar(2.2 / Math.max(size.x, size.y, size.z));
        if (model !== 'operative') group.rotation.set(.05, 1.15, -.12);
        scene.add(group);
        camera.position.set(model === 'operative' ? .4 : .15, .2, 4.9);
        controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.enableDamping = false;
        controls.minDistance = 3; controls.maxDistance = 7; controls.minPolarAngle = .4; controls.maxPolarAngle = Math.PI - .4;
        controls.rotateSpeed = reduced ? .5 : .8; controls.update();
        const render = () => { if (!disposed && renderer && scene) renderer.render(scene, camera); };
        controls.addEventListener('change', render);
        resize = new ResizeObserver(() => { const rect = host.current?.getBoundingClientRect(); if (!rect || !renderer || !rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); render(); });
        if (host.current) resize.observe(host.current);
        render(); setStatus('ready');
      } catch { if (!disposed) setStatus('error'); }
    })();
    return () => { disposed = true; resize?.disconnect(); controls?.dispose(); if (scene) release(scene); environment?.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove(); };
  }, [model, finish, reduced]);
  return <div className="rs-model" ref={host}>{status !== 'ready' && <p role="status">{status === 'error' ? '3D preview unavailable. Product details are still available.' : 'LOADING REFERENCE MODEL…'}</p>}<small>DRAG TO ROTATE · PINCH TO ZOOM · REFERENCE ASSET</small></div>;
}
