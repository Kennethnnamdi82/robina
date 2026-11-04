import { Group, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import type { Actor } from '../../rugfire/actors';
import type { HumanoidAnimator, HumanoidFrame } from './HumanoidAnimator';
import { ArmIK, setWorldRotation } from './ArmIK';
import { traceSolids } from './physics3d';
import type { Solid3D } from './world3d';

export type GunClass = 'rifle' | 'smg' | 'pistol';
export interface WeaponMetadata { id: GunClass | 'knife'; length: number; forward: '-Z'; recoil: number; sockets: { grip: number[]; muzzle: number[]; support: number[] | null; eject: number[]; sight: number[] } }
export function weaponMetadata(model: Object3D): WeaponMetadata {
  let metadata: WeaponMetadata | undefined;
  model.traverse(node => { if (node.userData.rivalsWeapon) metadata = node.userData.rivalsWeapon as WeaponMetadata; });
  if (!metadata || metadata.forward !== '-Z' || !model.getObjectByName('weapon-muzzle')) throw new Error('Prepared weapon is missing its grip/muzzle metadata.');
  return metadata;
}
const up = new Vector3(0, 1, 0), barrel = new Vector3(0, 0, -1);

/** One physical weapon, anchored to the actual hand. Model and socket geometry
 * use metres and -Z forward. Cosmetic recoil does not change the aim target. */
export class WeaponRig {
  readonly metadata: WeaponMetadata; readonly muzzle: Object3D; readonly support?: Object3D;
  kick = 0; supportEngaged = false; leftGripError = 0; rightGripError = 0; alignment = 1;
  private right?: ArmIK; private left?: ArmIK; private avatar?: HumanoidAnimator;
  private rightPalm?: Object3D; private leftPalm?: Object3D;
  private rotation = new Quaternion(); private handRotation = new Quaternion(); private scratch = new Quaternion();
  private rightOffset = new Quaternion(); private leftOffset = new Quaternion(); private look = new Matrix4();
  private anchor = new Vector3(); private desired = new Vector3(); private goal = new Vector3(); private pole = new Vector3();
  private point = new Vector3(); private direction = new Vector3(); private scale = new Vector3();
  private hand = new Vector3(); private leftTarget = new Vector3();
  constructor(readonly actor: Actor, readonly model: Object3D, avatar?: HumanoidAnimator) {
    this.metadata = weaponMetadata(model); this.muzzle = model.getObjectByName('weapon-muzzle')!; this.support = model.getObjectByName('weapon-support') ?? undefined;
    // Remove the old torso-mounted proxy and its uncalibrated models.
    actor.weapons.forEach(weapon => weapon.removeFromParent()); actor.weapons.clear(); actor.muzzle.visible = false; actor.muzzleLight.visible = false;
    actor.weapon.position.set(0, 0, 0); actor.weapon.quaternion.identity(); model.visible = true; actor.weapon.add(model);
    if (avatar) {
      this.avatar = avatar; this.rightPalm = avatar.sockets.rightHand; this.leftPalm = avatar.sockets.leftHand;
      const body = actor.body!;
      this.right = new ArmIK(body.getObjectByName('upperarm_r')!, body.getObjectByName('lowerarm_r')!, this.rightPalm.parent!);
      this.left = new ArmIK(body.getObjectByName('upperarm_l')!, body.getObjectByName('lowerarm_l')!, this.leftPalm.parent!);
      this.rightOffset.copy(this.rightPalm.quaternion).invert(); this.leftOffset.copy(this.leftPalm.quaternion).invert();
    }
  }
  fire() { this.kick = Math.min(.065, this.kick + this.metadata.recoil); }
  decay(dt: number) { this.kick *= Math.exp(-dt * 24); }
  pose(target: Vector3, frame?: HumanoidFrame) {
    const group = this.actor.weapon;
    group.rotation.x = this.kick * .4; group.rotation.z = this.kick * .1;
    this.supportEngaged = false;
    if (this.avatar && frame) {
      const temporary = this.metadata.id === 'knife' || Boolean(frame.action && frame.action !== 'idle') || ['dodge', 'hit', 'death'].includes(this.avatar.motion) || frame.reload > 0;
      if (!temporary) {
        this.actor.root.updateMatrixWorld(true);
        this.anchor.set(.10, 1.31, .18); this.actor.root.localToWorld(this.anchor);
        this.desired.copy(target); if (this.desired.distanceToSquared(this.anchor) < .09) this.desired.copy(this.anchor).add(new Vector3(Math.cos(frame.angle), 0, Math.sin(frame.angle)));
        this.look.lookAt(this.anchor, this.desired, up); this.rotation.setFromRotationMatrix(this.look);
        this.handRotation.copy(this.rotation).multiply(this.rightOffset);
        this.rightPalm!.parent!.getWorldScale(this.scale);
        this.goal.copy(this.rightPalm!.position).multiply(this.scale).applyQuaternion(this.handRotation); this.goal.subVectors(this.anchor, this.goal);
        this.pole.set(.5, 1.08, .02); this.actor.root.localToWorld(this.pole);
        this.right!.solve(this.goal, this.pole); setWorldRotation(this.rightPalm!.parent!, this.handRotation, this.scratch);
        this.actor.root.updateMatrixWorld(true);
        if (this.support && this.left && this.leftPalm) {
          this.support.getWorldPosition(this.leftTarget);
          this.handRotation.copy(this.rotation).multiply(this.leftOffset);
          this.leftPalm.parent!.getWorldScale(this.scale);
          this.goal.copy(this.leftPalm.position).multiply(this.scale).applyQuaternion(this.handRotation); this.goal.subVectors(this.leftTarget, this.goal);
          this.pole.set(-.48, 1.08, .04); this.actor.root.localToWorld(this.pole);
          this.left.solve(this.goal, this.pole); setWorldRotation(this.leftPalm.parent!, this.handRotation, this.scratch);
          this.leftPalm.getWorldPosition(this.point); this.leftGripError = this.point.distanceTo(this.leftTarget); this.supportEngaged = true;
        }
      }
      this.rightPalm!.getWorldPosition(this.hand); this.model.getWorldPosition(this.point); this.rightGripError = this.point.distanceTo(this.hand);
    } else {
      // Rigid security rigs have designated wrist sockets rather than skins.
      group.getWorldPosition(this.anchor); this.look.lookAt(this.anchor, target, up); this.rotation.setFromRotationMatrix(this.look);
      setWorldRotation(group, this.rotation, this.scratch);
    }
    this.actor.root.updateMatrixWorld(true);
    this.muzzle.getWorldPosition(this.point); this.direction.subVectors(target, this.point).normalize();
    this.model.getWorldQuaternion(this.scratch); this.hand.copy(barrel).applyQuaternion(this.scratch);
    this.alignment = this.hand.dot(this.direction);
    this.actor.muzzle.visible = false; this.actor.muzzleLight.visible = false;
  }
  muzzleWorld(target: Vector3) { this.actor.root.updateMatrixWorld(true); return this.muzzle.getWorldPosition(target); }
}

/** Stops barrel-through-wall shooting. This is the same solid set used by the
 * projectile sweep, not a camera-dependent damage shortcut. */
export function safeMuzzleOrigin(anchor: Vector3, muzzle: Vector3, solids: readonly Solid3D[], out: Vector3) {
  const delta = new Vector3().subVectors(muzzle, anchor), length = delta.length();
  if (length < 1e-6) { out.copy(anchor); return false; }
  delta.divideScalar(length); const clear = traceSolids(anchor, delta, solids, length, .045);
  out.copy(anchor).addScaledVector(delta, Math.max(0, clear - (clear < length ? .005 : 0)));
  return clear < length;
}

/** Overlay pass shares the existing renderer. No authored FPS arm rig exists in
 * these packs, so this is an aligned weapon view, not fake animated arms. */
export class FirstPersonWeapon {
  readonly root = new Group(); readonly metadata: WeaponMetadata; kick = 0;
  // The supplied weapon view has no authored arm rig. Report that honestly;
  // diagnostics must not invent hands or add replacement player artwork.
  readonly handsVisible = false;
  readonly handsAttachedToWeapon = false;
  readonly handMeshCount = 0;
  private look = new Matrix4(); private aimRotation = new Quaternion();
  constructor(readonly model: Object3D) {
    this.metadata = weaponMetadata(model);
    model.visible = true;
    model.traverse(node => { node.frustumCulled = false; });
    this.root.add(model);
  }
  fire() { this.kick = Math.min(.06, this.kick + this.metadata.recoil); }
  aimAt(target: Vector3) { this.look.lookAt(this.root.position,target,up); this.aimRotation.setFromRotationMatrix(this.look); this.root.quaternion.premultiply(this.aimRotation); this.root.visible = true; }
  update(dt: number, ads: boolean, reload: number, reloadDuration: number,action = 'idle',remaining = 0) {
    this.kick *= Math.exp(-dt * 22);
    const phase = reload > 0 ? Math.sin(Math.PI * (1 - reload / reloadDuration)) : 0;
    this.root.position.set(ads ? 0 : .19, (ads ? -this.metadata.sockets.sight[1] : -.23) - phase * .12, -.37 + this.kick);
    this.root.rotation.set(this.kick * .45 - phase * .35, phase * -.12, phase * -.25);
    if (action === 'melee') { const slash = Math.sin(Math.PI * Math.max(0,1 - remaining / .38)); this.root.position.x -= slash * .3; this.root.position.z -= slash * .25; this.root.rotation.set(-slash * .35,slash * .5,-slash * .9); }
    else if (action === 'throw') { const lower = Math.sin(Math.PI * Math.max(0,1 - remaining / .55)); this.root.position.y -= lower * .25; this.root.rotation.x -= lower * .35; }
    else if (action === 'switch') this.root.position.y -= Math.min(1,remaining / .22) * .3;
  }
  dispose() { this.root.remove(this.model); }
}
