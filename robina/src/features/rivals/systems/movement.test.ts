import { describe, expect, it } from 'vitest';
import { facingFor, movementVector } from './movement';

describe('movement input', () => {
  it('prevents keyboard diagonals and combined touch input from moving faster', () => {
    for (const [x, y] of [[1, 1], [2, 1], [-1, -2]]) {
      const vector = movementVector(x, y);
      expect(Math.hypot(vector.x, vector.y)).toBeCloseTo(1);
    }
  });
  it('preserves analog speed, removes stick noise, and rejects nonfinite input', () => {
    expect(movementVector(0.4, 0).x).toBe(0.4);
    expect(movementVector(0.02, -0.01)).toEqual({ x: 0, y: 0 });
    expect(movementVector(Infinity, 0)).toEqual({ x: 0, y: 0 });
  });
  it('keeps idle facing and chooses the matching animation row', () => {
    expect(facingFor({ x: 0, y: 0 }, 'up')).toBe('up');
    expect(facingFor({ x: -1, y: 0.5 }, 'down')).toBe('left');
    expect(facingFor({ x: 0.2, y: -1 }, 'down')).toBe('up');
  });
});
