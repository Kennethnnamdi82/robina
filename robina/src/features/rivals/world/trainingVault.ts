import type { CharacterDefinition } from '../core/contracts';
import { THE_LAUNCH, solidTile } from './level';

export const OPERATIVE: CharacterDefinition = {
  id: 'vex', name: 'VEX', speed: 235, radius: 14,
  animation: { idleFrames: 4, walkFrames: 6, frameSize: 96 },
};

/** Compatibility name; the renderer, minimap and tests share the same level definition. */
export const TRAINING_VAULT = THE_LAUNCH;

/** Independent collision layer; the supplied atlas contains art, not collision semantics. */
export function isWall(x: number, y: number): boolean {
  return solidTile(THE_LAUNCH, x, y);
}

export function floorFrame(x: number, y: number): number {
  if (isWall(x, y)) return 3;
  if (x >= 21 && y <= 4) return 12 + x % 4;
  if (x % 9 === 0 || y === 10) return 8 + (x + y) % 4;
  return (x >= 11 && y <= 7 ? 4 : 0) + ((x * 7 + y * 11) % 4);
}
