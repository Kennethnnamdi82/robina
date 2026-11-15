import {Box3,Group,Mesh,SkinnedMesh,Vector3,Color,MeshStandardMaterial,type Object3D,type Material} from 'three';
import type {OutfitId} from '../store/outfits';

const names:Record<string,string>={Bip01:'root',Bip01_Pelvis:'pelvis',Bip01_Spine:'spine_01',Bip01_Spine1:'spine_02',Bip01_Spine2:'spine_03',Bip01_Neck:'neck_01',Bip01_Head:'Head'};
for(const side of ['L','R']){
  const s=side.toLowerCase();
  for(const [a,b]of Object.entries({Clavicle:'clavicle',UpperArm:'upperarm',Forearm:'lowerarm',Hand:'hand',Thigh:'thigh',Calf:'calf',Foot:'foot',Toe0:'ball'}))names[`Bip01_${side}_${a}`]=`${b}_${s}`;
  ['thumb','index','middle','ring','pinky'].forEach((digit,n)=>{for(let j=0;j<3;j++)names[`Bip01_${side}_Finger${n}${j||''}`]=`${digit}_0${j+1}_${s}`;});
}
/** The supplied collection and field operative share the SAME military skeleton.
 * Attach authored armor while still in its studio pose, restore the skin bind,
 * then reuse the calibrated field animation clips. No controller/IK changes. */
export function prepareOutfit(root:Object3D,id:OutfitId){
  const bones=new Map<string,Object3D>(),skins:SkinnedMesh[]=[],armor:Mesh[]=[];
  root.traverse(n=>{if('isBone'in n&&n.isBone){n.name=names[n.name]??n.name;bones.set(n.name,n);}if(n instanceof SkinnedMesh)skins.push(n);else if(n instanceof Mesh)armor.push(n);});
  for(const required of ['pelvis','spine_01','spine_03','Head','hand_r','hand_l','upperarm_r','upperarm_l'])if(!bones.has(required))throw Error('Outfit rig is missing '+required);
  root.updateMatrixWorld(true);
  const centre=new Vector3();
  for(const part of armor){
    part.getWorldPosition(centre);root.worldToLocal(centre);
    const name=part.name.toLowerCase(),side=centre.x<0?'r':'l';
    let joint=/visor|face|helmet|optic|lens|mantle collar/.test(name)?'Head':/gauntlet|wrist/.test(name)?'lowerarm_'+side:/shoulder|pauldron|upper arm/.test(name)?'upperarm_'+side:/thigh/.test(name)?'thigh_'+side:/shin|kneepad/.test(name)?'calf_'+side:/mantle|belt/.test(name)?'pelvis':'spine_03';
    if(/^(lowerarm|upperarm|thigh|calf)_/.test(joint)){
      const prefix=joint.slice(0,-1),right=bones.get(prefix+'r'),left=bones.get(prefix+'l'),world=part.getWorldPosition(new Vector3());
      if(right&&left)joint=prefix+(right.getWorldPosition(new Vector3()).distanceToSquared(world)<left.getWorldPosition(new Vector3()).distanceToSquared(world)?'r':'l');
    }
    bones.get(joint)?.attach(part);
  }
  for(const skin of skins)skin.skeleton.pose();
  root.updateMatrixWorld(true);
  const bounds=new Box3();for(const skin of skins)bounds.union(new Box3().setFromObject(skin));
  const size=bounds.getSize(new Vector3()),mid=bounds.getCenter(new Vector3());
  const wrapper=new Group();wrapper.name='RivalsPurchasedOutfit/'+id;wrapper.add(root);
  // Normalize only the wrapper; animation track positions keep source units.
  wrapper.scale.setScalar(1.78/Math.max(.01,size.y));wrapper.position.set(-mid.x*wrapper.scale.x,-bounds.min.y*wrapper.scale.y,-mid.z*wrapper.scale.z);
  wrapper.userData.rivalsOutfit=id;
  wrapper.traverse(n=>{if(n instanceof Mesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;}});
  return wrapper;
}
export const FINISHES:Record<string,string>={desert:'#c4ae7d',pulse:'#9dcf91',steel:'#8e9ba7',fire:'#d17f70',frost:'#95d5e5',protocol:'#d8b86c',diamond:'#c7d1e5'};
export class WeaponFinish {
  private meshes=new Map<Mesh,{original:Material|Material[];finish:string|null}>();
  private materials=new Set<Material>();
  apply(root:Object3D,id:string|null){
    root.traverse(node=>{
      if(!(node instanceof Mesh)||node.userData.rivalsNoFinish)return;
      if(!(Array.isArray(node.material)?node.material:[node.material]).some(m=>m instanceof MeshStandardMaterial))return;
      let saved=this.meshes.get(node);if(!saved){saved={original:node.material,finish:null};this.meshes.set(node,saved);}
      if(saved.finish===id)return;
      for(const m of Array.isArray(node.material)?node.material:[node.material])if(this.materials.delete(m))m.dispose();
      const tint=(original:Material)=>{
        if(!(original instanceof MeshStandardMaterial)||!id||!FINISHES[id])return original;
        const m=original.clone();m.color.lerp(new Color(FINISHES[id]),.72);m.roughness=id==='diamond'?.24:.6;m.metalness=id==='protocol'?.72:.42;this.materials.add(m);return m;
      };
      node.material=Array.isArray(saved.original)?saved.original.map(tint):tint(saved.original);saved.finish=id;
    });
  }
  dispose(){for(const [mesh,saved]of this.meshes)mesh.material=saved.original;this.materials.forEach(m=>m.dispose());this.materials.clear();this.meshes.clear();}
}
