import { AnimationMixer, Box3, Color, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3, type AnimationClip, type Object3D } from 'three';
import {buildOutfitArmor,uniformFabric} from './OutfitArmor';

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
  const fabric=id==='urban'?undefined:uniformFabric(id);
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
      // Re-tailored albedo retains the source's normal/detail maps and anatomy.
      // A dark color multiplied into the same camo atlas is not a premium suit.
      if(/body/.test(name)&&fabric)m.map=fabric;
      if(/equipment|helmet/.test(name)&&['midnight','commander','cyber'].includes(id))m.map=null;
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
  buildOutfitArmor(dressed,id);
  dressed.userData.rivalsOutfit = { id, source: outfit.source, details: outfit.label };
  return dressed;
}
