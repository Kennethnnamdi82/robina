import { describe, expect, it, vi } from 'vitest';
import { BossController, type BossEffects } from './BossController';
import { NavigationGrid } from '../ai/navigation';
import { VAULT_GUARDIAN } from './definitions';
const create = () => new BossController(new NavigationGrid(28,22,64,[]));
const effects = (): BossEffects => ({ projectile: vi.fn(),pulse: vi.fn(),defeated: vi.fn() });
const player = { x: 1220,y: 240 };
const tick = (b: BossController,e: BossEffects,seconds: number) => { for (let t = 0; t < seconds; t += 1/60) b.step(1/60,player,e); };
const damage = (b: BossController,amount: number,id: string) => b.damage({ id,sourceId: 'operative',team: 'operative',amount,angle: 0 });
describe('Vault Guardian', () => {
  it('activates once, supports skip/reduced motion and cannot attack during its intro', () => {
    const b = create(), e = effects(); expect(damage(b,100,'early')).toBe(0);
    expect(b.activate()).toBe(true); expect(b.activate()).toBe(false); tick(b,e,.5);
    expect(e.projectile).not.toHaveBeenCalled(); expect(damage(b,100,'intro')).toBe(0);
    b.skipIntro(); expect(b.state).toBe('READY'); expect(b.health.current).toBe(450);
    const reduced = create(); reduced.activate(true); expect(reduced.remaining).toBeLessThan(.2);
  });
  it('telegraphs before firing a configured fan and recovers afterward', () => {
    const b = create(), e = effects(); b.activate(); b.skipIntro(); tick(b,e,.82);
    expect(b.state).toBe('WINDUP'); expect(e.projectile).not.toHaveBeenCalled();
    tick(b,e,.9); expect(e.projectile).toHaveBeenCalledTimes(3); tick(b,e,.3);
    expect(b.state).toBe('RECOVERY'); expect(b.vulnerable).toBe(true);
  });
  it('crosses A/B/C thresholds, grants transition protection and fires every reusable ability', () => {
    const b = create(), e = effects(); b.activate(); b.skipIntro();
    damage(b,160,'B'); expect(b.phase).toBe('B'); expect(b.state).toBe('TRANSITION'); expect(damage(b,100,'protected')).toBe(0);
    tick(b,e,35); expect(b.attacks.burst).toBeGreaterThan(0); expect(b.attacks.charge).toBeGreaterThan(0);
    expect(b.attacks.pulse).toBeGreaterThan(0); expect(b.attacks.reposition).toBeGreaterThan(0);
    damage(b,160,'C'); expect(b.phase).toBe('C'); tick(b,e,35);
    expect(e.pulse).toHaveBeenCalled(); expect(e.projectile).toHaveBeenCalled();
    expect(b.health.current).toBe(130); expect(b.deaths).toBe(0);
  });
  it('holds pulse target at windup origin, lets the player evade, and exposes recovery windows', () => {
    const b = create(), e = effects(); b.activate(); b.skipIntro(); damage(b,160,'phase');
    for (let i = 0; i < 3600 && !(b.state === 'WINDUP' && b.ability === 'pulse'); i++) b.step(1/60,player,e);
    expect(b.ability).toBe('pulse'); const captured = { ...b.target };
    for (let i = 0; i < 100; i++) b.step(1/60,{ x: player.x + 220,y: player.y },e);
    expect(e.pulse).toHaveBeenCalledWith(captured,88,16,expect.any(Number)); expect(b.vulnerable).toBe(true);
  });
  it('deduplicates damage, applies half-damage charge armor and staggers on sustained pressure', () => {
    const b = create(), e = effects(); b.activate(); b.skipIntro();
    for (let i = 0; i < 1000 && !(b.state === 'WINDUP' && b.ability === 'charge'); i++) b.step(1/60,player,e);
    expect(b.shielded).toBe(true); expect(damage(b,20,'shot')).toBe(10); expect(damage(b,20,'shot')).toBe(0);
    // A configurable high stagger threshold avoids replacing phase rules with stun lock.
    const d = { ...VAULT_GUARDIAN,stagger: { ...VAULT_GUARDIAN.stagger,damage: 30 } };
    const staggered = new BossController(new NavigationGrid(28,22,64,[]),d); staggered.activate(); staggered.skipIntro(); damage(staggered,30,'stagger');
    expect(staggered.state).toBe('STAGGERED'); tick(staggered,e,1.3); expect(staggered.state).toBe('READY');
  });
  it('publishes death exactly once and stops attacks after defeat; fresh instance resets everything', () => {
    const b = create(), e = effects(); b.activate(); b.skipIntro(); damage(b,450,'fatal'); tick(b,e,10);
    expect(b.state).toBe('DEFEATED'); expect(e.defeated).toHaveBeenCalledTimes(1); expect(e.projectile).not.toHaveBeenCalled(); expect(damage(b,10,'late')).toBe(0);
    expect(create().snapshot()).toMatchObject({ state: 'DORMANT',health: 450,phase: 'A',deaths: 0 });
  });
  it('respects solid cover in pursuit and cannot walk through arena blockers', () => {
    const wall = { id: 'cover',x: 1300,y: 220,width: 40,height: 160,enabled: true };
    const b = new BossController(new NavigationGrid(28,22,64,[wall])), e = effects(); b.activate(); b.skipIntro(); tick(b,e,.5);
    expect(e.projectile).not.toHaveBeenCalled(); expect(b.x).toBeGreaterThan(1344);
    expect(b.navigation.searches).toBeGreaterThan(0);
  });
});
