import fs from 'node:fs/promises';
import * as T from 'three';
const bytes=await fs.readFile(new URL('../src/features/realistic_city.glb',import.meta.url));
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const records=[];
function visit(index,parent=new T.Matrix4()){
  const n=json.nodes[index],local=n.matrix?new T.Matrix4().fromArray(n.matrix):new T.Matrix4().compose(new T.Vector3().fromArray(n.translation??[0,0,0]),new T.Quaternion().fromArray(n.rotation??[0,0,0,1]),new T.Vector3().fromArray(n.scale??[1,1,1]));
  const world=parent.clone().multiply(local);
  if(n.mesh!==undefined){const mesh=json.meshes[n.mesh],box=new T.Box3();let tris=0;const materials=[];
    for(const p of mesh.primitives){const a=json.accessors[p.attributes.POSITION];box.union(new T.Box3(new T.Vector3().fromArray(a.min),new T.Vector3().fromArray(a.max)).applyMatrix4(world));tris+=json.accessors[p.indices??p.attributes.POSITION].count/3;materials.push(json.materials[p.material]?.name);}
    records.push({node:index,mesh:n.mesh,size:box.getSize(new T.Vector3()).toArray().map(v=>+v.toFixed(1)),center:box.getCenter(new T.Vector3()).toArray().map(v=>+v.toFixed(1)),tris,materials});
  }
  n.children?.forEach(i=>visit(i,world));
}
json.scenes[0].nodes.forEach(i=>visit(i));
console.log(JSON.stringify({asset:json.asset,records},null,1));
