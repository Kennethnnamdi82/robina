import type { AnimationState } from '../core/presentation';

export interface AnimationIntent { alive: boolean; hurt: boolean; dashing: boolean; interacting: boolean; moving: boolean; running: boolean; aiming: boolean; attacking: boolean }
/** Transient states have explicit priority. Death is terminal until a new controller is created. */
export class AnimationStateMachine {
  state: AnimationState = 'idle';
  resolve(intent: AnimationIntent): AnimationState {
    if (this.state === 'defeat' || !intent.alive) return this.state = 'defeat';
    return this.state = intent.hurt ? 'hurt' : intent.dashing ? 'dash' : intent.interacting ? 'interact' : intent.attacking ? 'attack' : intent.moving ? intent.running ? 'run' : 'walk' : intent.aiming ? 'aim' : 'idle';
  }
}
