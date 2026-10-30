import { describe, expect, it } from 'vitest';
import { Health } from './Health';
import { ProjectilePool, type Shot, type Damageable } from './ProjectilePool';
import { WeaponController } from './weapons';
import { CharacterController, MOVEMENT } from '../characters/CharacterController';
import { emptyCommand } from '../input/InputBuffer';
import type { Blocker } from './geometry';

const shot = (patch: Partial<Shot> = {}): Shot => ({ x: 50, y: 50, angle: 0, speed: 900, lifetime: 1, range: 900, damage: 25, owner: 'operative', team: 'operative', ...patch });
function target(x = 300, team: Damageable['team'] = 'security') {
  const hp = new Health(100, 0);
  return { hp, body: { id: 'target', x, y: 50, team, radius: 15, alive: () => hp.current > 0, damage: event => hp.damage(event) } satisfies Damageable };
}
describe('continuous ranged combat', () => {
  it('hits a small target even when a slow frame crosses its whole body', () => {
    const pool = new ProjectilePool(1000, 1000), t = target(), impacts: number[] = [];
    pool.spawn(shot()); pool.step(.5, [], [t.body], (_p, damage) => impacts.push(damage));
    expect(t.hp.current).toBe(75); expect(impacts).toEqual([25]); expect(pool.activeCount).toBe(0);
    pool.step(.5, [], [t.body], () => { throw new Error('Duplicate impact'); });
  });
  it('a solid cover or closed door blocks a shot before a target, and an open door permits it', () => {
    const cover: Blocker = { id: 'door', x: 180, y: 50, width: 12, height: 100, enabled: true };
    const pool = new ProjectilePool(1000, 1000), t = target();
    pool.spawn(shot()); pool.step(.5, [cover], [t.body], () => {}); expect(t.hp.current).toBe(100);
    cover.enabled = false;
    pool.spawn(shot()); pool.step(.5, [cover], [t.body], () => {}); expect(t.hp.current).toBe(75);
  });
  it('filters ownership and friendly hits and resolves the nearest enemy independently of array order', () => {
    const pool = new ProjectilePool(1000, 1000), near = target(200), far = target(300), friendly = target(100, 'operative');
    pool.spawn(shot()); pool.step(.5, [], [friendly.body, far.body, near.body], () => {});
    expect(friendly.hp.current).toBe(100); expect(near.hp.current).toBe(75); expect(far.hp.current).toBe(100);
  });
  it('expires by lifetime, range and world bounds, rejects invalid shots and caps allocation', () => {
    const pool = new ProjectilePool(100, 100, 3);
    expect(pool.spawn(shot({ speed: NaN }))).toBe(false);
    for (let i = 0; i < 3; i++) expect(pool.spawn(shot())).toBe(true);
    expect(pool.spawn(shot())).toBe(false); pool.step(.2, [], [], () => {}); expect(pool.activeCount).toBe(0);
    pool.spawn(shot({ speed: 1, lifetime: .1 })); pool.step(.11, [], [], () => {}); expect(pool.activeCount).toBe(0);
    pool.spawn(shot({ speed: 100, range: 10 })); pool.step(.2, [], [], () => {}); expect(pool.activeCount).toBe(0);
    pool.spawn(shot()); pool.clear(); expect(pool.activeCount).toBe(0); expect(pool.entries).toHaveLength(3);
  });
  it('produces identical swept-hit outcomes at 15, 30, 60 and 120 simulation steps per second', () => {
    for (const rate of [15, 30, 60, 120]) {
      const pool = new ProjectilePool(1000, 1000), t = target(); pool.spawn(shot());
      for (let i = 0; i < rate; i++) pool.step(1 / rate, [], [t.body], () => {});
      expect(t.hp.current).toBe(75); expect(pool.activeCount).toBe(0);
    }
  });
});
describe('weapon timing and damage ownership', () => {
  it('enforces automatic cooldown, empties a magazine and reloads instead of accumulating shots', () => {
    const weapon = new WeaponController();
    for (let i = 0; i < 130; i++) weapon.step(1 / 60, true, false, true);
    expect(weapon.shots).toBe(12); expect(weapon.ammo).toBe(0); expect(weapon.reloadRemaining).toBeGreaterThan(0);
    for (let i = 0; i < 80; i++) weapon.step(1 / 60, false, false, true);
    expect(weapon.ammo).toBe(12);
    expect(weapon.step(1 / 60, true, false, false)).toBe(false);
    expect(weapon.step(1 / 60, true, false, true)).toBe(true);
    const shots = weapon.shots;
    expect(weapon.step(.016, true, false, true)).toBe(false); expect(weapon.shots).toBe(shots);
  });
  it('reload requests cannot shorten or repeatedly restart a reload and cannot fire during it', () => {
    const weapon = new WeaponController(); weapon.step(.016, true, false, true);
    weapon.step(.016, false, true, true); const remaining = weapon.reloadRemaining;
    weapon.step(.1, true, true, true); expect(weapon.reloadRemaining).toBeCloseTo(remaining - .1); expect(weapon.shots).toBe(1);
    for (let i = 0; i < 100; i++) weapon.step(.016, false, false, true);
    expect(weapon.reloadRemaining).toBe(0); expect(weapon.ammo).toBe(12);
  });
  it('deduplicates damage events, bounds health, respects grace windows and cannot heal death', () => {
    const hp = new Health();
    const event = { id: 'one', sourceId: 'emitter', team: 'security' as const, amount: 25, angle: 0 };
    expect(hp.damage(event)).toBe(25); hp.step(1); expect(hp.damage(event)).toBe(0);
    expect(hp.damage({ ...event, id: 'two' })).toBe(25);
    expect(hp.damage({ ...event, id: 'three' })).toBe(0); expect(hp.current).toBe(50);
    hp.step(1); expect(hp.damage({ ...event, id: 'four', amount: 500 })).toBe(50);
    expect(hp.heal(25)).toBe(0); expect(hp.current).toBe(0);
  });
  it('dodge immunity expires, recovery blocks fire, cooldown blocks retrigger and pause stop removes immunity', () => {
    const player = new CharacterController();
    player.step({ ...emptyCommand(), dodge: true }, 1 / 60);
    expect(player.dodgeImmune).toBe(true); expect(player.damage(15)).toBe(0); expect(player.canAttack).toBe(false);
    for (let i = 0; i < 9; i++) player.step(emptyCommand(), 1 / 60);
    expect(player.dodgeImmune).toBe(false); expect(player.damage(15)).toBe(15);
    for (let i = 0; i < 30; i++) player.step(emptyCommand(), 1 / 60);
    player.step({ ...emptyCommand(), dodge: true }, 1 / 60); expect(player.dodgeSerial).toBe(1);
    for (let i = 0; i < 60; i++) player.step(emptyCommand(), 1 / 60);
    player.step({ ...emptyCommand(), dodge: true }, 1 / 60); player.stop(); expect(player.dodgeImmune).toBe(false);
    expect(player.dodgeCooldown).toBeCloseTo(MOVEMENT.dodgeCooldown);
  });
});
