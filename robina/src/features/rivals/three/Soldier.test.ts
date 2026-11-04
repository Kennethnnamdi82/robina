import { describe,expect,it,vi } from 'vitest';
import { Box3,Group,Texture,Vector3 } from 'three';
import { Loadout } from './Loadout';
import { BOMB,FieldItems,meleeStrike } from './FieldItems';
import { Health } from '../combat/Health';
import { InputBuffer,emptyCommand } from '../input/InputBuffer';
import { CombatEffects,MuzzleFlash } from './CombatEffects';
import { Projectile3D } from './Projectile3D';
const wall = { id: 'wall',kind: 'wall' as const,enabled: true,box: new Box3(new Vector3(1,0,-4),new Vector3(1.2,4,4)) };
const target = (x: number,z = 0) => { const health = new Health(100,0); return { health,id: 'guard-' + x + '-' + z,team: 'security' as const,box: new Box3(new Vector3(x -.2,0,z -.2),new Vector3(x +.2,2,z +.2)),alive: () => health.current > 0,damage: vi.fn((event: Parameters<Health['damage']>[0]) => health.damage(event)) }; };

describe('soldier loadout and finite ammunition',() => {
  it('retains all three weapons and every ammo state through cycling',() => {
    const l = new Loadout(); for (let i = 0; i < 5; i++) { expect(l.step(.2,true,false,true)).toBe(true); }
    const rifle = l.current; expect(rifle.controller.ammo).toBe(7); expect(l.cycle(true)).toBe(true); l.step(.23,false,false,true); expect(l.current.id).toBe('pistol');
    expect(l.step(.4,true,false,true,true)).toBe(true); expect(l.current.controller.ammo).toBe(11);
    l.cycle(true); l.step(.23,false,false,true); expect(l.current.id).toBe('knife'); l.cycle(true); l.step(.23,false,false,true); expect(l.current).toBe(rifle); expect(l.current.controller.ammo).toBe(7); expect(l.slots.filter(Boolean)).toHaveLength(3);
  });
  it('transfers only available reserve, cannot create ammo, and cannot shoot during reload/switch',() => {
    const l = new Loadout(); l.current.controller.ammo = 4; l.current.controller.reserve = 3;
    expect(l.step(.01,true,true,true)).toBe(false); expect(l.step(.5,true,false,true)).toBe(false); l.step(1,false,false,true); expect(l.current.controller.ammo).toBe(7); expect(l.current.controller.reserve).toBe(0);
    l.step(.1,false,true,true); expect(l.current.controller.reloadRemaining).toBe(0); l.switchTo(1,true); expect(l.step(.01,true,false,true)).toBe(false);
  });
  it('cancels an incomplete reload without transferring ammunition when switching',() => {
    const l = new Loadout(),c = l.current.controller; c.ammo = 2; l.step(.1,false,true,true); expect(c.reloadRemaining).toBeGreaterThan(0); expect(l.cycle(true)).toBe(true); expect(c.ammo).toBe(2); expect(c.reserve).toBe(120); expect(c.reloadRemaining).toBe(0);
  });
  it('knife has no ammunition/reload and respects its cooldown',() => {
    const l = new Loadout(['knife']); expect(l.step(.01,true,true,true)).toBe(true); for (let i = 0; i < 20; i++) expect(l.step(.01,true,true,true)).toBe(false); expect(l.step(.4,true,true,true)).toBe(true); expect(l.current.controller.ammo).toBe(0); expect(l.current.controller.reloadRemaining).toBe(0);
  });
  it('blocked/dead action intent cannot attack, switch or begin reload',() => {
    const l = new Loadout(); expect(l.cycle(false)).toBe(false); expect(l.step(1,true,true,false)).toBe(false); expect(l.shots).toBe(0); expect(l.current.controller.reloadRemaining).toBe(0);
  });
});
describe('pickups, bombs and shared health',() => {
  it('does not consume full-health boxes, clamps healing and never heals a dead player',() => {
    const f = new FieldItems(),l = new Loadout(),h = new Health(); f.add('med',new Vector3(),{ kind: 'health',amount: 40 }); const p = f.pickups[0];
    expect(f.take(p,l,h,true)).toBe(false); expect(p.consumed).toBe(false); expect(f.message).toBe('Health Full.'); h.current = 85; expect(f.take(p,l,h,true)).toBe(true); expect(h.current).toBe(100); expect(f.take(p,l,h,true)).toBe(false);
    f.add('med2',new Vector3(),{ kind: 'health',amount: 75 }); h.current = 0; expect(f.take(f.pickups[1],l,h,true)).toBe(false); expect(f.pickups[1].consumed).toBe(false);
  });
  it('fills an empty slot and requires explicit replacement when full; cancel changes nothing',() => {
    const f = new FieldItems(),h = new Health(),l = new Loadout(['rifle']); f.add('pistol',new Vector3(),{ kind: 'weapon',weapon: 'pistol' }); expect(f.take(f.pickups[0],l,h,true)).toBe(true); expect(l.slots[1]?.id).toBe('pistol');
    l.collect('knife'); f.add('smg',new Vector3(),{ kind: 'weapon',weapon: 'smg' }); const before = [...l.slots]; expect(f.take(f.pickups[1],l,h,true)).toBe(false); expect(f.pending).toBe('smg'); f.cancel(); expect(l.slots).toEqual(before); expect(f.pickups[1].consumed).toBe(false);
    f.take(f.pickups[1],l,h,true); expect(f.take(f.pickups[1],l,h,true,1)).toBe(true); expect(l.slots[0]).toBe(before[0]); expect(l.slots[2]).toBe(before[2]); expect(l.slots[1]?.id).toBe('smg'); expect(f.take(f.pickups[1],l,h,true,0)).toBe(false);
  });
  it('rejects invalid replacement slots and blocked pickup intent',() => {
    const f = new FieldItems(),l = new Loadout(),h = new Health(); f.add('x',new Vector3(),{ kind: 'weapon',weapon: 'smg' }); const p = f.pickups[0]; expect(f.take(p,l,h,false,1)).toBe(false); expect(f.take(p,l,h,true,99)).toBe(false); expect(p.consumed).toBe(false); expect(l.slots[0]?.id).toBe('rifle');
  });
  it('limits bomb stock and decrements once per accepted throw',() => {
    const f = new FieldItems(),l = new Loadout(),h = new Health(); f.add('bombs',new Vector3(),{ kind: 'bomb',amount: 20 }); expect(f.take(f.pickups[0],l,h,true)).toBe(true); expect(f.quantity).toBe(BOMB.capacity);
    for (let i = 0; i < 6; i++) expect(f.throw(new Vector3(),new Vector3(0,0,-5),true)).toBe(true); expect(f.quantity).toBe(0); expect(f.throw(new Vector3(),new Vector3(0,0,-5),true)).toBe(false); expect(f.thrown).toBe(6);
  });
  it('throws on an arc, collides with cover and explodes once with one hit per eligible target',() => {
    const f = new FieldItems(),a = target(.2),b = target(2),explode = vi.fn(); expect(f.throw(new Vector3(),new Vector3(4,0,0),false)).toBe(false); expect(f.throw(new Vector3(),new Vector3(4,0,0),true)).toBe(true);
    f.step(.05,[wall],[a,b],explode); expect(f.bombs[0].position.y).toBeGreaterThan(1.25);
    for (let i = 0; i < 200; i++) f.step(.01,[wall],[a,b],explode);
    expect(explode).toHaveBeenCalledTimes(1); expect(a.damage).toHaveBeenCalledTimes(1); expect(b.damage).not.toHaveBeenCalled(); expect(f.exploded).toBe(1); expect(f.bombs[0].active).toBe(false);
  });
  it('will not offer an item through a wall or duplicate the same death drop',() => {
    const f = new FieldItems(); f.add('drop',new Vector3(1.5,0,0),{ kind: 'bomb',amount: 1 }); f.add('drop',new Vector3(),{ kind: 'bomb',amount: 1 }); expect(f.pickups).toHaveLength(1); expect(f.nearby(new Vector3(),[wall])).toBeUndefined();
  });
  it('melee damages the aimed cone within reach and respects physical cover',() => {
    const a = target(.8),b = target(-.8),c = target(4); expect(meleeStrike(new Vector3(0,1,0),new Vector3(1,0,0),[a,b,c],[],45,1.8,1)).toBe(1); expect(a.health.current).toBe(55); expect(b.health.current).toBe(100); expect(c.health.current).toBe(100);
    const behind = target(1.5); expect(meleeStrike(new Vector3(0,1,0),new Vector3(1,0,0),[behind],[wall],45,1.8,2)).toBe(0);
  });
});
describe('aim-to-fire and live muzzle presentation',() => {
  it('keeps auto fire opt-in and releases it immediately without affecting movement',() => {
    const input = new InputBuffer(),out = emptyCommand(); input.setAim(1,0); expect(input.read(out).fire).toBe(false); input.aimShoots = true; input.setMovement(1,1); expect(input.read(out).fire).toBe(true); expect(Math.hypot(out.x,out.y)).toBeCloseTo(1); input.setAim(0,0); expect(input.read(out).fire).toBe(false); expect(input.touchMoving).toBe(true); input.reset(); expect(input.touchMoving).toBe(false);
  });
  it('tracks an animated muzzle through translations/rotations, including the first rendered flash',() => {
    const socket = new Group(),root = new Group(); root.add(socket); const flash = new MuzzleFlash(socket,new Texture()); flash.fire(); root.position.set(3,2,1); root.rotation.y = .7; socket.position.set(.1,1,-.4); flash.update(.1);
    expect(flash.root.visible).toBe(true); expect(flash.root.getWorldPosition(new Vector3()).distanceTo(socket.getWorldPosition(new Vector3()))).toBeLessThan(.000001); flash.update(.1); expect(flash.root.visible).toBe(false); flash.dispose();
  });
  it('uses one continuous streak per real projectile across multiple physics samples',() => {
    const fx = new CombatEffects({ flash: new Texture(),smoke: new Texture(),blast: new Texture() }),pool = new Projectile3D(); pool.fire(new Vector3(),new Vector3(1,0,0),22.5,1,20,25,'operative','operative');
    for (let i = 0; i < 10; i++) pool.step(.016,[],[],() => {},b => fx.trace(b)); expect(fx.snapshot().trails).toBe(1); fx.age(.1); expect(fx.snapshot().trails).toBe(0); fx.dispose();
  });
});
