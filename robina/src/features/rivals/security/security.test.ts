import { describe,expect,it,vi } from 'vitest';
import { WorldState } from '../world/WorldState';
import { THE_LAUNCH } from '../world/level';
import { SecurityController,cyclePhase,touchesBeam } from './SecurityController';
import { HEIST_SECURITY,type SecurityDefinition } from './definitions';
import { HackPuzzle } from './HackPuzzle';
import { ArenaSession } from '../core/session';

const object = (id: string) => THE_LAUNCH.objects.find(o => o.id === id)!;
function emptyWorld() { return new WorldState({ ...THE_LAUNCH,props: [],objects: [],walls: Array.from({ length: 22 },() => Array(28).fill(0)) }); }
const quiet: SecurityDefinition = { ...HEIST_SECURITY,cameras: [],lasers: [] };
describe('security perception, traps and alarm network',() => {
  it('distinguishes safe/warning/live laser windows and validates actual beam collision',() => {
    expect(cyclePhase(0,3,1,2)).toBe('OFF'); expect(cyclePhase(3.5,3,1,2)).toBe('WARNING'); expect(cyclePhase(4.5,3,1,2)).toBe('ACTIVE'); expect(cyclePhase(6,3,1,2)).toBe('OFF');
    expect(touchesBeam({ x: 150,y: 112 },{ x: 100,y: 100 },{ x: 200,y: 100 },17)).toBe(true); expect(touchesBeam({ x: 300,y: 100 },{ x: 100,y: 100 },{ x: 200,y: 100 },17)).toBe(false);
    const security = new SecurityController(emptyWorld(),{ ...quiet,lasers: [{ id: 'test',a: { x: 100,y: 100 },b: { x: 200,y: 100 },off: 3,warning: 1,active: 2,offset: 0,damage: 12 }] }), damage = vi.fn(() => 12);
    security.step(3.5,{ x: 150,y: 100 },true,damage); expect(damage).not.toHaveBeenCalled();
    security.step(.6,{ x: 150,y: 100 },true,damage); security.step(.01,{ x: 150,y: 100 },true,damage);
    expect(damage).toHaveBeenCalledTimes(1); expect(security.alarmSerial).toBe(1);
    security.step(.7,{ x: 150,y: 100 },true,damage); expect(damage).toHaveBeenCalledTimes(2);
  });
  it('camera buildup respects wall occlusion and temporary suppression expires',() => {
    const definition = { ...quiet,cameras: [{ id: 'cam',x: 100,y: 100,angle: 0,sweep: 0,period: 4,range: 300,cone: .5,detection: .5 }] };
    const world = emptyWorld(), security = new SecurityController(world,definition), player = { x: 220,y: 100 };
    world.blockers.push({ id: 'cover',x: 160,y: 100,width: 20,height: 60,enabled: true });
    for (let i = 0; i < 10; i++) security.step(.1,player,true,() => 0); expect(security.alarmSerial).toBe(0);
    world.blockers[0].enabled = false; security.disabled.set('cam',security.clock + 1);
    for (let i = 0; i < 8; i++) security.step(.1,player,true,() => 0); expect(security.alarmSerial).toBe(0);
    for (let i = 0; i < 10; i++) security.step(.1,player,true,() => 0); expect(security.alarmSerial).toBe(1);
  });
  it('limits repeated alerts, expires a quiet alarm and creates a new incident afterward',() => {
    const security = new SecurityController(emptyWorld(),quiet), point = { x: 100,y: 100 };
    expect(security.raise('camera',point)).toBe(true); expect(security.raise('camera',point)).toBe(false); expect(security.alarmSerial).toBe(1);
    security.step(13,point,false,() => 0); expect(security.alarmRemaining).toBe(0); security.raise('laser',point); expect(security.alarmSerial).toBe(2);
  });
});
describe('playable hack and linked access conditions',() => {
  it('publishes a coherent session snapshot once across nested adapter updates',() => {
    const session = new ArenaSession(), snapshots: unknown[] = [];
    session.subscribe(() => snapshots.push(session.getSnapshot()));
    session.batch(() => { session.update({ elapsed: 2 }); session.batch(() => session.update({ health: 75 })); expect(snapshots).toHaveLength(0); });
    expect(snapshots).toHaveLength(1); expect(snapshots[0]).toMatchObject({ elapsed: 2,health: 75 });
    session.batch(() => {}); expect(snapshots).toHaveLength(1);
    expect(() => session.batch(() => { session.update({ elapsed: 3 }); throw new Error('adapter failure'); })).toThrow('adapter failure');
    expect(snapshots).toHaveLength(2); session.update({ elapsed: 4 }); expect(snapshots).toHaveLength(3);
  });
  it('rejects the wrong code, retries, and only a completed handshake changes real device/door state',() => {
    const world = new WorldState(), security = new SecurityController(world), terminal = object('sector-console'), actor = { x: 1056,y: 730 };
    expect(world.interact(terminal,actor)).toBeNull(); expect(security.beginHack(terminal,actor)).toBe(true);
    security.submitHack(1,actor); expect(security.hack!.getSnapshot().result).toBe('failure'); expect(world.active.has(terminal.id)).toBe(false); expect(security.alarmSerial).toBe(1);
    security.hack!.retry(); for (const pad of [2,4,1,3]) security.submitHack(pad,actor);
    expect(security.hack!.getSnapshot().result).toBe('success'); expect(world.active.has(terminal.id)).toBe(true); expect(security.disabledFor('vault-grid')).toBe(24); expect(security.hacksCompleted).toBe(1);
    security.submitHack(3,actor); expect(security.hacksCompleted).toBe(1);
    expect(world.interact(object('vault-gate'),{ x: 1088,y: 560 })).not.toBeNull();
    expect(world.interact(object('vault'),{ x: 1536,y: 272 })).toBeNull();
  });
  it('checks terminal range at submission and supports an optional configured puzzle deadline',() => {
    const security = new SecurityController(new WorldState()); security.beginHack(object('sector-console'),{ x: 1056,y: 730 });
    security.submitHack(2,{ x: 100,y: 100 }); expect(security.hack!.getSnapshot().result).toBe('failure'); expect(security.world.active.has('sector-console')).toBe(false);
    const timed = new HackPuzzle({ ...HEIST_SECURITY.hacks[0],timeLimit: 2 },10); timed.submit(2,13); expect(timed.getSnapshot().result).toBe('failure'); timed.retry(15); expect(timed.getSnapshot().entered).toEqual([]);
  });
  it('requires the timed WEST-to-EAST sequence in an open window and resets expired links',() => {
    const world = new WorldState(), security = new SecurityController(world,quiet), west = object('sequence-start'), east = object('sequence-end');
    expect(world.interact(west,{ x: 864,y: 920 })).toBeNull(); security.clock = 1; security.timedInteract(west,{ x: 864,y: 920 }); expect(security.sequenceFailures).toBe(1);
    security.clock = 3.2; security.timedInteract(west,{ x: 864,y: 920 }); security.step(3.6,{ x: 900,y: 920 },false,() => 0); security.timedInteract(east,{ x: 1056,y: 920 }); expect(world.active.has('timed-access')).toBe(false);
    security.clock = 11.2; security.timedInteract(west,{ x: 864,y: 920 }); security.step(.8,{ x: 1000,y: 920 },false,() => 0); security.timedInteract(east,{ x: 1056,y: 920 }); expect(world.active.has('timed-access')).toBe(true);
  });
  it('opens the vault only after sector hack, phase link and both relays; a new run clears everything',() => {
    const world = new WorldState(), security = new SecurityController(world,quiet), actor = { x: 1056,y: 730 };
    security.beginHack(object('sector-console'),actor); [2,4,1,3].forEach(pad => security.submitHack(pad,actor));
    world.interact(object('relay-a'),{ x: 1184,y: 320 }); world.interact(object('relay-b'),{ x: 1504,y: 384 });
    expect(world.interact(object('vault'),{ x: 1536,y: 272 })).toBeNull();
    security.clock = 3.2; security.timedInteract(object('sequence-start'),{ x: 864,y: 920 }); security.clock = 4.2; security.timedInteract(object('sequence-end'),{ x: 1056,y: 920 });
    expect(world.interact(object('vault'),{ x: 1536,y: 272 })).toBeNull();
    world.grantFlag('guardian-defeated');
    expect(world.interact(object('vault'),{ x: 1536,y: 272 })).not.toBeNull(); expect(world.blockers.find(b => b.id === 'vault')?.enabled).toBe(false);
    expect(new WorldState().missing(object('vault')).length).toBe(5);
  });
  it('freezes gameplay intent during hacking, cancels safely on pause, and gates QA diagnostics',() => {
    const session = new ArenaSession(), pause = vi.fn(), resume = vi.fn();
    session.attach({ pause,resume,mute: vi.fn(),hackClose: value => session.finishHack(value) }); session.update({ status: 'playing' });
    session.openHack(new HackPuzzle(HEIST_SECURITY.hacks[0]).getSnapshot()); expect(pause).toHaveBeenCalled(); expect(session.canControl()).toBe(false);
    session.setMovement({ x: 1,y: 0 }); expect(session.movement.x).toBe(0); session.pause(); expect(session.getSnapshot().hack).toBeNull(); session.resume(); expect(session.canControl()).toBe(true);
    session.setDebug(true); expect(session.getSnapshot().debug).toBe(false);
    const qa = new ArenaSession({ validation: true }); qa.setDebug(true); expect(qa.getSnapshot().debug).toBe(true);
  });
});
