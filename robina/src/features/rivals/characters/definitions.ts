import type { Facing } from '../core/contracts';
import type { AnimationState, CharacterId } from '../core/presentation';

export const CHARACTERS = {
  vex: { name: 'VEX', role: 'Shadow runner', color: '#9b7bed', light: 0x8b66ff },
  nyx: { name: 'NYX', role: 'Spectre', color: '#ec8bbd', light: 0xe76fae },
  rook: { name: 'ROOK', role: 'Vanguard', color: '#e9ba62', light: 0xffb95b },
} as const satisfies Record<CharacterId, { name: string; role: string; color: string; light: number }>;

export const ANIMATION_STATES: AnimationState[] = ['idle', 'walk', 'run', 'dash', 'attack', 'hurt', 'defeat'];
export const FACINGS: Facing[] = ['down', 'left', 'right', 'up'];

/** Authored locomotion is distinct from explicit fallbacks; no combat behavior is implied. */
export function animationPlan(state: AnimationState, facing: Facing) {
  const looping = state === 'walk' || state === 'run' || state === 'dash';
  const frameNumbers = looping ? [0, 1, 2, 3, 4, 5] : [2];
  return {
    frameNames: frameNumbers.map(frame => `walk/${facing}/${frame}`),
    frameRate: state === 'run' ? 15 : state === 'dash' ? 20 : 10,
    repeat: looping ? -1 : 0,
    authored: state === 'walk',
    fallback: state === 'walk' ? null : state === 'run' || state === 'dash' ? 'walk-at-speed' : 'stationary-pose',
  };
}
