import { AnimationClip, Box3, Color, Group, LoopOnce, LoopRepeat, MathUtils, Mesh, MeshStandardMaterial, Quaternion, Vector3, type AnimationAction, type Material } from 'three';
import { animateActor, type Actor } from '../../rugfire/actors';
import { WeaponRig } from './WeaponRig';

/** Presentation only: health, death counts, attacks, collision and rewards stay
 * owned by the existing enemy/boss models. The supplied Death_Fall bends limbs
 * but has no root fall; a grounded visual root completes that authored clip. */
export class SecurityPresentation {
  readonly fall = new Group(); readonly wrist = new Group(); readonly weapon: WeaponRig;
  dead = false; deathAge = 0; deathTransitions = 0; hitCount = 0; hitRemaining = 0;
  height = 0; floorError = 0;
  private materials = new Map<MeshStandardMaterial, Color>();
  private owned = new Set<Material>(); private bounds = new Box3(); private axis = new Vector3(1, 0, 0);
  private push = new Vector3(); private rotation = new Quaternion(); private scale = new Vector3();
  private hitTint = new Color(0xffa369);
  private rest = new Quaternion(); private spine?: import('three').Object3D; private head?: import('three').Object3D;
  gait='idle';private gaits:AnimationAction[]=[];private gaitAction?:AnimationAction;
  get gaitTime(){return this.gaitAction?.time??0;}
  constructor(readonly actor: Actor, gun: import('three').Object3D,clips:readonly AnimationClip[]=[]) {
    const body = actor.body!; this.fall.name = 'security-grounded-presentation'; actor.torso.add(this.fall); this.fall.add(body);
    this.spine = body.getObjectByName('Spine'); this.head = body.getObjectByName('Head');
    if(clips.some(c=>c.name==='Human_Walk')&&actor.mixer){
      // Shooting/reloading used to replace the entire walking pose, freezing
      // knees mid-stride. Upper/lower layers now have disjoint joint tracks.
      actor.mixer.stopAllAction();
      for(const [key,action]of actor.actions){if(key==='Death')continue;const original=action.getClip(),tracks=original.tracks.filter(t=>!/^(Pelvis|Leg_[LR]|Knee_[LR])\./.test(t.name));const upper=actor.mixer.clipAction(new AnimationClip('SecurityUpper:'+key,original.duration,tracks));upper.setLoop(action.loop,action.repetitions);upper.clampWhenFinished=action.clampWhenFinished;actor.actions.set(key,upper);}
      actor.current=undefined;
      this.gaits=['Human_Idle','Human_Walk','Human_Run'].map(name=>actor.mixer!.clipAction(clips.find(c=>c.name===name)!).setLoop(LoopRepeat,Infinity));
    }
    // The rigid rigs have explicit elbow and gloved-hand geometry. Cache the
    // actual hand's local centre before batching can remove static mesh names.
    const elbow = body.getObjectByName('Elbow_R'); if (!elbow) throw new Error('Security asset has no right wrist joint.');
    this.wrist.name = 'security-right-hand-socket';
    const supplied = elbow.userData.rivalsHand as number[] | undefined;
    this.wrist.position.fromArray(supplied ?? [0, -.32, 0]); elbow.add(this.wrist); this.wrist.add(actor.weapon);
    this.weapon = new WeaponRig(actor, gun);
    const copies = new Map<Material, Material>();
    body.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const copy = (source: Material) => {
        let clone = copies.get(source);
        if (!clone) { clone = source.clone(); copies.set(source, clone); this.owned.add(clone); if (clone instanceof MeshStandardMaterial) this.materials.set(clone, clone.emissive.clone()); }
        return clone;
      };
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
    });
  }
  hit(angle: number, alive: boolean) {
    if (this.dead) return false;
    this.hitCount++; this.hitRemaining = .2;
    this.push.set(Math.cos(angle), 0, Math.sin(angle)); this.actor.root.getWorldQuaternion(this.rotation).invert(); this.push.applyQuaternion(this.rotation);
    if (!alive) return this.die();
    const flinch = this.actor.actions.get('Hit');
    if (flinch) { this.actor.actions.forEach(action => { if (action !== flinch) action.fadeOut(.06); }); flinch.reset().setEffectiveWeight(1).fadeIn(.04).play(); this.actor.current = 'Hit'; }
    return false;
  }
  die() {
    if (this.dead) return false;
    this.dead = true; this.deathTransitions++; this.deathAge = 0; this.hitRemaining = 0;
    this.actor.mixer?.stopAllAction();
    const death = this.actor.actions.get('Death');
    if (death) { death.reset().setLoop(LoopOnce, 1); death.clampWhenFinished = true; death.setEffectiveWeight(1).setEffectiveTimeScale(1).play(); this.actor.current = 'Death'; }
    this.fall.attach(this.actor.weapon);
    this.push.set(MathUtils.clamp(this.push.x * .25, -.25, .25), 0, this.push.z < 0 ? -1 : 1).normalize();
    this.axis.crossVectors(new Vector3(0, 1, 0), this.push).normalize();
    return true;
  }
  update(dt: number, speed: number, hurt: number, target: Vector3,tactic = 'patrol',sprinting = false) {
    if (dt <= 0 || !Number.isFinite(dt)) return;
    this.hitRemaining = Math.max(0, this.hitRemaining - dt);
    this.materials.forEach((base, material) => material.emissive.copy(base).lerp(this.hitTint, this.dead ? 0 : Math.min(.65, this.hitRemaining * 3)));
    this.weapon.decay(dt);
    if (!this.dead) {
      if(this.gaits.length){const index=speed<.12?0:sprinting||speed>3.2?2:1,next=this.gaits[index];this.gait=['idle','walk','run'][index];if(next!==this.gaitAction){this.gaitAction?.fadeOut(.16);next.reset().setEffectiveWeight(1).fadeIn(.16).play();this.gaitAction=next;}next.setEffectiveTimeScale(index===0?1:MathUtils.clamp(speed/(index===1?1.85:4.1),.45,1.8));}
      animateActor(this.actor, dt, sprinting && speed > .1 ? 5.5 : speed, 0, 0, tactic === 'evade' || tactic === 'cover' ? .1 : 0, Math.max(hurt, this.hitRemaining), false);
      this.fall.rotation.set(this.push.z * this.hitRemaining * .08, 0, -this.push.x * this.hitRemaining * .08);
      if(tactic === 'cover' || tactic === 'evade')this.actor.torso.rotation.x=-.38;
      this.weapon.pose(target); this.actor.root.updateMatrixWorld(true);
    } else {
      this.deathAge += dt; this.actor.mixer?.update(dt);
      // The supplied fall ends with a 1.25-radian torso fold. Once the body
      // falls, relax that fold so it rests flat instead of leaving arms/head up.
      const settle = MathUtils.smoothstep(this.deathAge,.35,1.3);
      this.spine?.quaternion.slerp(this.rest,settle); this.head?.quaternion.slerp(this.rest,settle);
      const progress = MathUtils.smoothstep(this.deathAge, .04, 1.05);
      this.fall.quaternion.setFromAxisAngle(this.axis, progress * Math.PI / 2);
      this.fall.position.y = 0; this.actor.root.updateMatrixWorld(true);
      this.bounds.setFromObject(this.actor.body!); this.actor.root.getWorldPosition(this.push); this.actor.torso.getWorldScale(this.scale);
      this.fall.position.y = (this.push.y - this.bounds.min.y + .015) / Math.max(.001, this.scale.y);
      this.actor.root.updateMatrixWorld(true); this.bounds.setFromObject(this.actor.body!);
      this.height = this.bounds.max.y - this.bounds.min.y; this.floorError = Math.abs(this.bounds.min.y - this.push.y - .015);
      this.actor.weapon.visible = this.deathAge < .7;
      const opacity = 1 - MathUtils.smoothstep(this.deathAge, 8, 10);
      this.owned.forEach(material => { if (opacity < 1) { material.transparent = true; material.opacity = opacity; material.depthWrite = false; } });
      this.fall.visible = this.deathAge < 10;
    }
  }
  dispose() { this.owned.forEach(material => material.dispose()); this.owned.clear(); }
}
