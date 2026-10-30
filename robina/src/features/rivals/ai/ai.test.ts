import { describe,expect,it,vi } from 'vitest';
import { EnemyController } from './EnemyController';
import { NavigationGrid,clearSight } from './navigation';
import { ENEMY_TYPES,type EnemySpawn,type EnemyState } from './definitions';
import type { Blocker } from '../combat/geometry';
const spawn: EnemySpawn = { id: 'test-guard',type: 'guard',x: 96,y: 96,angle: 0,patrol: [{ x: 96,y: 96 },{ x: 352,y: 96 }] };
const distant = { player: { x: 900,y: 900 },alive: true,permitted: true };
function tick(enemy: EnemyController,seconds: number,context = distant,shoot = vi.fn()) { for (let i = 0; i < seconds * 60; i++) enemy.step(1 / 60,context,shoot); return shoot; }
describe('enemy perception and navigation',() => {
  it('checks range, cone and solid occlusion while allowing investigation of heard combat',() => {
    const wall: Blocker = { id: 'wall',x: 160,y: 96,width: 20,height: 180,enabled: false };
    const nav = new NavigationGrid(12,12,64,[wall]), guard = new EnemyController(spawn,nav);
    expect(guard.sees({ x: 230,y: 96 })).toBe(true); expect(guard.sees({ x: 20,y: 96 })).toBe(false); expect(guard.sees({ x: 700,y: 96 })).toBe(false);
    wall.enabled = true; nav.rebuild(); expect(guard.sees({ x: 230,y: 96 })).toBe(false);
    guard.hear({ x: 230,y: 96 }); expect(guard.state).toBe('INVESTIGATE'); expect(guard.detection).toBe(0);
    expect(clearSight(guard,{ x: 230,y: 96 },[wall])).toBe(false);
  });
  it('finds a body-safe route around cover and rebuilds occupancy after a door opens',() => {
    const box: Blocker = { id: 'door',x: 320,y: 192,width: 64,height: 256,enabled: true };
    const nav = new NavigationGrid(10,10,64,[box]);
    const path = nav.path({ x: 96,y: 96 },{ x: 480,y: 96 });
    expect(path.length).toBeGreaterThan(4);
    let previous = { x: 96,y: 96 };
    for (const point of path) { expect(clearSight(previous,point,[box],18)).toBe(true); previous = point; }
    box.enabled = false; nav.rebuild(); expect(clearSight({ x: 96,y: 96 },{ x: 480,y: 96 },[box],18)).toBe(true);
  });
  it('patrols without per-frame path searches and recovers from blocked movement',() => {
    const nav = new NavigationGrid(16,16,64,[]), guard = new EnemyController(spawn,nav);
    tick(guard,3); expect(guard.x).toBeGreaterThan(110); expect(nav.searches).toBeLessThan(10);
    vi.spyOn(nav,'move').mockReturnValue(false); tick(guard,2); expect(guard.recoveries).toBeGreaterThan(0);
  });
});
describe('enemy state and combat lifecycle',() => {
  it('builds suspicion, chases into range, telegraphs and fires; pursuit permission prevents attacks',() => {
    const enemy = new EnemyController(spawn,new NavigationGrid(16,16,64,[])), seen = new Set<EnemyState>(), shoot = vi.fn();
    const context = { player: { x: 380,y: 96 },alive: true,permitted: true };
    for (let i = 0; i < 360; i++) { enemy.step(1 / 60,context,shoot); seen.add(enemy.state); }
    expect(seen.has('SUSPICIOUS')).toBe(true); expect(seen.has('CHASE')).toBe(true); expect(seen.has('ATTACK')).toBe(true); expect(shoot).toHaveBeenCalled();
    const denied = new EnemyController(spawn,new NavigationGrid(16,16,64,[])), blockedShot = vi.fn();
    tick(denied,5,{ ...context,permitted: false },blockedShot); expect(blockedShot).not.toHaveBeenCalled(); expect(denied.state).toBe('ALERT');
  });
  it('loses sight, searches the last known point and returns instead of tracking through a wall',() => {
    const nav = new NavigationGrid(16,16,64,[]), enemy = new EnemyController(spawn,nav), context = { player: { x: 250,y: 96 },alive: true,permitted: true };
    tick(enemy,2,context);
    const known = { ...enemy.lastKnown! };
    const hidden = { ...context,player: { x: 900,y: 800 } }, states = new Set<EnemyState>();
    for (let i = 0; i < 900; i++) { enemy.step(1 / 60,hidden,() => {}); states.add(enemy.state); }
    expect(known).toEqual(context.player); expect(states.has('INVESTIGATE')).toBe(true); expect(states.has('SEARCH')).toBe(true); expect(states.has('RETURN_TO_PATROL')).toBe(true); expect(enemy.lastKnown).toBeNull();
  });
  it('hearing after a long quiet patrol starts a fresh investigation, and alarms are consumed once',() => {
    const enemy = new EnemyController(spawn,new NavigationGrid(16,16,64,[])); tick(enemy,15);
    const point = { x: enemy.x + 80,y: enemy.y };
    enemy.alarm(1,point); tick(enemy,.2); expect(enemy.lastKnown).not.toBeNull();
    const known = enemy.lastKnown; enemy.alarm(1,{ x: 20,y: 20 }); expect(enemy.lastKnown).toBe(known);
  });
  it('receives a network incident beyond local hearing without acquiring player visibility',() => {
    const enemy = new EnemyController(spawn,new NavigationGrid(16,16,64,[])), point = { x: 700,y: 96 };
    enemy.hear(point); expect(enemy.lastKnown).toBeNull();
    enemy.alarm(1,point); expect(enemy.state).toBe('INVESTIGATE'); expect(enemy.lastKnown).toEqual(point); expect(enemy.detection).toBe(0);
    const outside = new EnemyController(spawn,new NavigationGrid(16,16,64,[])); outside.alarm(1,{ x: 1000,y: 1000 }); expect(outside.lastKnown).toBeNull();
  });
  it('handles hurt and stun, death once, no further attacks and fresh respawn state',() => {
    const nav = new NavigationGrid(16,16,64,[]), enemy = new EnemyController(spawn,nav), shoot = vi.fn();
    const event = { id: 'hit-1',sourceId: 'operative',team: 'operative' as const,amount: 20,angle: 0 };
    expect(enemy.damage(event)).toBe(20); expect(enemy.state).toBe('HURT'); tick(enemy,.3);
    enemy.stun(.5); tick(enemy,.2); expect(enemy.state).toBe('STUNNED'); expect(enemy.vx).toBe(0);
    tick(enemy,.5); expect(enemy.damage({ ...event,id: 'fatal',amount: 500 })).toBeGreaterThan(0);
    tick(enemy,3,{ player: { x: 200,y: 96 },alive: true,permitted: true },shoot);
    expect(enemy.state).toBe('DEAD'); expect(enemy.deaths).toBe(1); expect(shoot).not.toHaveBeenCalled(); expect(enemy.damage({ ...event,id: 'again' })).toBe(0);
    expect(new EnemyController(spawn,nav).health.current).toBe(ENEMY_TYPES.guard.health);
  });
  it('the enforcer backs away to firing distance and the heavy has a slower, stronger telegraph',() => {
    const nav = new NavigationGrid(24,24,64,[]), enemy = new EnemyController({ ...spawn,type: 'enforcer',x: 512,y: 512,patrol: [{ x: 512,y: 512 }] },nav);
    const player = { x: 600,y: 512 }, shoot = vi.fn();
    tick(enemy,5,{ player,alive: true,permitted: true },shoot);
    expect(Math.hypot(enemy.x - player.x,enemy.y - player.y)).toBeGreaterThan(ENEMY_TYPES.enforcer.minimumDistance - 20);
    expect(shoot).toHaveBeenCalled();
    expect(ENEMY_TYPES.heavy.speed).toBeLessThan(ENEMY_TYPES.guard.speed);
    expect(ENEMY_TYPES.heavy.damage).toBeGreaterThan(ENEMY_TYPES.guard.damage);
    expect(ENEMY_TYPES.heavy.windup).toBeGreaterThan(ENEMY_TYPES.guard.windup);
  });
  it('enforces pursuit distance even with uninterrupted sight and returns home before reacquiring',() => {
    const enemy = new EnemyController(spawn,new NavigationGrid(32,32,64,[])); let farthest = 0;
    for (let i = 0; i < 540; i++) {
      enemy.step(1 / 60,{ player: { x: enemy.x + 250,y: enemy.y },alive: true,permitted: true },() => {});
      farthest = Math.max(farthest,Math.hypot(enemy.x - spawn.x,enemy.y - spawn.y));
    }
    expect(farthest).toBeLessThan(enemy.config.pursuit + 20);
    expect(enemy.state).toBe('RETURN_TO_PATROL'); expect(enemy.lastKnown).toBeNull(); expect(enemy.detection).toBe(0);
  });
});
