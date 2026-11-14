import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Slice actual triangles (including UVs/normals), rather than crushing six
 * storeys into a bungalow. Each facade keeps a real shop floor, repeatable
 * apartment floors and its original roof. Gameplay footprints remain intact. */
export function facadeAtHeight(source:T.Group,height:number):T.Group{
 const bounds=new T.Box3().setFromObject(source),top=bounds.max.y,roofStart=top-2.25;
 const roofHeight=Math.min(2.25,height*.15),floorSpace=Math.max(0,height-roofHeight-4);
 const count=floorSpace<2.8?0:Math.max(1,Math.round(floorSpace/3.4));
 const baseHeight=count?4:height-roofHeight,storyHeight=count?floorSpace/count:0;
 const root=new T.Group();root.name=source.name+'-height-'+height.toFixed(2);
 source.updateMatrixWorld(true);
 const section=(minimum:number,maximum:number,offset:number,scale:number)=>{
  source.traverse(node=>{
   if(!(node instanceof T.Mesh))return;const sourceGeometry:T.BufferGeometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry,attributes=Object.entries(sourceGeometry.attributes) as [string,T.BufferAttribute|T.InterleavedBufferAttribute][],p=sourceGeometry.getAttribute('position');
   const result=new Map<string,number[]>(attributes.map(([name])=>[name,[]]));
   type Vertex=Record<string,number[]>;
   const clip=(polygon:Vertex[],limit:number,above:boolean)=>{
    const out:Vertex[]=[];
    for(let i=0;i<polygon.length;i++){
     const a=polygon[i],b=polygon[(i+1)%polygon.length],ay=a.position[1],by=b.position[1],insideA=above?ay>=limit:ay<=limit,insideB=above?by>=limit:by<=limit;
     if(insideA)out.push(a);
     if(insideA!==insideB){const t=(limit-ay)/(by-ay),v:Vertex={};for(const [name]of attributes)v[name]=a[name].map((n,j)=>T.MathUtils.lerp(n,b[name][j],t));out.push(v);}
    }return out;
   };
   for(let i=0;i<p.count;i+=3){
    let polygon:Vertex[]=[];for(let k=0;k<3;k++){const v:Vertex={};for(const [name,a]of attributes)v[name]=Array.from({length:a.itemSize},(_,j)=>a.getComponent(i+k,j));polygon.push(v);}
    polygon=clip(clip(polygon,minimum,true),maximum,false);
    for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){
     for(const [name]of attributes){const values=[...v[name]];if(name==='position')values[1]=(values[1]-minimum)*scale+offset;result.get(name)!.push(...values);}
    }
   }
   if(!result.get('position')!.length){if(sourceGeometry!==node.geometry)sourceGeometry.dispose();return;}
   const geometry=new T.BufferGeometry();for(const [name,a]of attributes)geometry.setAttribute(name,new T.Float32BufferAttribute(result.get(name)!,a.itemSize));if(geometry.hasAttribute('normal'))geometry.normalizeNormals();else geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const mesh=new T.Mesh(geometry,node.material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
   if(sourceGeometry!==node.geometry)sourceGeometry.dispose();
  });
 };
 section(0,4,0,baseHeight/4);
 for(let i=0;i<count;i++)section(4,7.4,4+i*storyHeight,storyHeight/3.4);
 section(roofStart,top,height-roofHeight,roofHeight/2.25);
 // Repeated storeys share one draw per material, not one draw per window/floor.
 const batches=new Map<T.Material,T.Mesh[]>();for(const child of root.children){const mesh=child as T.Mesh,material=mesh.material as T.Material;if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(mesh);}
 for(const [material,meshes]of batches){if(meshes.length<2)continue;const geometry=mergeGeometries(meshes.map(m=>m.geometry));if(!geometry)continue;for(const m of meshes){m.removeFromParent();m.geometry.dispose();}const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 return root;
}
