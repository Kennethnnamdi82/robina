import { describe, expect, it } from 'vitest';
import { floorFrame, isWall, OPERATIVE, TRAINING_VAULT as level } from './trainingVault';

describe('training vault navigation', () => {
  it('has a fully enclosed boundary and a safe spawn', () => {
    for (let x = 0; x < level.width; x++) { expect(isWall(x, 0)).toBe(true); expect(isWall(x, level.height - 1)).toBe(true); }
    for (let y = 0; y < level.height; y++) { expect(isWall(0, y)).toBe(true); expect(isWall(level.width - 1, y)).toBe(true); }
    expect(isWall(Math.floor(level.spawn.x / 64), Math.floor(level.spawn.y / 64))).toBe(false);
    expect(OPERATIVE.radius * 2).toBeLessThan(level.tileSize);
  });

  it('connects every floor tile to insertion with body-width passages', () => {
    const visited = new Set<string>(), queue = [[4, 4]];
    while (queue.length) {
      const [x, y] = queue.shift()!, key = `${x}:${y}`;
      if (visited.has(key) || isWall(x, y)) continue;
      visited.add(key);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    let floors = 0;
    for (let y = 0; y < level.height; y++) for (let x = 0; x < level.width; x++) {
      if (!isWall(x, y)) floors++;
      expect(floorFrame(x, y)).toBeGreaterThanOrEqual(0);
      expect(floorFrame(x, y)).toBeLessThan(16);
    }
    expect(visited.size).toBe(floors);
  });
});
