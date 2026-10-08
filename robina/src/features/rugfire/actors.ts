import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnemyRole, WeaponId } from './gameData';
const geometry = new Map<string, T.BufferGeometry>(), materials = new Map<number, T.MeshStandardMaterial>();
function material(color: number) {
  if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness: .68, metalness: .18 }));
  return materials.get(color)!;
}
function box(parent: T.Object3D, size: number[], position: number[], color: number) {
  const key = size.join('/');
  if (!geometry.has(key)) geometry.set(key, new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(...size) * .18));
  const mesh = new T.Mesh(geometry.get(key), material(color)); mesh.position.set(...position as [number, number, number]);
  mesh.castShadow = true; parent.add(mesh); return mesh;
}
export type Actor = { root: T.Group; torso: T.Group; legs: T.Group[]; arms: T.Group[]; weapon: T.Group; muzzle: T.Mesh; muzzleLight: T.PointLight; recoil: number; stride: number };
export function createActor(role: EnemyRole | 'player'): Actor {
  const root = new T.Group(), torso = new T.Group(); root.add(torso);
  const heavy = role === 'rugger' || role === 'boss', scale = role === 'boss' ? 1.48 : heavy ? 1.15 : 1;
  root.scale.setScalar(scale);
  const cloth = role === 'player' ? 0x424b4a : role === 'kol' ? 0x78624b : role === 'whale' ? 0x414653 : 0x433d3b;
  const armor = role === 'player' ? 0x1e282a : heavy ? 0x27292b : 0x20252a;
  const accent = role === 'player' ? 0xbaac83 : role === 'kol' ? 0xb98956 : role === 'whale' ? 0x8794a1 : 0xa6493c;
  box(torso, [.57, .58, .3], [0, 1.17, 0], cloth);
  box(torso, [heavy ? .68 : .51, .44, .37], [0, 1.18, -.025], armor);
  box(torso, [.5, .12, .31], [0, .88, 0], armor);
  for (let i = -1; i <= 1; i++) box(torso, [.12, .2, .09], [i * .15, 1.13, -.24], 0x4f5650);
  box(torso, [.34, .43, .16], [0, 1.16, .24], armor);
  box(torso, [.2, .06, .025], [0, 1.35, .33], accent);
  box(torso, [.29, .3, .27], [0, 1.65, -.025], 0x987a66);
  box(torso, [.33, .17, .31], [0, 1.77, -.015], armor);
  box(torso, [.3, .1, .06], [0, 1.66, -.18], role === 'kol' ? 0x9b8764 : 0x141d21);
  box(torso, [.26, .11, .07], [0, 1.55, -.17], cloth);
  box(torso, [.035, .28, .035], [.23, 1.78, .14], 0x1d2324);
  if (role === 'kol') { box(torso, [.1, .17, .04], [0, 1.39, -.24], 0xc6aa67); box(torso, [.12, .22, .08], [.36, 1.4, 0], 0x161c20); }
  if (heavy) {
    box(torso, [.85, .14, .42], [0, 1.47, 0], armor);
    for (const x of [-.43, .43]) box(torso, [.22, .28, .37], [x, 1.37, 0], accent);
  }
  if (role === 'whale') box(torso, [.62, .64, .14], [0, 1.13, .23], 0x515664);
  if (role === 'boss') { box(torso, [.23, .52, .2], [-.4, 1.75, .2], armor); box(torso, [.23, .52, .2], [.4, 1.75, .2], armor); }
  const legs: T.Group[] = [], arms: T.Group[] = [];
  for (const sign of [-1, 1]) {
    const leg = new T.Group(); leg.position.set(sign * .17, .86, 0); root.add(leg);
    box(leg, [.23, .39, .26], [0, -.2, 0], cloth);
    box(leg, [.21, .35, .22], [0, -.57, 0], cloth);
    box(leg, [.22, .13, .06], [0, -.45, -.14], armor);
    box(leg, [.25, .14, .4], [0, -.79, -.07], 0x171d20); legs.push(leg);
    const arm = new T.Group(); arm.position.set(sign * .35, 1.42, 0); torso.add(arm);
    box(arm, [.19, .33, .2], [0, -.14, -.08], cloth);
    box(arm, [.16, .18, .37], [sign * -.035, -.31, -.25], cloth);
    box(arm, [.15, .14, .14], [sign * -.04, -.32, -.44], 0x232a2a); arms.push(arm);
  }
  const weapon = new T.Group(); weapon.position.set(.26, 1.09, -.45); torso.add(weapon);
  box(weapon, [.13, .16, .53], [0, 0, -.13], 0x22282c);
  box(weapon, [.08, .08, .45], [0, .015, -.53], 0x4c5355);
  box(weapon, [.11, .22, .15], [0, -.17, -.06], 0x11191c);
  box(weapon, [.14, .06, .1], [0, .13, -.19], 0x6d756f);
  const muzzle = new T.Mesh(new T.OctahedronGeometry(.12), new T.MeshBasicMaterial({ color: 0xffd292 })); muzzle.position.set(0, .01, -.8); muzzle.visible = false; weapon.add(muzzle);
  const muzzleLight = new T.PointLight(0xffbc6a, 0, 5); muzzleLight.position.copy(muzzle.position); muzzleLight.visible = false; weapon.add(muzzleLight);
  for (const joint of [torso, ...legs, ...arms, weapon]) mergeStaticParts(joint, muzzle);
  return { root, torso, legs, arms, weapon, muzzle, muzzleLight, recoil: 0, stride: 0 };
}
export function equipActor(actor: Actor, weapon: WeaponId) {
  actor.weapon.scale.set(1, 1, weapon === 'pistol' ? .46 : weapon === 'smg' ? .78 : 1);
}
export function animateActor(actor: Actor, dt: number, speed: number, time: number, reload: number, dodge: number, hit: number, dead: boolean) {
  actor.recoil = Math.max(0, actor.recoil - dt * 7);
  actor.stride += dt * speed * 2.5;
  const walk = Math.min(1, speed / 3);
  actor.legs[0].rotation.x = Math.sin(actor.stride) * .65 * walk;
  actor.legs[1].rotation.x = -Math.sin(actor.stride) * .65 * walk;
  actor.torso.position.y = Math.abs(Math.sin(actor.stride)) * .035 * walk + Math.sin(time * 1.8) * .006;
  actor.weapon.position.z = -.45 + actor.recoil * .13;
  actor.weapon.rotation.x = -actor.recoil * .13 + (reload > 0 ? Math.sin(reload * Math.PI) * .65 : 0);
  actor.arms[0].rotation.x = reload > 0 ? Math.sin(reload * Math.PI) * 1.2 : 0;
  actor.torso.rotation.z = dodge > 0 ? Math.sin(dodge * Math.PI) * -.7 : hit > 0 ? Math.sin(hit * 28) * .13 : 0;
  actor.torso.rotation.x = dodge > 0 ? -.65 : hit > 0 ? -.13 : 0;
  actor.muzzle.visible = actor.recoil > .65; actor.muzzle.rotation.z += dt * 17;
  actor.muzzleLight.intensity = actor.muzzle.visible ? 5 : 0;
  if (dead) { actor.root.rotation.z = T.MathUtils.damp(actor.root.rotation.z, 1.48, 6, dt); actor.torso.rotation.x = -.15; }
}
export function disposeActorAssets() { geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); geometry.clear(); materials.clear(); }



function mergeStaticParts(joint: T.Group, dynamic: T.Mesh) {
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  for (const child of [...joint.children]) {
    if (!(child instanceof T.Mesh) || child === dynamic || Array.isArray(child.material)) continue;
    child.updateMatrix(); const copy = child.geometry.clone().applyMatrix4(child.matrix);
    if (!batches.has(child.material)) batches.set(child.material, []);
    batches.get(child.material)!.push(copy); joint.remove(child);
  }
  for (const [material, geometries] of batches) {
    const mesh = new T.Mesh(mergeGeometries(geometries)!, material); mesh.castShadow = true;
    geometries.forEach(geometry => geometry.dispose()); joint.add(mesh);
  }
}
