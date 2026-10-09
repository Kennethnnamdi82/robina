import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ASSET_VERSION } from './assetVersion';

export const ASSET_BASE = '/assets/rugfire/';
export const assetURL = (path: string) => ASSET_BASE + path + '?v=' + ASSET_VERSION;
const paths = {
  player: 'characters/operator.glb', kol: 'characters/FAKE_KOL_INFLUENCER.glb',
  rugger: 'characters/RUG_PULLER_RAIDER.glb', whale: 'characters/WHALE_ENFORCER.glb', boss: 'characters/MEGA_RUGGER_BOSS.glb',
  rifle: 'weapons/ak47.glb', smg: 'weapons/viper_smg.glb', pistol: 'weapons/raven_pistol.glb',
  barricade: 'environment/reinforced_barricade.glb', car: 'environment/burned_sedan.glb',
  crate: 'environment/cargo_crate.glb', market: 'environment/loot_market.glb', bank: 'environment/shadow_bank.glb',
  hq: 'environment/exchange_hq.glb', lamp: 'environment/neon_streetlamp.glb',
  health: 'props/health_kit.glb', ammo: 'props/ammo_cache.glb',
} as const;
export type ModelId = keyof typeof paths;

/** One owner per mission. No global GPU cache survives a restart. */
export class MissionAssets {
  readonly models = new Map<ModelId, GLTF>();
  readonly textures = new Map<string, T.Texture>();
  private controller = new AbortController();
  private disposed = false;
  async load(progress: (loaded: number, total: number) => void) {
    const loader = new GLTFLoader(), textureLoader = new T.TextureLoader();
    const entries = Object.entries(paths) as [ModelId, string][];
    const maps = ['leafy-ground', 'grass-color', 'grass-alpha'];
    const total = entries.length + maps.length; let loaded = 0;
    const timeout = setTimeout(() => this.controller.abort(), 25000);
    const tasks = [
      ...entries.map(async ([id, path]) => {
        const response = await fetch(assetURL(path), { signal: this.controller.signal });
        if (!response.ok) throw new Error(path + ': HTTP ' + response.status);
        const model = await loader.parseAsync(await response.arrayBuffer(), ASSET_BASE + path.substring(0, path.lastIndexOf('/') + 1));
        if (this.disposed || this.controller.signal.aborted) { disposeObject(model.scene); return; }
        if (id !== 'player') batchRigidParts(model.scene, model.animations);
        model.scene.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; if (o instanceof T.SkinnedMesh) o.frustumCulled = false; } });
        this.models.set(id, model); progress(++loaded, total);
      }),
      ...maps.map(async name => {
        const response = await fetch(assetURL('textures/' + name + '.webp'), { signal: this.controller.signal });
        if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
        const url = URL.createObjectURL(await response.blob());
        try {
          const texture = await textureLoader.loadAsync(url);
          if (this.disposed || this.controller.signal.aborted) { texture.dispose(); return; }
          texture.colorSpace = name === 'grass-alpha' ? T.NoColorSpace : T.SRGBColorSpace;
          texture.anisotropy = 4; this.textures.set(name, texture); progress(++loaded, total);
        } finally { URL.revokeObjectURL(url); }
      }),
    ];
    try { await Promise.all(tasks); if (this.controller.signal.aborted) throw new Error('Asset preparation timed out'); }
    catch (error) { this.controller.abort(); throw error; }
    finally { clearTimeout(timeout); }
  }
  instance(id: ModelId) {
    const model = this.models.get(id); if (!model) throw new Error('Missing mission asset: ' + id);
    return { root: clone(model.scene), clips: model.animations };
  }
  dispose() {
    this.disposed = true; this.controller.abort();
    this.models.forEach(model => disposeObject(model.scene)); this.models.clear();
    this.textures.forEach(t => t.dispose()); this.textures.clear();
  }
}

// Bake only parts beneath the same animated joint. Animation targets stay intact.
function batchRigidParts(root: T.Object3D, clips: T.AnimationClip[]) {
  const animated = new Set(clips.flatMap(c => c.tracks.map(t => t.name.split('.')[0])));
  const joints: T.Object3D[] = [root]; root.traverse(o => { if (o !== root && animated.has(o.name)) joints.push(o); });
  root.updateMatrixWorld(true);
  for (const joint of joints) {
    const batches = new Map<T.Material, T.BufferGeometry[]>(), originals: T.Mesh[] = [];
    const inverse = joint.matrixWorld.clone().invert();
    const collect = (o: T.Object3D) => {
      if (o !== joint && animated.has(o.name)) return;
      if (o !== joint && o instanceof T.Mesh && !Array.isArray(o.material)) {
        const geometry = o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
        if (!batches.has(o.material)) batches.set(o.material, []);
        batches.get(o.material)!.push(geometry); originals.push(o);
      }
      o.children.forEach(collect);
    };
    collect(joint);
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      if (geometry) joint.add(new T.Mesh(geometry, material));
    }
    for (const mesh of originals) { mesh.geometry.dispose(); if (mesh.children.length) mesh.geometry = new T.BufferGeometry(); else mesh.removeFromParent(); }
  }
}

export function disposeObject(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  root.traverse(o => {
    if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
    if (!(o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points)) return;
    geometries.add(o.geometry);
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(material); Object.values(material).forEach(value => { if (value instanceof T.Texture) textures.add(value); });
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}
