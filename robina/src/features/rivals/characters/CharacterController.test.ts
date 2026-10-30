import { describe, expect, it } from 'vitest';
import { CharacterController, MOVEMENT } from './CharacterController';
import { emptyCommand } from '../input/InputBuffer';

describe('fixed-step character controller', () => {
  it('normalizes diagonals, preserves analog magnitude, and accelerates to the configured speeds', () => {
    const axis = new CharacterController(), diagonal = new CharacterController(), analog = new CharacterController();
    for (let i = 0; i < 120; i++) {
      axis.step({ ...emptyCommand(), x: 1 }, 1 / 60);
      diagonal.step({ ...emptyCommand(), x: 1, y: 1 }, 1 / 60);
      analog.step({ ...emptyCommand(), x: .5 }, 1 / 60);
    }
    expect(Math.hypot(diagonal.vx, diagonal.vy)).toBeCloseTo(axis.vx, 5);
    expect(axis.vx).toBeCloseTo(MOVEMENT.walkSpeed, 4);
    expect(analog.vx).toBeCloseTo(MOVEMENT.walkSpeed / 2, 4);
    axis.step({ ...emptyCommand(), x: 1, sprint: true }, 1 / 60);
    expect(axis.vx).toBeGreaterThan(MOVEMENT.walkSpeed);
    for (let i = 0; i < 60; i++) axis.step({ ...emptyCommand(), x: 1, sprint: true }, 1 / 60);
    expect(axis.vx).toBeCloseTo(MOVEMENT.walkSpeed * MOVEMENT.sprintMultiplier, 3);
    expect(axis.animations.state).toBe('run');
  });
  it('uses time-based acceleration and deceleration rather than render-frame counts', () => {
    const fast = new CharacterController(), slow = new CharacterController(), input = { ...emptyCommand(), y: 1 };
    for (let i = 0; i < 60; i++) fast.step(input, 1 / 60);
    for (let i = 0; i < 30; i++) slow.step(input, 1 / 30);
    expect(slow.vy).toBeCloseTo(fast.vy, 5);
    for (let i = 0; i < 30; i++) fast.step(emptyCommand(), 1 / 60);
    expect(fast.vy).toBe(0); expect(fast.animations.state).toBe('idle');
  });
  it('dodge travels in the chosen direction, cannot retrigger during cooldown, and expires', () => {
    const player = new CharacterController();
    player.step({ ...emptyCommand(), x: 1, y: 1, dodge: true }, 1 / 60);
    expect(Math.hypot(player.vx, player.vy)).toBeCloseTo(MOVEMENT.dodgeSpeed);
    expect(player.animations.state).toBe('dash'); expect(player.dodgeSerial).toBe(1);
    for (let i = 0; i < 30; i++) player.step({ ...emptyCommand(), dodge: true }, 1 / 60);
    expect(player.dodgeSerial).toBe(1); expect(player.dodgeRemaining).toBe(0);
    for (let i = 0; i < 45; i++) player.step(emptyCommand(), 1 / 60);
    player.step({ ...emptyCommand(), dodge: true }, 1 / 60);
    expect(player.dodgeSerial).toBe(2);
  });
  it('aiming remains independent of travel, interaction is transient, and unarmed fire creates no attack', () => {
    const player = new CharacterController();
    player.step({ ...emptyCommand(), y: -1, aiming: true, aimX: 1, aimY: 0, fire: true }, 1 / 60);
    expect(player.vy).toBeLessThan(0); expect(player.facing).toBe('right'); expect(player.aimAngle).toBe(0);
    expect(player.animations.state).toBe('walk');
    expect(player.step({ ...emptyCommand(), interact: true }, 1 / 60)).toBe(true);
    player.interacted(); player.step(emptyCommand(), 1 / 60); expect(player.animations.state).toBe('interact');
    for (let i = 0; i < 30; i++) player.step({ ...emptyCommand(), aiming: true, aimX: 0, aimY: -1 }, 1 / 60);
    expect(player.animations.state).toBe('aim'); expect(player.facing).toBe('up');
  });
  it('damage is bounded, hurt resolves, death is terminal, and stopping cancels residual dodge motion', () => {
    const player = new CharacterController();
    expect(player.damage(-4)).toBe(0); expect(player.damage(NaN)).toBe(0);
    player.damage(25); expect(player.health).toBe(75);
    player.step({ ...emptyCommand(), x: 1 }, 1 / 60); expect(player.animations.state).toBe('hurt'); expect(player.vx).toBe(0);
    for (let i = 0; i < 30; i++) player.step(emptyCommand(), 1 / 60);
    expect(player.animations.state).toBe('idle');
    player.step({ ...emptyCommand(), dodge: true }, 1 / 60); player.stop();
    expect(player.vx).toBe(0); expect(player.dodgeRemaining).toBe(0);
    expect(player.damage(500)).toBe(75);
    for (let i = 0; i < 60; i++) player.step({ ...emptyCommand(), x: 1, dodge: true, fire: true }, 1 / 60);
    expect(player.health).toBe(0); expect(player.vx).toBe(0); expect(player.vy).toBe(0); expect(player.animations.state).toBe('defeat');
  });
});
