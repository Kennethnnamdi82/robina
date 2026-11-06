import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, Quaternion, QuaternionKeyframeTrack, Vector3 } from 'three';
import { createActor } from '../../rugfire/actors';
import { HumanoidAnimator, type HumanoidFrame } from './HumanoidAnimator';
import { dodgeMotionScale } from './dodgeMotion';
import { MOVEMENT } from '../characters/CharacterController';
import { BODY, moveKinematic } from './physics3d';
import { Box3 } from 'three';

function fixture() {
  const actor = createActor('player'), body = new Group();
  const root = new Bone(); root.name = 'root'; body.add(root);
  const pelvis = new Bone(); pelvis.name = 'pelvis'; root.add(pelvis);
  for (const name of ['thigh_l', 'spine_01', 'spine_03', 'hand_r', 'hand_l', 'Head', 'clavicle_l', 'clavicle_r']) { const bone = new Bone(); bone.name = name; pelvis.add(bone); }
  const names = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Fwd_Loop', 'Roll', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Hit_Chest', 'Death01', 'Pistol_Aim_Neutral', 'Pistol_Idle_Loop', 'Pistol_Shoot', 'Pistol_Reload', 'Sword_Idle'];
  const clips = names.map(name => new AnimationClip(name, 1, [new QuaternionKeyframeTrack('thigh_l.quaternion', [0, .5, 1], [0, 0, 0, 1, .5, 0, 0, Math.sqrt(.75), 0, 0, 0, 1]), new QuaternionKeyframeTrack('hand_r.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])]));
  return new HumanoidAnimator(actor, body, clips);
}
const frame = (patch: Partial<HumanoidFrame> = {}): HumanoidFrame => ({ vx: 0, vz: 0, vertical: 0, grounded: true, sprinting: false, aiming: false, angle: 0, pov: 'tactical', dodgeRemaining: 0, dodgeSerial: 0, health: 100, hitSerial: 0, shots: 0, reload: 0, ...patch });

describe('humanoid animation lifecycle', () => {
  it('restores the authored wrist pose before an unchanged clamped animation sample',()=>{
    const a=fixture(),f=frame({aiming:true});for(let i=0;i<80;i++)a.update(.02,f);
    const hand=a.actor.body!.getObjectByName('hand_r')!,source=hand.quaternion.clone();
    for(let i=0;i<100;i++){hand.quaternion.setFromAxisAngle(new Vector3(0,1,0),i*.1);a.update(.02,f);expect(hand.quaternion.angleTo(source)).toBeLessThan(.0001);}
    a.dispose();
  });
  it('keeps feet, root position and facing still when only the fire stick aims',()=>{
    const a=fixture();a.update(.1,frame({pov:'third',independentAim:true}));const yaw=a.yaw,position=a.actor.root.position.clone();
    for(let i=0;i<30;i++)a.update(1/60,frame({pov:(['third','side','first','tactical'] as const)[i%4],independentAim:true,aiming:true,angle:i*.1,shots:i}));
    expect(a.yaw).toBeCloseTo(yaw);expect(a.actor.root.position.equals(position)).toBe(true);expect(a.motion).toBe('idle');a.dispose();
  });
  it('advances a stepping cycle without restarting, tracks real speed and keeps independent mixers', () => {
    const a = fixture(), b = fixture();
    for (let i = 0; i < 10; i++) a.update(.02, frame({ vx: 5.8 }));
    expect(a.motion).toBe('run'); expect(a.actionTime).toBeGreaterThan(.2);
    expect(b.mixer.time).toBe(0); expect(a.mixer).not.toBe(b.mixer);
    a.update(.2, frame()); expect(a.motion).toBe('idle'); expect(a.speed).toBe(0);
    a.dispose(); b.dispose();
  });
  it('keeps the active weapon in a ready hand pose while the legs use locomotion clips', () => {
    const a = fixture();
    a.update(.1, frame({ vx: 4.5, equipment: 'rifle' }));
    expect(a.clipName).toBe('Jog_Fwd_Loop'); expect(a.upperClipName).toBe('Pistol_Aim_Neutral');
    a.update(.1, frame({ vx: 4.5, equipment: 'knife' }));
    expect(a.upperClipName).toBe('Sword_Idle'); a.dispose();
  });
  it('preserves phase and state through all POVs, with correct +Z model orientation', () => {
    const a = fixture(); a.update(.6, frame({ vx: 2, angle: 0 })); let previous = a.actionTime;
    for (const pov of ['tactical', 'side', 'third', 'first'] as const) {
      a.update(.03, frame({ vx: 2, angle: 0, pov }));
      expect(a.actionTime).toBeGreaterThan(previous); previous = a.actionTime;
      expect(Math.sin(a.yaw)).toBeCloseTo(1);
    }
    a.dispose();
  });
  it('plays takeoff/fall/landing, recovers from a roll and holds terminal death', () => {
    const a = fixture();
    a.update(.02, frame({ grounded: false, vertical: 5 })); expect(a.motion).toBe('takeoff');
    a.update(.2, frame({ grounded: false, vertical: -1 })); expect(a.motion).toBe('fall');
    a.update(.02, frame()); expect(a.motion).toBe('land'); a.update(.2, frame()); expect(a.motion).toBe('idle');
    a.update(.01, frame({ dodgeSerial: 1, dodgeRemaining: .18 })); expect(a.motion).toBe('dodge');
    a.update(.1, frame({ dodgeSerial: 1 })); expect(a.motion).toBe('dodge');
    a.update(.2, frame({ dodgeSerial: 1 })); expect(a.motion).toBe('idle');
    a.update(.01, frame({ health: 0 })); a.update(2, frame({ health: 0 })); expect(a.motion).toBe('death'); expect(a.actionTime).toBe(1);
    a.dispose();
  });
  it('bounds active crossfades, leaves firing on the upper layer and releases actions on exit', () => {
    const a = fixture();
    for (let i = 0; i < 80; i++) a.update(.06, frame({ vx: i % 2 ? 5.8 : 0, aiming: i % 3 === 0, shots: Math.floor(i / 4) }));
    a.update(.2, frame({ vx: 5.8, shots: 20 })); expect(a.motion).toBe('run'); expect(a.activeActions).toBeLessThanOrEqual(4);
    const time = a.mixer.time; a.update(0, frame({ vx: 5.8, shots: 20 })); expect(a.mixer.time).toBe(time);
    a.dispose(); expect(a.mixer.stats.actions.inUse).toBe(0); a.dispose();
  });
  it('calibrates equipment forward to the aiming pose and follows the animated hand', () => {
    const a = fixture();
    a.update(1, frame({ aiming: true, angle: Math.PI / 2 }));
    a.actor.root.updateMatrixWorld(true);
    const forward = new Vector3(0, 0, -1).applyQuaternion(a.sockets.rightHand.getWorldQuaternion(new Quaternion()));
    expect(forward.z).toBeCloseTo(1);
    const before = a.socketPosition(new Vector3()); a.actor.root.position.x += 3;
    const after = a.socketPosition(new Vector3()); expect(after.x - before.x).toBeCloseTo(3);
    a.dispose();
  });
  it('uses a speed-matched retreat gait while aiming and turns sideways even at rest', () => {
    const a = fixture();
    a.update(.05, frame({ vz: 1, aiming: true, angle: -Math.PI / 2, pov: 'third' }));
    expect(a.clipName).toBe('Walk_Loop');
    a.update(.5, frame({ vz: 9, aiming: true, sprinting: true, angle: -Math.PI / 2, pov: 'third' }));
    expect(a.clipName).toBe('Sprint_Loop');
    expect(a.motion).toBe('backward'); const phase = a.actionTime;
    a.update(.1, frame({ vz: 9, aiming: true, sprinting: true, angle: -Math.PI / 2, pov: 'third' }));
    expect(a.actionTime).toBeLessThan(phase);
    a.update(.6, frame({ pov: 'side' })); expect(Math.abs(Math.sin(a.yaw))).toBeCloseTo(1);
    a.dispose();
  });
  it('does not accumulate a procedural aim twist when a source bone has constant tracks', () => {
    const a = fixture(), f = frame({ vx: 2, aiming: true, angle: -Math.PI / 2 });
    for (let i = 0; i < 100; i++) a.update(.02,f);
    const pelvis = a.actor.body!.getObjectByName('pelvis')!, before = pelvis.quaternion.clone();
    for (let i = 0; i < 100; i++) a.update(.02,f);
    expect(pelvis.quaternion.angleTo(before)).toBeLessThan(.0001); a.dispose();
  });
});

describe('3D dodge presentation preserves gameplay rules', () => {
  it('preserves integrated dodge distance across update rates, with acceleration and braking', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
      let distance = 0;
      for (let elapsed = 0; elapsed < MOVEMENT.dodgeDuration - 1e-9; elapsed += dt) distance += dodgeMotionScale(MOVEMENT.dodgeDuration - elapsed, dt) * dt * MOVEMENT.dodgeSpeed;
      expect(distance).toBeCloseTo(MOVEMENT.dodgeDuration * MOVEMENT.dodgeSpeed, 6);
    }
    expect(dodgeMotionScale(.18, 1 / 120)).toBeLessThan(dodgeMotionScale(.09, 1 / 120));
  });
  it('still collides with walls during a complete shaped dodge', () => {
    const body = { position: new Vector3(0, 0, 0), grounded: true, vertical: 0 };
    const wall = { id: 'wall', kind: 'wall' as const, enabled: true, box: new Box3(new Vector3(1, 0, -2), new Vector3(2, 3, 2)) };
    for (let elapsed = 0; elapsed < .18; elapsed += 1 / 60) moveKinematic(body, dodgeMotionScale(.18 - elapsed, 1 / 60) * MOVEMENT.dodgeSpeed * .025 / 60, 0, 1 / 60, [wall]);
    expect(body.position.x).toBeCloseTo(1 - BODY.radius); expect(body.grounded).toBe(true);
  });
});
