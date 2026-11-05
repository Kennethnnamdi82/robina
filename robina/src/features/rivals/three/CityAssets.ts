import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {QualityId} from '../core/presentation';
import {cityArchitecture} from './CityArchitecture';
import {installCityAtlas} from './CityAtlas';
import {loadAssetBytes} from './AssetBytes';
export const CITY_MODELS=['residence','commerce','headquarters','street','sidewalk','planter','drain','ac','bollard','wall','window','computer','access','vent','rail','barrel','crate','platform'] as const;
export type CityModel=typeof CITY_MODELS[number];
export const CITY_DETAILS={sedan:'Car_1_1',coupe:'Car_2_2',taxi:'Taxi',police:'Police',van:'Truck_1',lorry:'Main_Truck_1',tanker:'Gas_Truck',bus:'Bus_1',tree:'Tree_1',treeTall:'Tree_2',busStop:'Bus_Stop',hydrant:'Hydrant',newsstand:'Newspaper_Stand',bin:'Trash_Small',dumpster:'Trash_Big',cone:'Cone',streetLamp:'Light',skylineHome:'Building_3',skylineShop:'Building_8',skylineTower:'Building_9',roadBarrier:'Road_Barrier'} as const;
export type CityDetail=keyof typeof CITY_DETAILS;
export const CITY_BINARY_URLS=['/assets/rivals/city/optimized/city-blocks.glb?v=fast-city-1','/assets/rivals/city/living-city.glb','/assets/rivals/city/optimized/street-car.glb?v=full-silhouette-2','/assets/rivals/city/premium/delivery-truck.glb'] as const;
/** Offline-batched architecture and vehicles; no geometry merges on entry. */
export class CityAssets {
 readonly models=new Map<CityModel,T.Group>();readonly details=new Map<CityDetail,T.Group>();readonly skyline=new Map<CityModel,T.Group>();
 humanoid?:{scene:T.Group;animations:T.AnimationClip[]};readonly textures=new Map<string,T.Texture>();
 private roots:T.Group[]=[];private materials=new Set<T.MeshStandardMaterial>();private normals=new Map<T.MeshStandardMaterial,T.Texture>();
 private stop=new AbortController();private released=false;
 async load(){
  const loader=new GLTFLoader();
  const parsed=await Promise.all(CITY_BINARY_URLS.map(async url=>{const gltf=await loader.parseAsync(await loadAssetBytes(url,this.stop.signal),'/assets/rivals/city/');if(this.released){this.releaseRoot(gltf.scene);throw new DOMException('City loading cancelled','AbortError');}this.roots.push(gltf.scene);return gltf;}));
  if(this.released)return;
  const [blocks,details,car,truck]=parsed;installCityAtlas(blocks.scene);
  for(const id of ['residence','commerce','headquarters','planter','ac','computer','vent','barrel','crate','platform'] as const){const group=blocks.scene.getObjectByName(id);if(!group)throw Error('Prepared city missing '+id);this.models.set(id,group as T.Group);}
  blocks.scene.traverse(n=>{if(n instanceof T.Mesh)for(const m of Array.isArray(n.material)?n.material:[n.material])if(m instanceof T.MeshStandardMaterial){this.materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture){value.anisotropy=4;this.textures.set(value.uuid,value);}}});
  details.scene.updateMatrixWorld(true);
  for(const [id,name]of Object.entries(CITY_DETAILS)){
   const source=details.scene.getObjectByName(name);if(!source)throw Error('City atlas missing '+name);
   const root=new T.Group(),clone=source.clone(true);source.matrixWorld.decompose(clone.position,clone.quaternion,clone.scale);root.add(clone);
   root.traverse(n=>{if(n instanceof T.Mesh)n.castShadow=n.receiveShadow=true;});this.details.set(id as CityDetail,root);this.roots.push(root);
   if(['newsstand','busStop','bus','tanker'].includes(id))root.traverse(n=>{if(!(n instanceof T.Mesh))return;const neutral=(source:T.Material)=>{const m=(source as T.MeshStandardMaterial).clone();m.roughness=.62;m.metalness=.16;m.customProgramCacheKey=()=>'city-utility-finish-v2';m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat utilityLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(utilityLuma),.22);');};return m;};n.material=Array.isArray(n.material)?n.material.map(neutral):neutral(n.material);});
  }
  for(const id of ['sedan','coupe','taxi','police'] as const)this.details.set(id,car.scene);
  for(const id of ['van','lorry'] as const)this.details.set(id,truck.scene);
  await Promise.all([
   new T.TextureLoader().loadAsync('/assets/rivals/city/realistic-facades.webp').then(t=>{if(this.released){t.dispose();return;}this.textures.set('skyline',t);for(const [id,model]of cityArchitecture(t))this.skyline.set(id,model);}),
   ...[['premium-asphalt','/assets/rivals/city/premium/asphalt-albedo.webp'],['city-oak','/assets/rivals/city/oak-foliage.webp']].map(async([name,url])=>{const t=await new T.TextureLoader().loadAsync(url);if(this.released){t.dispose();return;}t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;t.name=name;this.textures.set(name,t);}),
  ]);
 }
 setQuality(quality:QualityId){for(const m of this.materials){if(m.normalMap&&!this.normals.has(m))this.normals.set(m,m.normalMap);const normal=quality==='low'?null:this.normals.get(m)??null;if(m.normalMap!==normal){m.normalMap=normal;m.needsUpdate=true;}}}
 texture(name:string){return this.textures.get(name)??[...this.textures.values()].find(t=>t.name===name);}
 private releaseRoot(root:T.Object3D){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();root.traverse(n=>{if(!(n instanceof T.Mesh))return;geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 dispose(){if(this.released)return;this.released=true;this.stop.abort();const root=new T.Group();this.roots.forEach(r=>root.add(r));this.skyline.forEach(r=>root.add(r));this.releaseRoot(root);this.textures.forEach(t=>t.dispose());this.models.clear();this.details.clear();this.skyline.clear();this.materials.clear();this.normals.clear();this.textures.clear();this.roots=[];}
}
