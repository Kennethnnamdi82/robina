import { describe,it,expect } from 'vitest';
import { Vector3,Box3 } from 'three';
import { CharacterController,MOVEMENT } from '../characters/CharacterController';
import { emptyCommand,InputBuffer } from '../input/InputBuffer';
import { SandboxSession } from './SandboxSession';
import { moveKinematic,type Body3D } from './physics3d';
import { Loadout } from './Loadout';
import { CameraRig } from './CameraRig';

describe('requested soldier controls',() => {
  it('fires on a stationary right-stick press and keeps movement and sprint independent',() => {
    const input = new InputBuffer(),out = emptyCommand(); input.aimShoots = true; input.setFire(true);
    expect(input.read(out).fire).toBe(true); expect(out.x).toBe(0); expect(out.y).toBe(0);
    input.setMovement(.5,0); input.mobileSprint = true; input.setAim(0,-1); input.read(out);
    expect(out.x).toBe(.5); expect(out.y).toBe(0); expect(out.sprint).toBe(true);
    input.setAim(0,0); input.setFire(false); expect(input.read(out).fire).toBe(false); expect(out.x).toBe(.5); expect(out.sprint).toBe(true);
  });
  it('latches sprint while aiming and releases it when the raid pauses',() => {
    const session = new SandboxSession(); session.update({ status: 'playing' }); session.setMovement({ x: 1,y: 0 }); session.toggleSprint(); session.setAim({ x: -1,y: 0 });
    expect(session.input.read(emptyCommand()).sprint).toBe(true); expect(session.getSnapshot().mobileSprint).toBe(true); session.pause();
    expect(session.input.read(emptyCommand()).sprint).toBe(false); expect(session.getSnapshot().mobileSprint).toBe(false); session.dispose();
  });
  it('evades backwards at rest or with forward intent; left/right input selects a lateral evade',() => {
    for (const [x,y,dx,dy] of [[0,0,-1,0],[1,0,-1,0],[0,1,0,1],[0,-1,0,-1],[1,1,0,1],[1,-1,0,-1]]) {
      const controller = new CharacterController(true); controller.step({ ...emptyCommand(),x,y,aiming: true,aimX: 1,aimY: 0,dodge: true },1/60);
      expect(controller.vx).toBeCloseTo(dx * MOVEMENT.evadeSpeed); expect(controller.vy).toBeCloseTo(dy * MOVEMENT.evadeSpeed); expect(controller.dodgeSerial).toBe(1);
    }
    const phaser = new CharacterController(); phaser.step({ ...emptyCommand(),aiming: true,aimX: 1,aimY: 0,dodge: true },1/60); expect(phaser.vx).toBe(MOVEMENT.dodgeSpeed);
  });
  it('a bounded jump hold raises the apex without allowing flight or automatic repeated jumps',() => {
    const apex = (hold: boolean) => { const b: Body3D = { position: new Vector3(),vertical: 0,grounded: true }; let max = 0; for (let i = 0; i < 180; i++) { moveKinematic(b,.01,0,1/60,[],i === 0,hold); max = Math.max(max,b.position.y); } expect(b.grounded).toBe(true); expect(b.position.y).toBe(0); expect(b.position.x).toBeGreaterThan(1); return max; };
    const tap = apex(false),held = apex(true); expect(held).toBeGreaterThan(tap * 1.7); expect(held).toBeLessThan(2.6);
  });
  it('held jumps still collide with an overhead ceiling',() => {
    const b: Body3D = { position: new Vector3(),vertical: 0,grounded: true },ceiling = { id: 'ceiling',enabled: true,kind: 'wall' as const,box: new Box3(new Vector3(-2,2.1,-2),new Vector3(2,3,2)) };
    for (let i = 0; i < 120; i++) { moveKinematic(b,0,0,1/60,[ceiling],i === 0,true); expect(b.position.y).toBeLessThanOrEqual(.35001); } expect(b.grounded).toBe(true);
  });
  it('automatically reloads an empty magazine after the fire control has been released',() => {
    const l = new Loadout(); while (l.shots < 12) l.step(.17,true,false,true); expect(l.current.controller.ammo).toBe(0);
    l.step(.02,false,false,true); expect(l.current.controller.reloadRemaining).toBeGreaterThan(0); l.step(1.5,false,false,true);
    expect(l.current.controller.ammo).toBe(12); expect(l.current.controller.reserve).toBe(108); expect(l.shots).toBe(12);
  });
  it('smooths zoom to the target and preserves camera orientation during movement conversion',() => {
    const rig = new CameraRig(); rig.resize(390,844); rig.setPOV('first'); rig.update(new Vector3(),[],1/60); const before = rig.perspective.fov;
    rig.setZoom(1.4); rig.update(new Vector3(),[],1/60); expect(rig.perspective.fov).toBeLessThan(before); expect(rig.perspective.fov).toBeGreaterThan(72/1.4);
    const yaw = rig.yaw; for (let i = 0; i < 100; i++) { rig.movement(1,0,true); rig.update(new Vector3(),[],1/60); } expect(rig.yaw).toBe(yaw); expect(rig.perspective.fov).toBeCloseTo(72/1.4);
  });
});
