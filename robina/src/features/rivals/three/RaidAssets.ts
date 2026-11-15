import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh, SkinnedMesh, TextureLoader, SRGBColorSpace, Box3, Vector3, Group, type Object3D, type AnimationClip, type BufferGeometry } from 'three';
import { MissionAssets, batchRigidParts, disposeObject, assetURL, type ModelId } from '../../rugfire/assets';
import { createFieldKnife } from './EquipmentArt';
import type { EquipmentId } from './Loadout';
import { CityAssets, CITY_BINARY_URLS } from './CityAssets';
import {loadAssetBytes,warmAssetBytes} from './AssetBytes';
import { securityGaits } from './SecurityLocomotion';
import { finishOperative } from './OperativeFinish';
import {collectionWeaponDefinition} from './Loadout';
import {MODEL_URLS} from '../store/modelAssets';
import type {ModelAsset} from '../store/catalog';
import {isOutfit} from '../store/outfits';
import {prepareOutfit} from './CollectionAppearance';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

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
const modelURL=(id:ModelId,path:string)=>id==='player'?'/assets/rivals/realism/field-operative.glb?v=field-1':['rifle','smg','pistol'].includes(id)?`/assets/rivals/combat3d/weapons/${id}.glb?v=combat-polish-2`:assetURL(path);
export const preloadRaidAssets=(progress?:(fraction:number)=>void)=>warmAssetBytes([...CITY_BINARY_URLS,...Object.entries(models).map(([id,path])=>modelURL(id as ModelId,path))],progress,Boolean(progress));
/** Load only compatible actors/weapons needed by this raid, using the existing asset owner. */
export class RaidAssets extends MissionAssets {
  readonly city = new CityAssets();
  readonly collection=new Map<string,Object3D>();
  private outfits=new Map<string,Object3D>();
  async outfit(id:string){
    if(!isOutfit(id))throw Error('Unknown purchased outfit');
    if(!this.outfits.has(id)){
      const gltf=await new GLTFLoader().parseAsync(await loadAssetBytes(MODEL_URLS[id],this.stop.signal),'/assets/rivals/store/models/');
      if(this.released){disposeObject(gltf.scene);throw Error('Assets disposed');}
      this.outfits.set(id,prepareOutfit(gltf.scene,id));
    }
    return {root:clone(this.outfits.get(id)!),clips:this.models.get('player')!.animations};
  }
  async loadCollection(id:string){
    if(this.collection.has(id)||!collectionWeaponDefinition(id))return;
    const definition=collectionWeaponDefinition(id)!;
    const source=await new GLTFLoader().parseAsync(await loadAssetBytes(MODEL_URLS[id as ModelAsset],this.stop.signal),'/assets/rivals/store/models/');
    if(this.released){disposeObject(source.scene);return;}
    // Retain the calibrated grip/muzzle/sight sockets and replace only geometry.
    // Player skeleton, IK, hitboxes and animation controller are unchanged.
    const shell=this.equipment(definition.model),targetBox=new Box3().setFromObject(shell),shape=new Group();shape.add(source.scene);
    const initial=new Box3().setFromObject(shape).getSize(new Vector3());
    if(initial.x>initial.z&&initial.x>initial.y)shape.rotation.y=Math.PI/2;
    else if(initial.y>initial.z)shape.rotation.x=Math.PI/2;
    shape.updateMatrixWorld(true);
    const bounds=new Box3().setFromObject(shape),size=bounds.getSize(new Vector3());
    const scale=targetBox.getSize(new Vector3()).z/Math.max(.001,size.z);
    shape.scale.setScalar(scale);shape.position.copy(bounds.getCenter(new Vector3())).multiplyScalar(-scale).add(targetBox.getCenter(new Vector3()));
    shell.traverse(node=>{if(node instanceof Mesh)node.visible=false;});
    shape.traverse(node=>{if(node instanceof Mesh){node.castShadow=true;node.receiveShadow=true;}});
    shell.add(shape);this.collection.set(id,shell);
  }
  collectionInstance(id:string){return this.collection.get(id)?.clone(true);}
  private knife = createFieldKnife();
  equipment(id: EquipmentId) { return id === 'knife' ? this.knife.clone(true) : this.instance(id).root; }
  private stop = new AbortController(); private released = false;
  override async load(progress: (loaded: number,total: number) => void) {
    const loader = new GLTFLoader(),entries = Object.entries(models) as [ModelId,string][];
    let loaded = 0;
    const timeout = setTimeout(() => this.stop.abort(),120000);
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
        if(id==='player')finishOperative(gltf.scene);
        this.models.set(id,gltf); progress(++loaded,entries.length + 1);
      }));
      // Civilian/social actors have their own source, not the armed military body.
      const human=await loader.parseAsync(await loadAssetBytes('/assets/rivals/characters/universal-operative.glb',this.stop.signal),'/assets/rivals/characters/');
      if(this.released){disposeObject(human.scene);return;}
      this.city.humanoid={scene:human.scene,animations:human.animations};this.city.ownHumanoid(human.scene);
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
  override dispose() { if (this.released) return; this.released = true; this.stop.abort(); this.city.dispose(); this.outfits.forEach(root=>disposeObject(root));this.outfits.clear();this.collection.forEach(root=>disposeObject(root));this.collection.clear();disposeObject(this.knife); super.dispose(); }
}
