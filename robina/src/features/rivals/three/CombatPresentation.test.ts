import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, AnimationMixer, Bone, Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, QuaternionKeyframeTrack, Texture, Vector3 } from 'three';
import { createActor } from '../../rugfire/actors';
import { ArmIK } from './ArmIK';
import { FirstPersonWeapon, safeMuzzleOrigin, weaponMetadata } from './WeaponRig';
import { SecurityPresentation } from './SecurityPresentation';
import { CombatEffects } from './CombatEffects';
import { Projectile3D } from './Projectile3D';
import { CombatAudio } from './CombatAudio';
import { defaultSettings } from '../core/settings';
import { BossController } from '../boss/BossController';
import { NavigationGrid } from '../ai/navigation';
import { CameraRig, POVS } from './CameraRig';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function gun() {
  const root = new Group(), muzzle = new Group(); muzzle.name = 'weapon-muzzle'; muzzle.position.z = -.6; root.add(muzzle);
  root.userData.rivalsWeapon = { id: 'rifle', length: .8, forward: '-Z', recoil: .03, sockets: { grip: [0,0,0], muzzle: [0,0,-.6], support: null, eject: [.03,0,0], sight: [0,.15,0] } };
  return root;
}

describe('combat presentation with unchanged simulation rules', () => {
  it('solves a scaled two-bone chain and clamps unreachable targets without changing the body', () => {
    const root = new Group(), upper = new Bone(), lower = new Bone(), hand = new Bone(); root.position.set(3,1,2); root.rotation.y = .7; root.scale.setScalar(1.2);
    root.add(upper); upper.add(lower); lower.add(hand); lower.position.y = -.35; hand.position.y = -.3;
    const ik = new ArmIK(upper, lower, hand), target = new Vector3(3.3,.7,2.1), position = root.position.clone();
    expect(ik.solve(target, new Vector3(4,.5,3))).toBe(true); expect(hand.getWorldPosition(new Vector3()).distanceTo(target)).toBeLessThan(.0001);
    expect(ik.solve(new Vector3(10,10,10), new Vector3(4,.5,3))).toBe(false); expect(root.position.equals(position)).toBe(true);
    expect(hand.getWorldPosition(new Vector3()).distanceTo(upper.getWorldPosition(new Vector3()))).toBeLessThan(.781);
  });
  it('keeps the muzzle outside a wall and the rendered sweep agrees with the real impact', () => {
    const wall = { id: 'wall', kind: 'wall' as const, enabled: true, box: new Box3(new Vector3(.4,0,-1),new Vector3(.6,3,1)) }, origin = new Vector3();
    expect(safeMuzzleOrigin(new Vector3(0,1,0), new Vector3(.8,1,0), [wall], origin)).toBe(true); expect(origin.x).toBeLessThan(.4);
    const pool = new Projectile3D(), impact = vi.fn(), trail = vi.fn(); pool.fire(origin,new Vector3(1,0,0),22.5,.85,19.125,25,'operative','operative');
    pool.step(1/60,[wall],[],impact,trail); expect(impact).toHaveBeenCalledTimes(1); expect(trail).toHaveBeenCalledTimes(1);
    expect(trail.mock.calls[0][0].position.distanceTo(impact.mock.calls[0][0])).toBe(0); expect(pool.entries[0].origin.equals(origin)).toBe(true);
    expect(weaponMetadata(gun()).forward).toBe('-Z'); expect(() => weaponMetadata(new Group())).toThrow();
  });
  it('retains the supplied first-person weapon without inventing an arm rig', () => {
    const view = new FirstPersonWeapon(gun());
    view.update(1 / 60,false,0,1.2,'idle',0);
    expect(view.handsVisible).toBe(false); expect(view.handsAttachedToWeapon).toBe(false); expect(view.handMeshCount).toBe(0);
    expect(view.model.parent).toBe(view.root);
    view.fire(); view.update(1 / 60,false,0,1.2,'idle',0); view.dispose();
  });
  it('latches one nonlooping death, settles at the floor, rejects further flinches and cleans the corpse', () => {
    const actor = createActor('kol'), body = new Group(), elbow = new Group(); elbow.name = 'Elbow_R'; body.add(elbow);
    const mesh = new Mesh(new BoxGeometry(.6,1.8,.4),new MeshStandardMaterial()); mesh.position.y = .9; body.add(mesh); actor.body = body; actor.torso.add(body); actor.mounted = true;
    actor.mixer = new AnimationMixer(body); const clip = new AnimationClip('Death_Fall',.8,[new QuaternionKeyframeTrack('Elbow_R.quaternion',[0,.8],[0,0,0,1,.3,0,0,Math.sqrt(.91)])]);
    const action = actor.mixer.clipAction(clip); actor.actions.set('Death',action); actor.root.position.y = .5;
    const view = new SecurityPresentation(actor,gun()); expect(view.hit(0,true)).toBe(false); expect(view.hit(0,false)).toBe(true); expect(view.hit(0,false)).toBe(false);
    view.update(.3,0,0,new Vector3()); const paused = view.fall.quaternion.clone(),age = view.deathAge;
    for (let i = 0; i < 10; i++) view.update(0,0,0,new Vector3()); expect(view.fall.quaternion.angleTo(paused)).toBeLessThan(.0001); expect(view.deathAge).toBe(age);
    for (let i = 0; i < 90; i++) view.update(1/60,0,0,new Vector3());
    expect(view.deathTransitions).toBe(1); expect(view.height).toBeLessThan(.8); expect(view.floorError).toBeLessThan(.0001); expect(action.clampWhenFinished).toBe(true); expect(action.time).toBe(.8);
    for (let i = 0; i < 600; i++) view.update(1/60,0,0,new Vector3()); expect(view.fall.visible).toBe(false); expect(view.deathTransitions).toBe(1); view.dispose();
    actor.mixer.stopAllAction(); mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose(); actor.muzzle.geometry.dispose(); (actor.muzzle.material as MeshStandardMaterial).dispose();
  });
  it('bounds effects during sustained fire and expires all presentation objects', () => {
    const effects = new CombatEffects({ flash: new Texture(), smoke: new Texture(), blast: new Texture() }); effects.setQuality('low');
    for (let i = 0; i < 150; i++) { effects.muzzle(new Vector3(i,1,0)); effects.impact(new Vector3(),false); }
    expect(effects.snapshot().particles).toBeLessThanOrEqual(16); effects.age(1); expect(effects.snapshot().particles).toBe(0); expect(effects.root.children.length).toBe(100); // 88 combat objects + 12 fixed scorch slots.
    effects.blast(new Vector3(),7);effects.age(46);expect(effects.root.children.every(n=>!n.visible)).toBe(true);effects.dispose(); expect(effects.root.children.length).toBe(0);
  });
  it('settles all four actual supplied security death clips without a raised torso', async () => {
    // Pose-only loader: texture decoding/rendering is tested in Chrome. Actual
    // source geometry, hierarchy and animation tracks are retained here.
    const loader = new GLTFLoader().register(() => ({ name: 'POSE_ONLY_TEXTURES',loadTexture: async () => new Texture() }));
    for (const [role, file] of [['kol','FAKE_KOL_INFLUENCER'],['rugger','RUG_PULLER_RAIDER'],['whale','WHALE_ENFORCER'],['boss','MEGA_RUGGER_BOSS']] as const) {
      const bytes = readFileSync(`public/assets/rugfire/characters/${file}.glb`), gltf = await loader.parseAsync(Uint8Array.from(bytes).buffer,'');
      const actor = createActor(role); actor.body = gltf.scene; actor.torso.add(gltf.scene); actor.mounted = true; actor.mixer = new AnimationMixer(gltf.scene);
      actor.actions.set('Death',actor.mixer.clipAction(gltf.animations.find(c => c.name === 'Death_Fall')!));
      const standing = new Box3().setFromObject(actor.root).getSize(new Vector3()).y, view = new SecurityPresentation(actor,gun()); view.hit(0,false);
      for (let i = 0; i < 100; i++) view.update(1/60,0,0,new Vector3());
      expect(view.height,role + ' corpse height').toBeLessThan(standing * .45); expect(view.floorError).toBeLessThan(.001); expect(view.deathTransitions).toBe(1);
      for(let i=0;i<240;i++)view.update(1/60,0,0,new Vector3());
      const bounds=vi.spyOn(Box3.prototype,'setFromObject'),mixer=vi.spyOn(actor.mixer,'update');
      view.update(1/60,0,0,new Vector3());expect(bounds).not.toHaveBeenCalled();expect(mixer).not.toHaveBeenCalled();bounds.mockRestore();mixer.mockRestore();
      view.update(10,0,0,new Vector3());expect(view.fall.visible).toBe(false);view.dispose(); actor.mixer.stopAllAction();
      gltf.scene.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const m of Array.isArray(node.material) ? node.material : [node.material]) m.dispose(); } });
      actor.muzzle.geometry.dispose(); (actor.muzzle.material as MeshStandardMaterial).dispose();
    }
  });
  it('does not load sounds, create an audio context or retain gesture listeners while muted', () => {
    const fetch = vi.spyOn(globalThis,'fetch'), remove = vi.spyOn(document,'removeEventListener'); const bus = new CombatAudio(defaultSettings());
    bus.shot('rifle'); bus.reload(); bus.blast(); bus.configure(defaultSettings()); expect(fetch).not.toHaveBeenCalled(); expect(bus.snapshot().state).toBe('locked'); bus.dispose();
    expect(remove).toHaveBeenCalledWith('pointerdown',expect.any(Function)); expect(remove).toHaveBeenCalledWith('keydown',expect.any(Function)); fetch.mockRestore(); remove.mockRestore();
  });
  it('switching all perspectives preserves active boss health, phases and death count', () => {
    const boss = new BossController(new NavigationGrid(1792,1408,64,[],24)),rig = new CameraRig(); boss.activate(true); boss.skipIntro();
    boss.damage({ id: 'one',sourceId: 'operative',team: 'operative',amount: 25,angle: 0 }); const before = boss.snapshot();
    for (const pov of POVS) { rig.setPOV(pov); rig.update(new Vector3(2,0,2),[],.02); }
    const after = boss.snapshot(); expect(after.health).toBe(before.health); expect(after.phase).toBe(before.phase); expect(boss.deaths).toBe(0);
  });
});
