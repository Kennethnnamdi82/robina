import { describe, expect, it, vi } from 'vitest';
import { Box3, Vector3 } from 'three';
import { WorldState } from '../world/WorldState';
import { BODY, moveKinematic, traceSolids } from './physics3d';
import { convertSolids, METRES, validateConversion, type Solid3D } from './world3d';
import { CameraRig, POVS } from './CameraRig';
import { Projectile3D } from './Projectile3D';
import { SandboxSession } from './SandboxSession';
import { PRACTICE_KEY } from '../missions/progression';
const wall = (): Solid3D => ({ id: 'wall',enabled: true,kind: 'wall',box: new Box3(new Vector3(2,0,-3),new Vector3(3,3.4,3)) });
describe('unified 3D conversion and physics', () => {
  it('preserves legacy footprints/IDs and rejects invalid conversion metadata', () => {
    const world = new WorldState(),solids = convertSolids(world),bounds = validateConversion(solids);
    expect(bounds.width).toBeCloseTo(44.8); expect(bounds.depth).toBeCloseTo(35.2);
    const gate = solids.find(s => s.id === 'vault-gate')!; expect(gate.box.getCenter(new Vector3()).x).toBe(1088 * METRES); expect(gate.box.max.y).toBeGreaterThan(3);
    expect(world.active.size).toBe(0); expect(() => validateConversion([...solids,solids[0]])).toThrow();
    for (const platform of solids.filter(s => s.kind === 'platform')) expect(platform.box.max.x).toBeLessThan(288 * METRES - BODY.radius);
  });
  it('blocks high-speed movement and jumping through full-height security walls', () => {
    const body = { position: new Vector3(0,0,0),vertical: 0,grounded: true };
    moveKinematic(body,8,0,1/60,[wall()],true); expect(body.position.x).toBeCloseTo(2 - BODY.radius);
    for (let i = 0; i < 120; i++) moveKinematic(body,.1,0,1/60,[wall()]);
    expect(body.position.x).toBeCloseTo(2 - BODY.radius); expect(body.position.y).toBe(0); expect(body.grounded).toBe(true);
  });
  it('jumps, falls and lands on the same physical platform in every POV', () => {
    const platform: Solid3D = { id: 'platform',enabled: true,kind: 'platform',box: new Box3(new Vector3(-1,0,-1),new Vector3(1,.5,1)) };
    const b = { position: new Vector3(0,.5,0),vertical: 0,grounded: true }; moveKinematic(b,0,0,1/60,[platform],true);
    expect(b.position.y).toBeGreaterThan(.5); for (let i = 0; i < 120; i++) moveKinematic(b,0,0,1/60,[platform]);
    expect(b.position.y).toBe(.5); expect(b.grounded).toBe(true);
  });
  it('uses elevation-aware obstruction for shots and cameras', () => {
    expect(traceSolids(new Vector3(0,1,0),new Vector3(1,0,0),[wall()],10)).toBe(2);
    expect(traceSolids(new Vector3(0,4,0),new Vector3(1,0,0),[wall()],10)).toBe(10);
  });
});
describe('four cameras share state', () => {
  it('starts tactical, switches without changing position/health/ammo or world state', () => {
    const rig = new CameraRig(),position = new Vector3(4,0,4),s = new SandboxSession(); s.mission.start();
    expect(rig.pov).toBe('tactical'); const before = position.clone(),run = s.mission.runId;
    for (let i = 0; i < 12; i++) for (const pov of POVS) { rig.setPOV(pov); rig.resize(390,844); rig.update(position,[],1/60); expect(rig.camera.position.toArray().every(Number.isFinite)).toBe(true); }
    expect(position.equals(before)).toBe(true); expect(s.mission.runId).toBe(run); expect(s.getSnapshot().health).toBe(100);
  });
  it('preserves camera collision and constrains side depth only while airborne', () => {
    const rig = new CameraRig(); rig.setPOV('side'); expect(rig.movement(1,1,false)).toEqual({ x: 1,y: 0 }); expect(rig.movement(1,1,true)).toEqual({ x: 1,y: 1 });
    rig.setPOV('third'); rig.update(new Vector3(0,0,0),[{ ...wall(),box: new Box3(new Vector3(-5,0,1),new Vector3(5,5,2)) }],.1,true);
    expect(rig.camera.position.z).toBeLessThan(1);
    expect(rig.camera.position.distanceTo(new Vector3(0,1.05,0))).toBeGreaterThan(1.3);
  });
  it('keeps per-POV zoom bounded and rejects malformed preference values', () => {
    const rig = new CameraRig(); rig.setZoom(99); expect(rig.zoom.tactical).toBe(1.4); rig.setPOV('first'); rig.setZoom(.2); expect(rig.zoom.first).toBe(.7); rig.setZoom(NaN); expect(rig.zoom.first).toBe(.7);
  });
  it('sandbox mission outcomes never mutate real practice or account storage', () => {
    localStorage.setItem(PRACTICE_KEY,'preserved'); const write = vi.spyOn(Storage.prototype,'setItem');
    const s = new SandboxSession(); s.mission.start(); s.update({ status: 'playing' }); s.mission.fail('test'); s.publishMission(); s.publishMission(); s.dispose();
    expect(write).not.toHaveBeenCalled(); expect(localStorage.getItem(PRACTICE_KEY)).toBe('preserved'); write.mockRestore();
  });
});
describe('shared weapon rules with 3D swept impacts', () => {
  it('hits the nearest 3D body, respects cover and stays inside its fixed pool', () => {
    const pool = new Projectile3D(),damage = vi.fn(() => 25),target = { id: 'guard',team: 'security' as const,box: new Box3(new Vector3(5,0,-.5),new Vector3(6,2,.5)),alive: () => true,damage };
    pool.fire(new Vector3(0,1,0),new Vector3(1,0,0),20,2,20,25,'operative','operative'); pool.step(.5,[wall()],[target],() => {}); expect(damage).not.toHaveBeenCalled();
    pool.fire(new Vector3(0,1,0),new Vector3(1,0,0),20,2,20,25,'operative','operative'); pool.step(.5,[],[target],() => {}); expect(damage).toHaveBeenCalledTimes(1);
    pool.clear(); for (let i = 0; i < 48; i++) expect(pool.fire(new Vector3(),new Vector3(1,0,0),1,1,1,1,'guard','security')).toBe(true);
    expect(pool.fire(new Vector3(),new Vector3(1,0,0),1,1,1,1,'guard','security')).toBe(false);
  });
});
