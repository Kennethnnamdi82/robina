import { describe, expect, it } from 'vitest';
import { THE_LAUNCH, solidTile } from './level';
import { WorldState } from './WorldState';

const object = (id: string) => THE_LAUNCH.objects.find(o => o.id === id)!;
describe('The Launch level and interactions', () => {
  it('has an enclosed world, safe spawn and a navigable route to each interaction', () => {
    const world = new WorldState(), tile = 64, visited = new Set<string>(), queue = [{ x: 4, y: 4 }];
    // Treat doors as operable for navigation. All solid art footprints remain blocking.
    const blocked = (x: number, y: number) => solidTile(THE_LAUNCH, x, y) || world.blockers.some(b => !b.id.startsWith('wall') && !b.id.includes('door') && b.id !== 'vault-gate' && Math.abs(x * tile + 32 - b.x) < b.width / 2 + 14 && Math.abs(y * tile + 32 - b.y) < b.height / 2 + 14);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i], key = p.x + ':' + p.y;
      if (visited.has(key) || blocked(p.x, p.y)) continue; visited.add(key);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if (p.x + dx >= 0 && p.y + dy >= 0 && p.x + dx < 28 && p.y + dy < 22) queue.push({ x: p.x + dx, y: p.y + dy });
    }
    expect(visited.has('4:4')).toBe(true);
    for (const item of THE_LAUNCH.objects) expect([...visited].some(key => { const [x,y] = key.split(':').map(Number); return Math.hypot(x * tile + 32 - item.x, y * tile + 32 - item.y) < item.range; }), item.id).toBe(true);
    for (let x = 0; x < 28; x++) { expect(solidTile(THE_LAUNCH,x,0)).toBe(true); expect(solidTile(THE_LAUNCH,x,21)).toBe(true); }
  });
  it('checks distance, line of sight, locked requirements and occupied door closure', () => {
    const world = new WorldState(), door = object('transit-door'), gate = object('vault-gate');
    expect(world.interact(door, { x: 288, y: 288 })).toBeNull();
    expect(world.interact(gate, { x: 1088, y: 560 })).toBeNull();
    expect(world.interact(door, { x: 576, y: 576 })?.active).toBe(true);
    expect(world.blockers.find(b => b.id === door.id)?.enabled).toBe(false);
    expect(world.interact(door, { x: 672, y: 576 })).toBeNull();
    expect(world.interact(door, { x: 768, y: 576 })?.active).toBe(false);
    expect(world.blockers.find(b => b.id === door.id)?.enabled).toBe(true);
    // An arbitrary object behind the divider is not reachable through a wall.
    expect(world.reachable({ ...door, x: 720, y: 400, range: 200 }, { x: 600, y: 400 })).toBe(false);
  });
  it('requires real access, core collection and extraction interactions, and resets per run', () => {
    const world = new WorldState();
    expect(world.interact(object('extraction'), { x: 288, y: 1100 })).toBeNull();
    expect(world.interact(object('training-core'), { x: 1536, y: 360 })).toBeNull();
    // Security puzzle validation has its own integration tests; provide its grants here.
    world.authorizeHack('sector-console'); world.grantFlag('timed-access');
    world.grantFlag('guardian-defeated');
    expect(world.interact(object('sector-console'), { x: 1056, y: 730 })).not.toBeNull();
    world.interact(object('relay-a'),{ x: 1184,y: 320 }); world.interact(object('relay-b'),{ x: 1504,y: 384 });
    expect(world.interact(object('vault-gate'), { x: 1088, y: 560 })).not.toBeNull();
    expect(world.interact(object('vault'), { x: 1536, y: 272 })).not.toBeNull();
    expect(world.interact(object('training-core'), { x: 1536, y: 360 })).not.toBeNull();
    expect(world.interact(object('training-core'), { x: 1536, y: 360 })).toBeNull();
    expect(world.interact(object('extraction'), { x: 288, y: 1100 })).not.toBeNull(); expect(world.extracted).toBe(true);
    const fresh = new WorldState(); expect(fresh.active.size).toBe(0); expect(fresh.extracted).toBe(false);
  });
  it('does not consume a med charge at full health and consumes it once when injured', () => {
    const world = new WorldState(), med = object('med-station'), actor = { x: 288, y: 750 };
    expect(world.interact(med, actor, 100)).toBeNull(); expect(world.interact(med, actor, 75)).not.toBeNull(); expect(world.interact(med, actor, 50)).toBeNull();
  });
});
