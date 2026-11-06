import { AnimationMixer, Box3, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Quaternion, Vector3, type AnimationClip, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { OUTFITS, type OutfitId } from './outfits';

/** Preparation-time only: real supplied uniforms, skin left intact. The exported
 * private GLBs are shared by thumbnails and the optional orbit inspector. */
export function dressCollection(root: Object3D, clips: readonly AnimationClip[], id: OutfitId) {
  const outfit = OUTFITS[id];
  const clip = clips.find(c => /Idle_Neutral$/.test(c.name));
  if (clip) { const mixer = new AnimationMixer(root); mixer.clipAction(clip).play(); mixer.update(.45); }
  root.updateMatrixWorld(true);
  const group = new Group(); group.name = 'RIVALS / ' + id.toUpperCase(); group.add(root);
  const box = new Box3().setFromObject(root), size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
  root.position.sub(new Vector3(centre.x, box.min.y, centre.z)); group.scale.setScalar(1.82 / size.y);
  group.updateMatrixWorld(true);
  if (!clip) {
    // The supplied military figure is a bind-pose rig. Relax its actual arm
    // bones, rather than displaying a T-pose or substituting the base player.
    for (const [side, sign] of [['R', -1], ['L', 1]] as const) {
      const upper = root.getObjectByName('Bip01_' + side + '_UpperArm'), lower = root.getObjectByName('Bip01_' + side + '_Forearm');
      if (!upper || !lower) continue;
      const origin = upper.getWorldPosition(new Vector3()), end = lower.getWorldPosition(new Vector3());
      const rotation = new Quaternion().setFromUnitVectors(end.sub(origin).normalize(), new Vector3(sign * .18, -.94, .12).normalize());
      const world = upper.getWorldQuaternion(new Quaternion()).premultiply(rotation), parent = upper.parent!.getWorldQuaternion(new Quaternion()).invert();
      upper.quaternion.copy(parent.multiply(world)); group.updateMatrixWorld(true);
    }
  }
  const changed = new Map<MeshStandardMaterial, MeshStandardMaterial>();
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const finish = (source: MeshStandardMaterial) => {
      if (changed.has(source)) return changed.get(source)!;
      const m = source.clone(), name = m.name.toLowerCase(); changed.set(source, m);
      m.roughness = /visor|metal|earrings/i.test(name) ? .32 : .83; m.metalness = /visor|metal|earrings/i.test(name) ? .5 : .06;
      if (/skin|head|eye|hair|mouth/i.test(name)) return m;
      if (id === 'urban') { if (/equipment|helmet/.test(name)) m.color.set(outfit.gear); return m; }
      const trim = /accent|lightblue|earrings|visor|equipment|helmet/.test(name);
      m.color.set(trim ? outfit.gear : outfit.body);
      if (id === 'neon' && /purple/.test(name)) m.color.set('#121c20');
      if (id === 'crimson' && /red/.test(name)) m.color.set('#a33043');
      if (id === 'cyber' && trim) { m.emissive = new Color('#117f8c'); m.emissiveIntensity = .04; }
      if (id === 'midnight' && /visor/.test(name)) { m.color.set('#477dba'); m.metalness = .7; }
      return m;
    };
    node.material = Array.isArray(node.material) ? node.material.map(m => finish(m as MeshStandardMaterial)) : finish(node.material as MeshStandardMaterial);
    node.frustumCulled = false;
  });
  const dressed = new Group(); dressed.add(group); dressed.name = group.name;
  const accent = new Color(id==='cyber'?'#73cdd5':id==='neon'?'#9dbf54':id==='crimson'?'#c37a79':id==='midnight'?'#628cb8':'#c3a36c');
  const trim = new MeshStandardMaterial({color:accent,roughness:.58,metalness:.36});
  const armor = new MeshStandardMaterial({color:outfit.gear,roughness:.76,metalness:.12});
  const facePanel=(width:number,height:number,y:number,glass:boolean)=>{
    const positions:number[]=[],indices:number[]=[];
    for(let row=0;row<3;row++)for(let col=0;col<13;col++){
      const u=col/6-1,v=row/2,x=u*width*.5*(glass?1:.8+v*.2);
      positions.push(x,y+(v-.5)*height,.118+.035*(1-u*u));
      if(row<2&&col<12){const i=row*13+col;indices.push(i,i+1,i+13,i+1,i+14,i+13);}
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=glass?new MeshPhysicalMaterial({color:'#243744',roughness:.2,metalness:.32,clearcoat:1,side:DoubleSide}):new MeshStandardMaterial({color:outfit.gear,roughness:.94,side:DoubleSide});
    dressed.add(new Mesh(geometry,material));
  };
  if (id!=='urban') {
    for (const side of [-1,1]) {
      const patch = new Mesh(new RoundedBoxGeometry(.065,.045,.012,2,.005),trim);patch.position.set(side*.13,1.37,.145);dressed.add(patch);
    }
  }
  if (['shadow','cyber','commander'].includes(id)) {
    facePanel(.235,.075,1.685,true);
  }
  if (['neon','midnight'].includes(id)) {
    for (const side of [-1,1]) {
      const tube=new Mesh(new CylinderGeometry(.026,.03,.1,16),armor);tube.rotation.x=Math.PI/2;tube.position.set(side*.038,1.766,.145);dressed.add(tube);
      const lens=new Mesh(new CylinderGeometry(.022,.022,.006,16),trim);lens.rotation.x=Math.PI/2;lens.position.set(side*.038,1.766,.197);dressed.add(lens);
    }
  }
  if (['commander','cyber','shadow'].includes(id)) {
    for (const side of [-1,1]) {
      const plate=new Mesh(new RoundedBoxGeometry(.105,.035,.125,3,.016),armor);plate.position.set(side*.225,1.435,0);plate.rotation.z=side*-.2;dressed.add(plate);
      if(id==='commander'){const mark=new Mesh(new RoundedBoxGeometry(.065,.008,.105,2,.003),trim);mark.position.set(side*.225,1.455,.005);dressed.add(mark);}
    }
  }
  if (['neon','crimson','shadow'].includes(id)) {
    facePanel(.195,.1,1.585,false);
  }
  dressed.userData.rivalsOutfit = { id, source: outfit.source, details: outfit.label };
  return dressed;
}
