import {BufferGeometry,Matrix4,Mesh,Object3D,type Material} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Batch only explicitly static presentation parts. Animated groups, skins and
 * interaction objects stay separate. Callers retain ownership of source assets. */
export function batchPresentation(root:Object3D,own:(geometry:BufferGeometry)=>BufferGeometry,skip:(node:Object3D)=>boolean=()=>false){
  root.updateMatrixWorld(true);const inverse=new Matrix4().copy(root.matrixWorld).invert(),transform=new Matrix4();
  const groups=new Map<Material,{parts:BufferGeometry[];meshes:Mesh[]}>();
  const visit=(node:Object3D)=>{
    if(skip(node))return;
    if(node instanceof Mesh&&!('isSkinnedMesh' in node)&&!Array.isArray(node.material)){
      const geometry=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
      geometry.applyMatrix4(transform.multiplyMatrices(inverse,node.matrixWorld));
      const group=groups.get(node.material)??{parts:[],meshes:[]};group.parts.push(geometry);group.meshes.push(node);groups.set(node.material,group);
    }
    node.children.forEach(visit);
  };
  root.children.forEach(visit);
  for(const [material,group]of groups){
    const merged=mergeGeometries(group.parts,false);group.parts.forEach(part=>part.dispose());if(!merged)continue;
    const mesh=new Mesh(own(merged),material);mesh.name='Batched presentation';mesh.receiveShadow=group.meshes.some(mesh=>mesh.receiveShadow);mesh.frustumCulled=false;
    group.meshes.forEach(mesh=>mesh.removeFromParent());root.add(mesh);
  }
}
