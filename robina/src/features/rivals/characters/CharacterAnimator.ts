import type Phaser from 'phaser';
import type { AnimationState, CharacterId } from '../core/presentation';
import type { Facing } from '../core/contracts';
import { ANIMATION_STATES, animationPlan, FACINGS } from './definitions';

/** Pure presentation: the physical foot collider never breathes, scales or changes frame. */
export class CharacterAnimator {
  private current = '';
  private keys: string[] = [];
  private manager: Phaser.Animations.AnimationManager;
  constructor(private sprite: Phaser.GameObjects.Sprite, private character: CharacterId) {
    const manager = sprite.scene.anims;
    this.manager = manager;
    for (const state of ANIMATION_STATES) for (const facing of FACINGS) {
      const key = `${character}/${state}/${facing}`, plan = animationPlan(state, facing);
      if (!manager.exists(key)) manager.create({ key, frames: plan.frameNames.map(frame => ({ key: 'rv-character', frame })), frameRate: plan.frameRate, repeat: plan.repeat });
      this.keys.push(key);
    }
  }

  update(state: AnimationState, facing: Facing, elapsed: number, reducedMotion: boolean) {
    const key = `${this.character}/${state}/${facing}`;
    if (key !== this.current) { this.sprite.play(key); this.current = key; }
    const breath = state === 'idle' && !reducedMotion ? Math.sin(elapsed * 2.2) * .006 : 0;
    this.sprite.setScale(2 / 3, (2 / 3) * (1 + breath));
  }

  dispose() { if (this.sprite.scene && this.sprite.anims) this.sprite.stop(); this.keys.forEach(key => { if (this.manager.exists(key)) this.manager.remove(key); }); this.keys.length = 0; }
}
