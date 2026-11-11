import { AnimationClip, AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, MathUtils, Quaternion, Vector3, type AnimationAction, type Object3D } from 'three';
import type { Actor } from '../../rugfire/actors';
import type { POV } from './CameraRig';
import { ArmIK } from './ArmIK';

export interface HumanoidFrame {
  vx: number; vz: number; vertical: number; grounded: boolean; sprinting: boolean;
  aiming: boolean; angle: number; pov: POV; dodgeRemaining: number; dodgeSerial: number;
  health: number; hitSerial: number; shots: number; reload: number; reloadDuration?: number;
  equipment?: string; action?: string; actionRemaining?: number;
  independentAim?: boolean;
}
export type HumanoidMotion = 'idle' | 'walk' | 'backward' | 'strafe-left' | 'strafe-right' | 'jog' | 'run' | 'sprint' | 'takeoff' | 'fall' | 'land' | 'dodge' | 'hit' | 'death';
// Locomotion owns the torso/head as well as the legs. Freezing every spine
// track in an aiming pose made a running operative look like a rigid mannequin.
// Arms stay on the separate ready/reload layer and the gun still uses hand IK.
const lower = /^(root|pelvis|spine_0[123]|neck_01|Head|thigh_[lr]|calf_[lr]|foot_[lr]|ball_(?:leaf_)?[lr])\./;
const gaitClip: Partial<Record<HumanoidMotion, string>> = { idle: 'Idle_Loop', walk: 'Walk_Loop', backward: 'Walk_Loop', 'strafe-left': 'Walk_Loop', 'strafe-right': 'Walk_Loop', jog: 'Jog_Fwd_Loop', run: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop' };
const special: Partial<Record<HumanoidMotion, string>> = { takeoff: 'Jump_Start', fall: 'Jump_Loop', land: 'Jump_Land', dodge: 'Crouch_Fwd_Loop', hit: 'Hit_Chest', death: 'Death01' };
const direction = new Vector3(), up = new Vector3(0, 1, 0), correction = new Quaternion(), inverse = new Quaternion();

/** Per-instance actions/bones; shared immutable geometry, textures and source clips.
 * Physics owns translation. Lower/upper tracks are disjoint during locomotion,
 * allowing aimed movement and shooting without restarting the stepping cycle. */
export class HumanoidAnimator {
  readonly mixer: AnimationMixer;
  readonly sockets: { rightHand: Group; leftHand: Group; chest: Object3D; rightShoulder: Object3D; leftShoulder: Object3D; head: Object3D };
  motion: HumanoidMotion = 'idle'; transition: 'steady' | 'starting' | 'stopping' | 'turning' = 'steady';
  readonly history: HumanoidMotion[] = ['idle'];
  speed = 0; yaw = 0; actionTime = 0; activeActions = 0;
  private actions = new Map<string, AnimationAction>(); private clips = new Map<string, AnimationClip>();
  private base?: AnimationAction; private upper?: AnimationAction;
  private fading: { action: AnimationAction; remaining: number }[] = [];
  private previousGrounded = true; private lastDodge = 0; private lastHit = 0; private lastShot = 0;
  private specialRemaining = 0; private shotRemaining = 0; private changeRemaining = 0; private wasMoving = false; private initialized = false; private disposed = false;
  private pelvis: Object3D; private chest: Object3D;
  private pelvisSample = new Quaternion(); private chestSample = new Quaternion(); private corrected = false;
  private weaponPose: { bone: Object3D; source: Quaternion }[] = [];
  private socialArms?:{left:ArmIK;right:ArmIK};private socialPoint=new Vector3();private socialPole=new Vector3();
  get clipName() { return this.base?.getClip().name.split(':')[1] ?? ''; }
  /** The layered pose that keeps the equipped item readable during locomotion. */
  get upperClipName() { return this.upper?.getClip().name.replace(/^upper-/, '').split(':').pop() ?? ''; }
  constructor(readonly actor: Actor, body: Object3D, clips: readonly AnimationClip[]) {
    for (const clip of clips) this.clips.set(clip.name, clip);
    for (const name of ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Roll', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Hit_Chest', 'Death01', 'Pistol_Aim_Neutral', 'Pistol_Idle_Loop', 'Pistol_Shoot', 'Pistol_Reload']) {
      if (!this.clips.has(name)) throw new Error('Universal humanoid is missing ' + name);
    }
    const bone = (name: string) => { const node = body.getObjectByName(name); if (!node) throw new Error('Incompatible humanoid rig: missing ' + name); return node; };
    this.pelvis = bone('pelvis'); this.chest = bone('spine_01');
    for (const name of ['upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l']) {
      const arm = body.getObjectByName(name); if (arm) this.weaponPose.push({ bone: arm, source: arm.quaternion.clone() });
    }
    const rightHand = new Group(), leftHand = new Group(); rightHand.name = 'rivals-right-hand-socket'; leftHand.name = 'rivals-left-hand-socket';
    bone('hand_r').add(rightHand); bone('hand_l').add(leftHand);
    // Hand +Y runs along the fingers. Equipment forward is -Z; convert locally,
    // rather than freezing a world-space orientation at attachment time.
    rightHand.position.set(0, .065, .015); rightHand.rotation.x = Math.PI / 2;
    leftHand.position.set(0, .065, .015); leftHand.rotation.x = Math.PI / 2;
    this.sockets = { rightHand, leftHand, chest: bone('spine_03'), rightShoulder: bone('clavicle_r'), leftShoulder: bone('clavicle_l'), head: bone('Head') };
    actor.body = body; actor.torso.add(body); actor.mounted = true;
    this.mixer = new AnimationMixer(body); actor.mixer = this.mixer;
    // Calibrate the local grip against the genuine authored aiming pose. Bone
    // axes describe the wrist, not necessarily the weapon barrel direction.
    const neutral = this.clips.get('Pistol_Aim_Neutral')!;
    const calibration = this.mixer.clipAction(neutral);
    calibration.setLoop(LoopOnce, 1); calibration.clampWhenFinished = true; calibration.play();
    this.mixer.update(neutral.duration); actor.root.updateMatrixWorld(true);
    const equipmentForward = actor.root.getWorldQuaternion(new Quaternion()).multiply(new Quaternion().setFromAxisAngle(up, Math.PI));
    rightHand.quaternion.copy(bone('hand_r').getWorldQuaternion(new Quaternion()).invert().multiply(equipmentForward));
    leftHand.quaternion.copy(bone('hand_l').getWorldQuaternion(new Quaternion()).invert().multiply(equipmentForward));
    this.mixer.stopAllAction(); this.mixer.uncacheClip(neutral); this.mixer.setTime(0);
    rightHand.add(actor.weapon);
    actor.weapon.position.set(0, 0, 0); actor.weapon.quaternion.identity();
    this.update(0, { vx: 0, vz: 0, vertical: 0, grounded: true, sprinting: false, aiming: false, angle: -Math.PI / 2, pov: 'tactical', dodgeRemaining: 0, dodgeSerial: 0, health: 100, hitSerial: 0, shots: 0, reload: 0 });
  }
  private action(key: string, clipName: string, layer: 'lower' | 'upper' | 'full', once = false) {
    let action = this.actions.get(key);
    if (!action) {
      const clip = this.clips.get(clipName)!;
      const tracks = layer === 'full' ? clip.tracks : clip.tracks.filter(track => lower.test(track.name) === (layer === 'lower'));
      action = this.mixer.clipAction(new AnimationClip(key, clip.duration, tracks));
      action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity); action.clampWhenFinished = once;
      this.actions.set(key, action);
    }
    return action;
  }
  private switchAction(previous: AnimationAction | undefined, next: AnimationAction, timeScale: number) {
    if (previous === next) { next.setEffectiveTimeScale(timeScale); return next; }
    const gait=/:(Walk_Loop|Jog_Fwd_Loop|Sprint_Loop)$/,phase=previous&&gait.test(previous.getClip().name)&&gait.test(next.getClip().name)?MathUtils.euclideanModulo(previous.time,previous.getClip().duration)/previous.getClip().duration:undefined;
    if (previous) { previous.fadeOut(.12); this.fading.push({ action: previous, remaining: .13 }); }
    this.fading = this.fading.filter(item => item.action !== next);
    next.stopFading().reset().setEffectiveWeight(1).setEffectiveTimeScale(timeScale);
    if (timeScale < 0) next.time = next.getClip().duration;
    if(phase!==undefined)next.time=phase*next.getClip().duration;
    next.fadeIn(previous ? .12 : 0).play();
    return next;
  }
  update(dt: number, frame: HumanoidFrame) {
    if (this.disposed || !Number.isFinite(dt) || dt < 0) return;
    // A clamped aiming clip may not rewrite unchanged channels. Restore its
    // source arms before evaluation so last frame's IK cannot accumulate.
    for (const { bone, source } of this.weaponPose) bone.quaternion.copy(source);
    this.speed = Math.hypot(frame.vx, frame.vz);
    this.specialRemaining = Math.max(0, this.specialRemaining - dt); this.shotRemaining = Math.max(0, this.shotRemaining - dt);
    const dodge = frame.dodgeSerial !== this.lastDodge, hit = frame.hitSerial !== this.lastHit, fired = frame.shots !== this.lastShot;
    this.lastDodge = frame.dodgeSerial; this.lastHit = frame.hitSerial; this.lastShot = frame.shots;
    if (fired) this.shotRemaining = .16;
    let motion: HumanoidMotion;
    if (frame.health <= 0) motion = 'death';
    else if (hit && this.speed < .08 && !frame.aiming && this.shotRemaining <= 0) { motion = 'hit'; this.specialRemaining = .22; }
    else if (this.motion === 'hit' && this.specialRemaining > 0 && !frame.aiming && this.shotRemaining <= 0 && this.speed < .08) motion = 'hit';
    else if (dodge) { motion = 'dodge'; this.specialRemaining = .28; }
    else if (this.motion === 'dodge' && this.specialRemaining > 0) motion = 'dodge';
    else if (!frame.grounded && this.previousGrounded) { motion = 'takeoff'; this.specialRemaining = .14; }
    else if (!frame.grounded) motion = this.motion === 'takeoff' && this.specialRemaining > 0 && frame.vertical > 0 ? 'takeoff' : 'fall';
    else if (!this.previousGrounded) { motion = 'land'; this.specialRemaining = .15; }
    else if (this.motion === 'land' && this.specialRemaining > 0) motion = 'land';
    else if (this.speed < .08) motion = 'idle';
    else if (frame.sprinting) motion = 'sprint';
    else if (this.speed > (this.motion === 'run' ? 4.55 : 4.95)) motion = 'run';
    else if (this.speed > (this.motion === 'jog' || this.motion === 'run' ? 2.55 : 2.95)) motion = 'jog';
    else motion = 'walk';
    // +Z is the supplied model's verified forward direction.
    let desired = Math.PI / 2 - frame.angle;
    if (frame.pov === 'side') {
      const horizontal = frame.aiming ? Math.cos(frame.angle) : frame.vx;
      desired = (Math.abs(horizontal) > .05 ? horizontal : Math.sin(this.yaw) || 1) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    if(frame.independentAim)desired=this.speed>.08?Math.atan2(frame.vx,frame.vz):this.initialized?this.yaw:desired;
    const turn = Math.atan2(Math.sin(desired - this.yaw), Math.cos(desired - this.yaw));
    if (!this.initialized) { this.yaw = desired; this.initialized = true; }
    else this.yaw += turn * (1 - Math.exp(-dt * 18));
    this.actor.root.rotation.y = this.yaw;
    const full = Boolean(special[motion]);
    let lowerTwist = 0, reverse = false;
    if (!full && this.speed > .08 && frame.aiming) {
      const relative = Math.atan2(Math.sin(Math.atan2(frame.vx, frame.vz) - this.yaw), Math.cos(Math.atan2(frame.vx, frame.vz) - this.yaw));
      reverse = Math.abs(relative) > Math.PI * .72;
      // No authored strafe/back clips are supplied. Reverse the genuine gait
      // for retreat and steer the legs, counter-rotating the chest for aim.
      if (reverse) motion = 'backward';
      else if (Math.abs(relative) > .6) motion = relative > 0 ? 'strafe-right' : 'strafe-left';
      lowerTwist = MathUtils.clamp(reverse ? relative - Math.sign(relative) * Math.PI : relative, -1, 1);
    }
    const moving = this.speed >= .08;
    this.changeRemaining = Math.max(0, this.changeRemaining - dt);
    if (moving !== this.wasMoving) { this.transition = moving ? 'starting' : 'stopping'; this.changeRemaining = .12; }
    else if (this.changeRemaining <= 0) this.transition = Math.abs(turn) > .3 ? 'turning' : 'steady';
    this.wasMoving = moving;
    if (motion !== this.motion) { this.history.push(motion); if (this.history.length > 16) this.history.shift(); }
    this.motion = motion; this.previousGrounded = frame.grounded;
    const evade = motion === 'dodge' ? Math.sin(Math.PI * Math.min(1,this.specialRemaining / .28)) : 0;
    const lateral = frame.vx * Math.cos(frame.angle + Math.PI / 2) + frame.vz * Math.sin(frame.angle + Math.PI / 2);
    const bank = !full && frame.grounded && moving ? MathUtils.clamp(-turn * .065,-.055,.055) : 0;
    this.actor.torso.rotation.z = MathUtils.damp(this.actor.torso.rotation.z,Math.sign(lateral) * evade * -.22 + bank,18,dt);
    const directional = motion === 'backward' || motion === 'strafe-left' || motion === 'strafe-right';
    const clipName = special[motion] || (directional ? frame.sprinting ? 'Sprint_Loop' : this.speed > 2.8 ? 'Jog_Fwd_Loop' : 'Walk_Loop' : gaitClip[motion]!);
    const once = full && motion !== 'fall';
    const duration = motion === 'dodge' ? .28 : motion === 'takeoff' ? .14 : motion === 'land' ? .15 : motion === 'hit' ? .22 : 0;
    const stride = clipName === 'Sprint_Loop' ? 4.3 : clipName === 'Jog_Fwd_Loop' ? 2.75 : 1.65;
    const rate = duration ? this.clips.get(clipName)!.duration / duration : full || !moving ? 1 : MathUtils.clamp(this.speed*this.clips.get(clipName)!.duration/stride, .2, 2.8) * (reverse ? -1 : 1);
    this.base = this.switchAction(this.base, this.action('base-' + motion + ':' + clipName, clipName, full ? 'full' : 'lower', once), rate);
    if (full) {
      if (this.upper) { this.upper.fadeOut(.08); this.fading.push({ action: this.upper, remaining: .09 }); this.upper = undefined; }
    } else {
      const actionClip: Record<string,string> = { melee: 'Sword_Attack',throw: 'Spell_Simple_Shoot',pickup: 'PickUp_Table',switch: 'Interact' };
      const actionName = frame.action && actionClip[frame.action],hasAction = actionName && this.clips.has(actionName);
      // Gait clips often let the arms swing at the sides. That is fine for an
      // unarmed civilian, but it makes a held rifle vanish into the torso while
      // the legs are walking. Keep an armed, two-hand ready pose on the upper
      // layer at all times; the lower layer remains the authored walk/run/sprint
      // cycle. A supplied sword idle pose gives the knife its own readable hold.
      const readyPose = frame.equipment === 'knife' && this.clips.has('Sword_Idle') ? 'Sword_Idle' : 'Pistol_Aim_Neutral';
      const upperName = hasAction ? actionName : frame.reload > 0 ? 'Pistol_Reload' : this.shotRemaining > 0 ? 'Pistol_Shoot' : readyPose;
      const upperOnce = Boolean(hasAction) || ['Pistol_Reload', 'Pistol_Shoot', 'Pistol_Aim_Neutral'].includes(upperName);
      const actionDurations: Record<string,number> = { melee: .38,throw: .55,pickup: .35,switch: .22 };
      const upperRate = hasAction ? this.clips.get(upperName)!.duration / actionDurations[frame.action!] : upperName === 'Pistol_Reload' ? this.clips.get(upperName)!.duration / (frame.reloadDuration ?? 1.25) : upperName === 'Pistol_Shoot' ? this.clips.get(upperName)!.duration / .16 : upperName === clipName ? rate : 1;
      this.upper = this.switchAction(this.upper, this.action('upper-' + upperName, upperName, 'upper', upperOnce), upperRate);
      if (upperName === clipName) this.upper.time = this.base.time;
    }
    for (let i = this.fading.length - 1; i >= 0; i--) { const item = this.fading[i]; item.remaining -= dt; if (item.remaining <= 0) { item.action.stop(); this.fading.splice(i, 1); } }
    // PropertyMixer can skip writing an unchanged sample. Restore the last
    // source pose before evaluating, so procedural twists never accumulate.
    if (this.corrected) { this.pelvis.quaternion.copy(this.pelvisSample); this.chest.quaternion.copy(this.chestSample); this.corrected = false; }
    this.mixer.update(dt);
    if (!full && lowerTwist) {
      this.pelvisSample.copy(this.pelvis.quaternion); this.chestSample.copy(this.chest.quaternion); this.corrected = true;
      // The mixer restores these transforms before every sample; no cumulative
      // twist. One procedural correction supplements real library leg motion.
      this.actor.root.updateMatrixWorld(true);
      direction.copy(up).applyQuaternion(this.pelvis.parent!.getWorldQuaternion(inverse).invert());
      this.pelvis.quaternion.premultiply(correction.setFromAxisAngle(direction, lowerTwist)); this.pelvis.updateMatrixWorld(true);
      direction.copy(up).applyQuaternion(this.chest.parent!.getWorldQuaternion(inverse).invert());
      this.chest.quaternion.premultiply(correction.setFromAxisAngle(direction, -lowerTwist));
    }
    if(!full&&frame.independentAim&&frame.aiming){
      if(!this.corrected){this.pelvisSample.copy(this.pelvis.quaternion);this.chestSample.copy(this.chest.quaternion);this.corrected=true;}
      this.actor.root.updateMatrixWorld(true);direction.copy(up).applyQuaternion(this.chest.parent!.getWorldQuaternion(inverse).invert());
      const offset=Math.atan2(Math.sin(Math.PI/2-frame.angle-this.yaw),Math.cos(Math.PI/2-frame.angle-this.yaw));
      this.chest.quaternion.premultiply(correction.setFromAxisAngle(direction,MathUtils.clamp(offset,-.9,.9)));
    }
    for (const { bone, source } of this.weaponPose) source.copy(bone.quaternion);
    this.actor.recoil = Math.max(0, this.actor.recoil - dt * 9); this.actor.muzzle.visible = this.actor.recoil > .6;
    this.actionTime = this.base.time; this.activeActions = 0;
    for (const action of this.actions.values()) if (action.enabled && (action.isRunning() || action.paused)) this.activeActions++;
  }
  /** Useful to validate sockets against the real animated hand in browser QA. */
  poseSocial(action:string,time:number){
    if(!this.socialArms){
      const body=this.actor.body!,upperR=body.getObjectByName('upperarm_r'),lowerR=body.getObjectByName('lowerarm_r'),handR=body.getObjectByName('hand_r'),upperL=body.getObjectByName('upperarm_l'),lowerL=body.getObjectByName('lowerarm_l'),handL=body.getObjectByName('hand_l');
      // Simplified/legacy animation rigs can still play ordinary locomotion.
      if(!upperR||!lowerR||!handR||!upperL||!lowerL||!handL)return;
      this.socialArms={right:new ArmIK(upperR,lowerR,handR),left:new ArmIK(upperL,lowerL,handL)};
    }
    const lift=(Math.sin(time*2.2-Math.PI/2)+1)/2;
    for(const [side,arm]of [[1,this.socialArms.right],[-1,this.socialArms.left]] as const){
      const mouth=action==='drink'?side===1:action==='eat'?side===1:false;
      this.socialPoint.set(side*(mouth?.18:.25),mouth?1.15+lift*.34:action==='party'?1.2+Math.sin(time*4+side)*.18:1.08,mouth?.36-lift*.23:.37);
      if(action==='party')this.socialPoint.x=side*.43;
      this.actor.root.localToWorld(this.socialPoint);this.socialPole.set(side*.5,.95,.04);this.actor.root.localToWorld(this.socialPole);arm.solve(this.socialPoint,this.socialPole);
    }
  }
  socketPosition(target: Vector3) { this.actor.root.updateMatrixWorld(true); return this.sockets.rightHand.getWorldPosition(target); }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.actor.body!); this.actions.clear(); this.fading.length = 0;
    // Instance skeleton textures belong to the clone; shared geometry/materials
    // remain owned by RaidAssets and must not be disposed per actor.
    this.actor.body?.traverse(node => { if ('isSkinnedMesh' in node && node.isSkinnedMesh) (node as import('three').SkinnedMesh).skeleton.dispose(); });
    this.actor.muzzle.geometry.dispose(); (this.actor.muzzle.material as import('three').Material).dispose();
  }
}

/** Mount supplied equipment at a bone socket; the next phase can replace this
 * existing rifle with authored two-hand grips without changing the rig. */
export function mountHumanoidRifle(actor: Actor, model: Object3D) {
  const box = new Box3().setFromObject(model), size = box.getSize(new Vector3());
  if (size.x > size.z) model.rotation.y = Math.PI / 2;
  model.updateMatrixWorld(true); box.setFromObject(model).getSize(size);
  model.scale.multiplyScalar(.9 / Math.max(size.x, size.y, size.z)); model.updateMatrixWorld(true);
  box.setFromObject(model); model.position.sub(box.getCenter(new Vector3())); model.position.z -= .22;
  actor.weapon.add(model); actor.muzzle.position.set(0, .035, -.68);
}
