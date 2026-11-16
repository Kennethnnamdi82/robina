import { Group, MathUtils, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import type { Actor } from '../../rugfire/actors';
import type { HumanoidAnimator, HumanoidFrame } from './HumanoidAnimator';
import { ArmIK, setWorldRotation } from './ArmIK';
import {SOLDIER_GRIP} from './WeaponGeometry';
export {safeMuzzleOrigin} from './WeaponGeometry';
import { FingerGrip, OperativeHands } from './OperativeHands';
import { ReflexOptic } from './ReflexOptic';

export type GunClass = 'rifle' | 'smg' | 'pistol';
export interface WeaponMetadata { id: GunClass | 'knife'; length: number; forward: '-Z'; recoil: number; sockets: { grip: number[]; muzzle: number[]; support: number[] | null; eject: number[]; sight: number[] } }
export function weaponMetadata(model: Object3D): WeaponMetadata {
  let metadata: WeaponMetadata | undefined;
  model.traverse(node => { if (node.userData.rivalsWeapon) metadata = node.userData.rivalsWeapon as WeaponMetadata; });
  if (!metadata || metadata.forward !== '-Z' || !model.getObjectByName('weapon-muzzle')) throw new Error('Prepared weapon is missing its grip/muzzle metadata.');
  return metadata;
}
const up = new Vector3(0, 1, 0), barrel = new Vector3(0, 0, -1);
const fingerRigs = new WeakMap<Object3D,FingerGrip>();

/** One physical weapon, anchored to the actual hand. Model and socket geometry
 * use metres and -Z forward. Cosmetic recoil does not change the aim target. */
export class WeaponRig {
  readonly metadata: WeaponMetadata; readonly muzzle: Object3D; readonly support?: Object3D;
  kick = 0; supportEngaged = false; leftGripError = 0; rightGripError = 0; alignment = 1;
  private right?: ArmIK; private left?: ArmIK; private avatar?: HumanoidAnimator;
  private rightPalm?: Object3D; private leftPalm?: Object3D;
  private rotation = new Quaternion(); private handRotation = new Quaternion(); private scratch = new Quaternion();
  private supportRoll = new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2);
  private rightOffset = new Quaternion(); private leftOffset = new Quaternion(); private look = new Matrix4();
  private anchor = new Vector3(); private desired = new Vector3(); private goal = new Vector3(); private pole = new Vector3();
  private point = new Vector3(); private direction = new Vector3(); private scale = new Vector3();
  private hand = new Vector3(); private leftTarget = new Vector3();
  private fingers?:FingerGrip;
  private optic?:ReflexOptic;
  private chestGrip=new Vector3();private reloadTarget=new Vector3();
  private carriedGrip=new Vector3();private reachOffset=new Vector3();
  private localRotation=new Quaternion();private desiredLocal=new Quaternion();private rootRotation=new Quaternion();
  private poseInitialized=false;
  constructor(readonly actor: Actor, readonly model: Object3D, avatar?: HumanoidAnimator) {
    this.metadata = weaponMetadata(model); this.muzzle = model.getObjectByName('weapon-muzzle')!; this.support = model.getObjectByName('weapon-support') ?? undefined;
    if(this.metadata.id==='rifle')this.optic=new ReflexOptic(model,this.metadata);
    // Remove the old torso-mounted proxy and its uncalibrated models.
    actor.weapons.forEach(weapon => weapon.removeFromParent()); actor.weapons.clear(); actor.muzzle.visible = false; actor.muzzleLight.visible = false;
    actor.weapon.position.set(0, 0, 0); actor.weapon.quaternion.identity(); model.visible = true; actor.weapon.add(model);
    if (avatar) {
      this.fingers=fingerRigs.get(actor.body!)??new FingerGrip(actor.body!);fingerRigs.set(actor.body!,this.fingers);
      this.avatar = avatar; this.rightPalm = avatar.sockets.rightHand; this.leftPalm = avatar.sockets.leftHand;
      const body = actor.body!;
      this.right = new ArmIK(body.getObjectByName('upperarm_r')!, body.getObjectByName('lowerarm_r')!, this.rightPalm.parent!);
      this.left = new ArmIK(body.getObjectByName('upperarm_l')!, body.getObjectByName('lowerarm_l')!, this.leftPalm.parent!);
      this.rightOffset.copy(this.rightPalm.quaternion).invert(); this.leftOffset.copy(this.leftPalm.quaternion).invert();
      actor.root.updateMatrixWorld(true);
      actor.root.localToWorld(this.chestGrip.set(...SOLDIER_GRIP));
      avatar.sockets.chest.worldToLocal(this.chestGrip);
    }
  }
  fire() { this.kick = Math.min(.065, this.kick + this.metadata.recoil); }
  decay(dt: number) { this.kick *= Math.exp(-dt * 24); }
  pose(target: Vector3, frame?: HumanoidFrame,dt=1/60) {
    const group = this.actor.weapon;
    const twoHanded=this.metadata.id==='rifle'||this.metadata.id==='smg';
    const reload=twoHanded&&frame?.reload?Math.sin(Math.PI*MathUtils.clamp(1-frame.reload/(frame.reloadDuration??1.25),0,1)):0;
    group.rotation.x = this.kick * .4+reload*.18; group.rotation.z = this.kick * .1-reload*.2;
    this.supportEngaged = false;
    if (this.avatar && frame) {
      const temporary = this.metadata.id === 'knife' || Boolean(frame.action && frame.action !== 'idle') || ['dodge', 'hit', 'death'].includes(this.avatar.motion) || !twoHanded&&frame.reload > 0;
      if (!temporary) {
        this.actor.root.updateMatrixWorld(true);
        // The supplied +Z-forward skeleton has its right shoulder on -X.
        // Mirroring this anchor pulled the firing arm across the entire chest.
        // Follow the animated chest, not a fixed point in the physics root.
        // Both hands and the gun now share the body's continuous stride/bob.
        this.anchor.copy(this.chestGrip);this.avatar.sockets.chest.localToWorld(this.anchor);
        this.actor.root.worldToLocal(this.anchor);
        if(!this.poseInitialized)this.carriedGrip.copy(this.anchor);
        else this.carriedGrip.lerp(this.anchor,1-Math.exp(-24*Math.max(0,Math.min(.1,dt))));
        this.actor.root.localToWorld(this.anchor.copy(this.carriedGrip));
        // Looking around an idle operative must not fold their rifle backwards
        // through their chest. Orbit is observation, not a weapon command.
        if (!frame.aiming && this.kick < .0005) {
          this.desired.set(0,-.08,1).transformDirection(this.actor.root.matrixWorld).multiplyScalar(12).add(this.anchor);
        } else this.desired.copy(target);
        if (this.desired.distanceToSquared(this.anchor) < .09) this.desired.copy(this.anchor).add(new Vector3(Math.cos(frame.angle), 0, Math.sin(frame.angle)));
        this.look.lookAt(this.anchor, this.desired, up); this.rotation.setFromRotationMatrix(this.look);
        // Smooth in character space: turning the body must not leave a gun
        // lagging behind in world space or snap between carry and aimed poses.
        this.actor.root.getWorldQuaternion(this.rootRotation);
        this.desiredLocal.copy(this.rootRotation).invert().multiply(this.rotation);
        if(!this.poseInitialized){this.localRotation.copy(this.desiredLocal);this.poseInitialized=true;}
        else this.localRotation.slerp(this.desiredLocal,1-Math.exp(-24*Math.max(0,Math.min(.1,dt))));
        this.rotation.copy(this.rootRotation).multiply(this.localRotation);
        if(this.support&&this.left&&this.leftPalm){
          this.leftTarget.fromArray(this.metadata.sockets.support!).applyQuaternion(group.quaternion).applyQuaternion(this.rotation).add(this.anchor);
          this.handRotation.copy(this.rotation).multiply(this.supportRoll).multiply(this.leftOffset);
          this.leftPalm.parent!.getWorldScale(this.scale);
          this.goal.copy(this.leftPalm.position).multiply(this.scale).applyQuaternion(this.handRotation);this.goal.subVectors(this.leftTarget,this.goal);
          this.left.reachOffset(this.goal,this.reachOffset);this.anchor.addScaledVector(this.reachOffset,1-reload);
        }
        this.handRotation.copy(this.rotation).multiply(this.rightOffset);
        this.rightPalm!.parent!.getWorldScale(this.scale);
        this.goal.copy(this.rightPalm!.position).multiply(this.scale).applyQuaternion(this.handRotation); this.goal.subVectors(this.anchor, this.goal);
        this.pole.set(-.42, 1.03, .05); this.actor.root.localToWorld(this.pole);
        this.right!.solve(this.goal, this.pole); setWorldRotation(this.rightPalm!.parent!, this.handRotation, this.scratch);
        this.actor.root.updateMatrixWorld(true);
        if (this.support && this.left && this.leftPalm) {
          this.support.getWorldPosition(this.leftTarget);
          if(reload){
            // The firing hand retains the actual grip while the support hand
            // visits the magazine and returns, instead of a pistol reload.
            this.reloadTarget.set(0,-.12,.1);this.model.localToWorld(this.reloadTarget);
            this.leftTarget.lerp(this.reloadTarget,reload);
          }
          this.handRotation.copy(this.rotation).multiply(this.supportRoll).multiply(this.leftOffset);
          this.leftPalm.parent!.getWorldScale(this.scale);
          this.goal.copy(this.leftPalm.position).multiply(this.scale).applyQuaternion(this.handRotation); this.goal.subVectors(this.leftTarget, this.goal);
          this.pole.set(.36, 1.02, .16); this.actor.root.localToWorld(this.pole);
          this.left.solve(this.goal, this.pole); setWorldRotation(this.leftPalm.parent!, this.handRotation, this.scratch);
          this.leftPalm.getWorldPosition(this.point); this.leftGripError = this.point.distanceTo(this.leftTarget); this.supportEngaged = reload<.01;
        }
      }
      this.rightPalm!.getWorldPosition(this.hand); this.model.getWorldPosition(this.point); this.rightGripError = this.point.distanceTo(this.hand);
      if(temporary)this.poseInitialized=false;
    } else {
      // Rigid security rigs have designated wrist sockets rather than skins.
      group.getWorldPosition(this.anchor); this.look.lookAt(this.anchor, target, up); this.rotation.setFromRotationMatrix(this.look);
      setWorldRotation(group, this.rotation, this.scratch);
    }
    this.actor.root.updateMatrixWorld(true);
    this.fingers?.pose(this.kick>.004,Boolean(frame?.reload));
    this.muzzle.getWorldPosition(this.point); this.direction.subVectors(target, this.point).normalize();
    this.model.getWorldQuaternion(this.scratch); this.hand.copy(barrel).applyQuaternion(this.scratch);
    this.alignment = this.hand.dot(this.direction);
    this.actor.muzzle.visible = false; this.actor.muzzleLight.visible = false;
  }
  muzzleWorld(target: Vector3) { this.actor.root.updateMatrixWorld(true); return this.muzzle.getWorldPosition(target); }
  dispose(){this.optic?.dispose();}
}

/** Camera-space weapon and articulated gloves share the existing renderer. */
export class FirstPersonWeapon {
  readonly root = new Group(); readonly metadata: WeaponMetadata; kick = 0;
  // Procedural articulated tactical gloves, anchored to calibrated weapon grips.
  readonly handsVisible = true;
  readonly handsAttachedToWeapon = true;
  readonly hands:OperativeHands;
  get handMeshCount(){return this.hands.meshCount;}
  private look = new Matrix4(); private aimRotation = new Quaternion();
  private optic?:ReflexOptic; private adsBlend=0; private elapsed=0; private identity=new Quaternion();
  constructor(readonly model: Object3D) {
    this.metadata = weaponMetadata(model);
    if(this.metadata.id==='rifle'){
      this.optic=new ReflexOptic(model,this.metadata);
      this.metadata={...this.metadata,sockets:{...this.metadata.sockets,sight:this.optic.sight}};
    }
    model.visible = true;
    model.traverse(node => { node.frustumCulled = false; });
    this.root.add(model);
    this.hands=new OperativeHands(this.metadata);this.root.add(this.hands.root);
  }
  fire() { this.kick = Math.min(.06, this.kick + this.metadata.recoil);this.hands.fire(); }
  aimAt(target: Vector3) {
    this.look.lookAt(this.root.position,target,up); this.aimRotation.setFromRotationMatrix(this.look);
    // Convergence is useful at hip fire, but rotating an aligned ADS weapon a
    // second time moved its sight off the actual camera ray at close range.
    this.aimRotation.slerp(this.identity,this.adsBlend);this.root.quaternion.premultiply(this.aimRotation);this.root.visible=true;
  }
  update(dt: number, ads: boolean, reload: number, reloadDuration: number,action = 'idle',remaining = 0) {
    this.kick *= Math.exp(-dt * 22);
    this.adsBlend+=(Number(ads)-this.adsBlend)*(1-Math.exp(-Math.max(0,dt)*16));this.elapsed+=dt;
    this.hands.update(dt,reload,reloadDuration);
    const phase = reload > 0 ? Math.sin(Math.PI * (1 - reload / reloadDuration)) : 0;
    const blend=this.adsBlend,sight=this.metadata.sockets.sight,settle=1-blend;
    this.root.position.set(.19*settle-sight[0]*blend,-.23*settle-sight[1]*blend-phase*.12,
      -.37*settle+(-.19-sight[2])*blend+this.kick*(1-blend*.7));
    this.root.position.x+=Math.sin(this.elapsed*1.4)*.0012*settle;
    this.root.rotation.set(this.kick*.45*settle-phase*.35,phase*-.12,phase*-.25);
    if (action === 'melee') { const slash = Math.sin(Math.PI * Math.max(0,1 - remaining / .38)); this.root.position.x -= slash * .3; this.root.position.z -= slash * .25; this.root.rotation.set(-slash * .35,slash * .5,-slash * .9); }
    else if (action === 'throw') { const lower = Math.sin(Math.PI * Math.max(0,1 - remaining / .55)); this.root.position.y -= lower * .25; this.root.rotation.x -= lower * .35; }
    else if (action === 'switch') this.root.position.y -= Math.min(1,remaining / .22) * .3;
  }
  get sightPoint(){return this.metadata.sockets.sight;}
  get aimingBlend(){return this.adsBlend;}
  dispose() { this.optic?.dispose();this.hands.dispose();this.hands.root.removeFromParent();this.root.remove(this.model); }
}
