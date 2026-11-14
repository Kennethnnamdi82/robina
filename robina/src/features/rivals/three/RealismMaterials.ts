import * as T from 'three';

export const REALISM_ROOT='/assets/rivals/realism/';
export const SURFACE_FAMILIES=['asphalt','paving','brick','concrete','wood','stucco'] as const;
export type SurfaceFamily=typeof SURFACE_FAMILIES[number];
export type SurfaceMaps=Record<'color'|'normal'|'roughness',T.Texture>;

/** Base colour is sRGB; normals and roughness MUST remain linear. */
export async function loadRealismSurfaces(signal:AbortSignal){
 const maps=new Map<SurfaceFamily,SurfaceMaps>(),owned:T.Texture[]=[];
 try{
  const results=await Promise.allSettled(SURFACE_FAMILIES.map(async family=>{
   const loaded=await Promise.allSettled((['color','normal','roughness'] as const).map(async role=>{
    const texture=await new T.TextureLoader().loadAsync(`${REALISM_ROOT}${family}-${role}.webp`);owned.push(texture);
    texture.name=`realism-${family}-${role}`;texture.colorSpace=role==='color'?T.SRGBColorSpace:T.NoColorSpace;
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=8;
    return [role,texture] as const;
   }));const failed=loaded.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
   const entries=loaded.map(r=>(r as PromiseFulfilledResult<readonly ['color'|'normal'|'roughness',T.Texture]>).value);maps.set(family,Object.fromEntries(entries) as SurfaceMaps);
  }));
  const failed=results.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
  if(signal.aborted)throw new DOMException('Material loading cancelled','AbortError');
  return maps;
 }catch(error){owned.forEach(t=>t.dispose());throw error;}
}

/** Clones UV transforms, not image storage. Caller owns the returned textures. */
export function applyRealismSurface(material:T.MeshStandardMaterial,maps:SurfaceMaps,repeat:number,owned:Set<T.Texture>,normal=.65){
 const copy=(source:T.Texture)=>{const t=source.clone();t.repeat.set(repeat,repeat);t.needsUpdate=true;owned.add(t);return t;};
 material.color.set(0xffffff);material.map=copy(maps.color);material.normalMap=copy(maps.normal);material.roughnessMap=copy(maps.roughness);
 material.normalScale.set(normal,normal);material.roughness=1;material.metalness=0;material.bumpMap=null;material.needsUpdate=true;
}

/** Geometry-based material separation is retained: no global plastic tint. */
export function finishShowcaseMaterial(material:T.MeshStandardMaterial,maps:Map<SurfaceFamily,SurfaceMaps>){
 const name=material.name;
 if(name==='brick'||name==='concrete'){
  const surface=maps.get(name);if(surface){material.map=surface.color;material.normalMap=surface.normal;material.roughnessMap=surface.roughness;material.normalScale.set(.65,.65);material.color.set(0xffffff);material.roughness=1;}
 }
 if(/glass/.test(name)){material.color.set(0x879f9e);material.metalness=.62;material.roughness=.12;material.envMapIntensity=1.25;}
 if(/steel|aluminum|bronze/.test(name)){material.metalness=.75;material.roughness=.34;}
 if(/sign_/.test(name)){material.emissive.set(0xffe2b4);material.emissiveMap=material.map;material.emissiveIntensity=.2;}
}

/** Metre-scaled UVs prevent a tiny counter and a 12m wall sharing one stretched
 * tile. Works with existing instanced architecture, without touching colliders. */
export function worldSurface(material:T.MeshStandardMaterial,maps:SurfaceMaps,meters:number){
 material.map=maps.color;material.normalMap=maps.normal;material.roughnessMap=maps.roughness;material.normalScale.set(.45,.45);material.color.set(0xffffff);material.roughness=1;
 material.customProgramCacheKey=()=>`rivals-world-pbr-${meters}`;
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
   vec4 surfacePosition=vec4(position,1.);vec3 surfaceNormal=normal;
   #ifdef USE_INSTANCING
    surfacePosition=instanceMatrix*surfacePosition;surfaceNormal=mat3(instanceMatrix)*surfaceNormal;
   #endif
   surfacePosition=modelMatrix*surfacePosition;surfaceNormal=abs(normalize(mat3(modelMatrix)*surfaceNormal));
   vec2 surfaceUv=surfaceNormal.y>.5?surfacePosition.xz:surfaceNormal.x>.5?surfacePosition.zy:surfacePosition.xy;
   vMapUv=surfaceUv/${meters.toFixed(3)};vNormalMapUv=vMapUv;vRoughnessMapUv=vMapUv;`);
 };
}
