import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh, SkinnedMesh, TextureLoader, SRGBColorSpace, Box3, Vector3, type Object3D, type AnimationClip, type BufferGeometry } from 'three';
import { MissionAssets, batchRigidParts, disposeObject, assetURL, type ModelId } from '../../rugfire/assets';
import { createFieldKnife } from './EquipmentArt';
import type { EquipmentId } from './Loadout';
import { CityAssets, CITY_BINARY_URLS } from './CityAssets';
import {loadAssetBytes,warmAssetBytes} from './AssetBytes';
import { securityGaits } from './SecurityLocomotion';

/** The older batching helper removes original meshes even when a merge fails.
 * Keep mixed UV/normal layouts intact instead of losing supplied body parts. */
function compatibleForBatching(root: import('three').Object3D) {
  const layouts = new Map<import('three').Material, string>(); let compatible = true;
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    if (node instanceof SkinnedMesh) { compatible = false; return; }
    if (Array.isArray(node.material)) return;
    const layout = String(Boolean(node.geometry.index)) + Object.keys(node.geometry.attributes).sort().map(name => { const attribute = node.geometry.getAttribute(name); return `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`; }).join(',');
    if (layouts.has(node.material) && layouts.get(node.material) !== layout) compatible = false;
    layouts.set(node.material,layout);
  });
  return compatible;
}
const models: Partial<Record<ModelId,string>> = {
  player: 'characters/operator.glb',kol: 'characters/FAKE_KOL_INFLUENCER.glb',rugger: 'characters/RUG_PULLER_RAIDER.glb',whale: 'characters/WHALE_ENFORCER.glb',boss: 'characters/MEGA_RUGGER_BOSS.glb',
  rifle: 'weapons/ak47.glb',smg: 'weapons/viper_smg.glb',pistol: 'weapons/raven_pistol.glb',
  crate: 'environment/cargo_crate.glb',
  health: 'props/health_kit.glb',
};
/** Expand mixed index layouts before the existing safe joint-local merge.
 * Vertex values/animated joint boundaries are unchanged; skins are excluded. */
export function batchRaidRigid(root:Object3D,clips:AnimationClip[]){
 let skinned=false;const meshes:Mesh[]=[];root.traverse(n=>{if(n instanceof SkinnedMesh)skinned=true;else if(n instanceof Mesh)meshes.push(n);});if(skinned)return;
 root.updateMatrixWorld(true);if(meshes.some(mesh=>mesh.matrixWorld.determinant()<0))return;
 const replaced=new Set<BufferGeometry>();for(const mesh of meshes)if(mesh.geometry.index){const original=mesh.geometry;mesh.geometry=original.toNonIndexed();replaced.add(original);}replaced.forEach(g=>g.dispose());
 if(compatibleForBatching(root))batchRigidParts(root,clips);
}
const modelURL=(id:ModelId,path:string)=>id==='player'?'/assets/rivals/characters/universal-operative.glb?v=evasive-controls-4':['rifle','smg','pistol'].includes(id)?`/assets/rivals/combat3d/weapons/${id}.glb?v=combat-polish-2`:assetURL(path);
export const preloadRaidAssets=(progress?:(fraction:number)=>void)=>warmAssetBytes([...CITY_BINARY_URLS,...Object.entries(models).map(([id,path])=>modelURL(id as ModelId,path))],progress,Boolean(progress));
/** Load only compatible actors/weapons needed by this raid, using the existing asset owner. */
export class RaidAssets extends MissionAssets {
  readonly city = new CityAssets();
  private knife = createFieldKnife();
  equipment(id: EquipmentId) { return id === 'knife' ? this.knife.clone(true) : this.instance(id).root; }
  private stop = new AbortController(); private released = false;
  override async load(progress: (loaded: number,total: number) => void) {
    const loader = new GLTFLoader(),entries = Object.entries(models) as [ModelId,string][];
    let loaded = 0;
    const timeout = setTimeout(() => this.stop.abort(),60000);
    try {
      await Promise.all([this.city.load(),(async()=>{
      await Promise.all(entries.map(async ([id,path]) => {
        const url=modelURL(id,path);
        const gltf = await loader.parseAsync(await loadAssetBytes(url,this.stop.signal),'/assets/rugfire/');
        if (this.released || this.stop.signal.aborted) { disposeObject(gltf.scene); return; }
        const elbow = gltf.scene.getObjectByName('Elbow_R');
        if (elbow) { gltf.scene.updateMatrixWorld(true); const hand = elbow.children.find(child => child.name.startsWith('human_gloved_hand')); if (hand) { const centre = new Box3().setFromObject(hand).getCenter(new Vector3()); elbow.userData.rivalsHand = elbow.worldToLocal(centre).toArray(); } }
        if (!['player','rifle','smg','pistol'].includes(id)) batchRaidRigid(gltf.scene,gltf.animations);
        gltf.scene.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true; } if (o instanceof SkinnedMesh) o.frustumCulled = false; });
        this.models.set(id,gltf); progress(++loaded,entries.length + 1);
      }));
      const human=this.models.get('player');if(human)this.city.humanoid={scene:human.scene,animations:human.animations};
      if(human)for(const id of ['kol','rugger','whale','boss'] as const){const model=this.models.get(id);if(model)model.animations.push(...securityGaits(human,model.scene));}
      await Promise.all(['flash','smoke','blast'].map(async name => { const fx = await new TextureLoader().loadAsync(`/assets/rivals/combat3d/fx/${name}.webp`); if (this.released) fx.dispose(); else { fx.colorSpace = SRGBColorSpace; this.textures.set('combat-' + name,fx); } }));
      progress(loaded,entries.length + 1);
      const grass = await new TextureLoader().loadAsync('/assets/rugfire/textures/grass-alpha.webp');
      if (this.released) grass.dispose(); else this.textures.set('city-grass',grass);
      })()]);
      progress(loaded+1,entries.length+1);
      if (this.stop.signal.aborted) throw new Error('Supplied-model loading timed out.');
    } catch (error) { this.stop.abort();this.city.dispose();throw error; }
    finally { clearTimeout(timeout); }
  }
  override dispose() { if (this.released) return; this.released = true; this.stop.abort(); this.city.dispose(); disposeObject(this.knife); super.dispose(); }
}
