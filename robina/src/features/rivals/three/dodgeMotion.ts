import { MOVEMENT } from '../characters/CharacterController';

// Integral of a smooth trapezoid: 20% accelerate, 60% coast, 20% brake.
// Unit area preserves the existing dodge distance, duration and cooldown.
function integral(phase: number): number {
  const p = Math.max(0, Math.min(1, phase));
  if (p > .8) return 1 - integral(1 - p);
  if (p >= .2) return (p - .1) / .8;
  const u = p / .2;
  return .2 * (u * u * u - .5 * u * u * u * u) / .8;
}
export function dodgeMotionScale(remaining: number, dt: number): number {
  if (remaining <= 0 || dt <= 0) return 1;
  const start = 1 - remaining / MOVEMENT.dodgeDuration;
  return (integral(start + dt / MOVEMENT.dodgeDuration) - integral(start)) * MOVEMENT.dodgeDuration / dt;
}
