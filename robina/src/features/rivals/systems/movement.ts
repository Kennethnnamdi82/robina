import type { Facing, Vector } from '../core/contracts';

/** Analog magnitude is preserved; diagonals and combined inputs never exceed unit speed. */
export function movementVector(x: number, y: number, deadzone = 0.12): Vector {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const length = Math.hypot(x, y);
  if (length < deadzone) return { x: 0, y: 0 };
  const divisor = Math.max(1, length);
  return { x: x / divisor, y: y / divisor };
}

export function facingFor(vector: Vector, previous: Facing): Facing {
  if (!vector.x && !vector.y) return previous;
  return Math.abs(vector.x) > Math.abs(vector.y) ? (vector.x < 0 ? 'left' : 'right') : (vector.y < 0 ? 'up' : 'down');
}

export const DIRECTION_ROW: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 };
