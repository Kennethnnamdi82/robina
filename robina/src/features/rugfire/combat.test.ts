import { describe, it, expect } from 'vitest';
import { Box3, Vector3 } from 'three';
import { MissionRuntime } from './runtime';
import { moveBody, obstacleDistance } from './physics';
import { WEAPONS } from './gameData';
const active = () => { const game = new MissionRuntime(); game.mode = 'active'; return game; };
describe('combat state boundaries', () => {
  it('fires distinct weapons with real magazines and cadence', () => {
    for (const id of ['pistol', 'smg', 'rifle'] as const) {
      const g = active(); g.switchWeapon(id); g.tick(.2);
      expect(g.fire()).toBe(true); expect(g.ammo[id].magazine).toBe(WEAPONS[id].magazineSize - 1);
      expect(g.fire()).toBe(false); g.tick(WEAPONS[id].fireInterval / 1000); expect(g.fire()).toBe(true);
    }
  });
  it('conserves ammunition and blocks shots during reload', () => {
    const g = active(); g.ammo.rifle.magazine = 3; g.ammo.rifle.reserve = 10;
    expect(g.reload()).toBe(true); expect(g.fire()).toBe(false); g.tick(1); expect(g.ammo.rifle.magazine).toBe(3);
    g.tick(1); expect(g.ammo.rifle).toEqual({ magazine: 13, reserve: 0 }); expect(g.reload()).toBe(false);
  });
  it('cancels reload on switching or dodging without a stale timer', () => {
    const g = active(); g.ammo.rifle.magazine = 1; g.reload(); g.switchWeapon('pistol'); g.tick(5);
    expect(g.ammo.rifle.magazine).toBe(1); g.ammo.pistol.magazine = 1; g.reload(); expect(g.dodge()).toBe(true); g.tick(5); expect(g.ammo.pistol.magazine).toBe(1);
  });
  it('enforces a limited evade window and cooldown', () => {
    const g = active(); expect(g.dodge()).toBe(true); expect(g.dodge()).toBe(false); expect(g.damage(28, 'whale')).toBe(false);
    g.tick(.3); expect(g.damage(28, 'whale')).toBe(true); expect(g.health).toBe(72); expect(g.dodge()).toBe(false); g.tick(1.5); expect(g.dodge()).toBe(true);
  });
  it('freezes timers, firing and damage in pause and on death', () => {
    const g = active(); g.ammo.rifle.magazine = 1; g.reload(); g.mode = 'paused'; g.tick(100);
    expect(g.time).toBe(0); expect(g.reloadLeft).toBe(1.8); expect(g.fire()).toBe(false); expect(g.damage(100, 'boss')).toBe(false);
    g.mode = 'active'; g.damage(100, 'boss'); expect(g.mode).toBe('rugged'); expect(g.cause).toBe('MEGA RUGGER'); g.tick(100); expect(g.time).toBe(0);
  });
  it('only grants mission completion rewards after extraction', () => {
    const g = active(); g.complete(); expect(g.rewarded).toBe(false); g.stage = 6; expect(g.damage(100, 'boss')).toBe(false);
    g.complete(); expect(g.mode).toBe('complete'); expect(g.rewards.xp).toBe(1800); expect(g.rewards.credits).toBe(650);
    const retry = new MissionRuntime(); expect(retry.stage).toBe(0); expect(retry.health).toBe(100); expect(retry.rewarded).toBe(false);
  });
});
describe('environmental physics', () => {
  const colliders = [{ box: new Box3(new Vector3(-1, 0, -1), new Vector3(1, 2, 1)), camera: true }];
  it('blocks gunfire and cameras with the same cover geometry', () => {
    expect(obstacleDistance(new Vector3(0, 1, 4), new Vector3(0, 0, -1), colliders, 10)).toBe(3);
    expect(obstacleDistance(new Vector3(0, 3, 4), new Vector3(0, 0, -1), colliders, 10)).toBe(10);
  });
  it('prevents fast dodges tunnelling and allows sliding', () => {
    const p = new Vector3(0, 0, 4); moveBody(p, 0, -10, colliders); expect(p.z).toBeCloseTo(1.34);
    moveBody(p, 2, -1, colliders); expect(p.x).toBeCloseTo(2); expect(p.z).toBeLessThan(1.34);
  });
});
