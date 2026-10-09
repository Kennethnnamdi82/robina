import * as T from 'three';
import type { EnemyRole, WeaponId } from './gameData';
import type { MissionAssets } from './assets';

type Motion = 'Idle' | 'Walk' | 'Run' | 'Back' | 'Left' | 'Right' | 'Fire' | 'Reload' | 'Hit' | 'Evade' | 'Death';
export type Actor = {
  root: T.Group; torso: T.Group; weapon: T.Group; muzzle: T.Mesh; muzzleLight: T.PointLight;
  role: EnemyRole | 'player'; recoil: number; stride: number; mixer?: T.AnimationMixer;
  actions: Map<Motion, T.AnimationAction>; current?: Motion; body?: T.Object3D;
  weapons: Map<WeaponId, T.Object3D>; weaponId: WeaponId; mounted: boolean;
  move: Motion; previousRecoil: number; reloadTime: number;
};
export function createActor(role: Actor['role']): Actor {
  const root = new T.Group(), torso = new T.Group(), weapon = new T.Group();
  root.name = 'actor-' + role; root.add(torso); torso.add(weapon);
  root.scale.setScalar(role === 'boss' ? 1.48 : role === 'rugger' ? 1.15 : 1);
  const muzzle = new T.Mesh(new T.OctahedronGeometry(.075), new T.MeshBasicMaterial({ color: 0xffdeb0 }));
  muzzle.visible = false; weapon.add(muzzle);
  const muzzleLight = new T.PointLight(0xffbc6a, 0, 3); muzzleLight.visible = false; weapon.add(muzzleLight);
  return { root, torso, weapon, muzzle, muzzleLight, role, recoil: 0, stride: 0, actions: new Map(), weapons: new Map(), weaponId: 'rifle', mounted: false, move: 'Walk', previousRecoil: 0, reloadTime: 1.8 };
}

export function mountActor(actor: Actor, assets: MissionAssets) {
  const human = actor.role === 'player';
  const { root: body, clips } = assets.instance(actor.role);
  body.name = human ? 'animated-human-operator' : 'animated-' + actor.role;
  actor.body = body; actor.torso.add(body);
  if (human) body.rotation.y = Math.PI;
  actor.mixer = new T.AnimationMixer(body);
  const names: Record<Motion, string> = human
    ? { Idle: 'Idle', Walk: 'Walk', Run: 'Run', Back: 'Back', Left: 'Left', Right: 'Right', Fire: 'Fire', Reload: 'Reload', Hit: 'Hit', Evade: 'Evade', Death: '' }
    : { Idle: 'Combat_Aim', Walk: 'Walk_Forward', Run: 'Sprint_Forward', Back: 'Walk_Forward', Left: 'Walk_Forward', Right: 'Walk_Forward', Fire: 'Shoot_Recoil', Reload: 'Reload', Hit: 'Hit_React', Evade: 'Crouch_Aim', Death: 'Death_Fall' };
  for (const [motion, name] of Object.entries(names)) {
    let clip = clips.find(c => c.name === name); if (!clip) continue;
    if (human && ['Walk', 'Run', 'Back', 'Left', 'Right'].includes(motion)) {
      const upper = clips.find(c => c.name === 'Idle')!;
      const lowerTrack = (name: string) => /Hips|UpLeg|Leg\.|Foot|Toe/.test(name);
      const tracks = clip.tracks.filter(t => lowerTrack(t.name));
      for (const track of upper.tracks.filter(t => !lowerTrack(t.name))) tracks.push(new T.QuaternionKeyframeTrack(track.name, [0, clip.duration], [...track.values.slice(0, 4), ...track.values.slice(0, 4)]));
      clip = new T.AnimationClip(motion, clip.duration, tracks);
    }
    const action = actor.mixer.clipAction(clip), once = ['Fire', 'Reload', 'Hit', 'Evade', 'Death'].includes(motion);
    action.setLoop(once ? T.LoopOnce : T.LoopRepeat, once ? 1 : Infinity); action.clampWhenFinished = once;
    actor.actions.set(motion as Motion, action);
  }
  transition(actor, 'Idle'); actor.mixer.update(.2); actor.root.updateMatrixWorld(true);
  const hand = human ? body.getObjectByName('RightHand') : undefined;
  if (hand) {
    hand.add(actor.weapon); actor.weapon.position.set(0, .075, .015);
    actor.weapon.quaternion.copy(hand.getWorldQuaternion(new T.Quaternion()).invert().multiply(actor.root.getWorldQuaternion(new T.Quaternion())));
  } else actor.weapon.position.set(.28, 1.2, -.42);
  for (const id of ['rifle', 'smg', 'pistol'] as const) {
    const { root } = assets.instance(id), pivot = new T.Group(); pivot.name = id + '-equipped'; pivot.add(root);
    if (id === 'rifle') {
      const bounds = new T.Box3().setFromObject(root), size = bounds.getSize(new T.Vector3());
      if (size.x > size.z) root.rotation.y = Math.PI / 2;
      root.updateMatrixWorld(true); bounds.setFromObject(root); bounds.getSize(size);
      root.scale.multiplyScalar(.9 / Math.max(size.x, size.y, size.z)); root.updateMatrixWorld(true);
      bounds.setFromObject(root); const center = bounds.getCenter(new T.Vector3()); root.position.sub(center); root.position.z -= .22;
    }
    actor.weapon.add(pivot); actor.weapons.set(id, pivot);
  }
  actor.mounted = true; equipActor(actor, actor.weaponId);
}
export function equipActor(actor: Actor, id: WeaponId) {
  actor.weaponId = id; actor.weapons.forEach((model, key) => { model.visible = key === id; });
  actor.muzzle.position.set(0, .035, id === 'pistol' ? -.28 : id === 'smg' ? -.48 : -.68); actor.muzzleLight.position.copy(actor.muzzle.position);
}
function transition(actor: Actor, motion: Motion, restart = false) {
  const next = actor.actions.get(motion); if (!next || (actor.current === motion && !restart)) return;
  const previous = actor.current && actor.actions.get(actor.current); if (previous && previous !== next) previous.fadeOut(.14);
  next.reset().setEffectiveWeight(1).fadeIn(.14).play(); actor.current = motion;
}
export function animateActor(actor: Actor, dt: number, speed: number, time: number, reload: number, dodge: number, hit: number, dead: boolean) {
  if (!actor.mounted) return;
  const firing = actor.recoil > actor.previousRecoil + .15;
  let motion: Motion = dead ? 'Death' : reload > 0 ? 'Reload' : dodge > 0 ? 'Evade' : hit > .1 ? 'Hit' : firing ? 'Fire' : speed > 5 ? 'Run' : speed > .35 ? actor.move : 'Idle';
  const playing = actor.current && actor.actions.get(actor.current);
  if (!dead && !reload && !dodge && !hit && !firing && actor.current === 'Fire' && playing?.isRunning()) motion = 'Fire';
  transition(actor, motion, firing && motion === 'Fire');
  if (motion === 'Reload') actor.actions.get('Reload')?.setEffectiveTimeScale((actor.actions.get('Reload')?.getClip().duration || 1) / actor.reloadTime);
  else if (motion === 'Run') actor.actions.get('Run')?.setEffectiveTimeScale(1.7);
  actor.mixer?.update(dt);
  actor.recoil = Math.max(0, actor.recoil - dt * 9); actor.previousRecoil = actor.recoil;
  actor.muzzle.visible = actor.recoil > .6; actor.muzzle.rotation.z += dt * 17;
  actor.torso.rotation.x = dodge > 0 ? -.25 : 0;
  if (dead && !actor.actions.has('Death')) actor.root.rotation.z = T.MathUtils.damp(actor.root.rotation.z, 1.48, 6, dt);
}
export function disposeActor(actor: Actor) { actor.mixer?.stopAllAction(); if (actor.body) actor.mixer?.uncacheRoot(actor.body); }
