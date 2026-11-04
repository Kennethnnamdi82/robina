import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** Complete, closed street buildings with consistent real-world proportions.
 * The source city's photographic facades are baked into atlas UVs, so repeat
 * derivatives cannot wash the entire atlas into a flat white mip level. */
export function cityArchitecture(atlas:T.Texture){
 atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;atlas.flipY=false;atlas.needsUpdate=true;
 const photo=new T.MeshStandardMaterial({map:atlas,roughness:.8,metalness:.04});
 const stone=new T.MeshStandardMaterial({color:0xaaa18f,roughness:.9});
 const trim=new T.MeshStandardMaterial({color:0x655f55,roughness:.72,metalness:.18});
 const glass=new T.MeshStandardMaterial({color:0x20373e,roughness:.26,metalness:.45});
 const roof=new T.MeshStandardMaterial({color:0x555b59,roughness:.95});
 const models=new Map<'residence'|'commerce'|'headquarters',T.Group>();
 const tileUV=(geometry:T.BufferGeometry,tiles:number[])=>{const uv=geometry.getAttribute('uv');for(let i=0;i<uv.count;i++){const id=tiles[Math.floor(i/4)]??tiles[0],u=uv.getX(i),v=uv.getY(i);uv.setXY(i,((id%6)+(4+u*504)/512)/6,(Math.floor(id/6)+(4+v*504)/512)/6);}return geometry;};
 for(const [index,id]of (['residence','commerce','headquarters'] as const).entries()){
  const group=new T.Group();group.name='Permanent photographic '+id;
  const height=[18.8,17.5,23][index],facade=[17,2,14][index];
  const cube=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material,tiles?:number[])=>{let g:T.BufferGeometry=new T.BoxGeometry(w,h,d);if(tiles)g=tileUV(g,tiles);const mesh=new T.Mesh(g,m);mesh.position.set(x,y+h/2,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);};
  cube(0,0,0,11.2,3.2,11.2,stone);
  cube(0,3.2,0,11.08,height-3.2,11.08,photo,[facade,facade,1,1,facade,facade]);
  // A recessed trading floor, stone piers, real sills and a projecting cornice
  // give the photograph depth at street level rather than a painted cube.
  for(const side of [-1,1]){
   for(const x of [-3.55,0,3.55]){cube(x,.45,side*5.615,3.05,2.25,.035,glass);cube(side*5.615,.45,x,.035,2.25,3.05,glass);}
   for(const x of [-5.3,-1.78,1.78,5.3]){cube(x,0,side*5.66,.26,3.12,.18,stone);cube(side*5.66,0,x,.18,3.12,.26,stone);}
  }
  for(const y of [3.05,height-.38,height])cube(0,y,0,11.45,.16,11.45,trim);
  cube(0,height+.16,0,10.9,.09,10.9,roof);
  // Roof parapets and service enclosures stay present in every camera mode.
  for(const side of [-1,1]){cube(0,height+.20,side*5.48,11.12,.52,.16,stone);cube(side*5.48,height+.20,0,.16,.52,10.96,stone);}
  cube(1.6,height+.25,-1.8,3.0,1.3,2.5,roof);cube(-2.1,height+.25,2.0,1.4,.65,2.2,trim);
  // Small continuous courses catch grazing sun and anchor facade scale.
  for(let y=6.5;y<height-.5;y+=3.1)cube(0,y,0,11.19,.075,11.19,stone);
  const merged=new T.Group(),batches=new Map<T.Material,T.BufferGeometry[]>();
  group.updateMatrixWorld(true);for(const child of group.children){const mesh=child as T.Mesh,material=mesh.material as T.Material;if(!batches.has(material))batches.set(material,[]);mesh.geometry.applyMatrix4(mesh.matrixWorld);batches.get(material)!.push(mesh.geometry);}
  for(const [material,geometries]of batches){const geometry=mergeGeometries(geometries)!;geometries.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;merged.add(mesh);}
  merged.name=group.name;models.set(id,merged);
 }
 return models;
}
