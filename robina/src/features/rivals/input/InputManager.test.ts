import { describe, expect, it } from 'vitest';
import { InputBuffer, emptyCommand } from './InputBuffer';
import { InputManager } from './InputManager';
import { ArenaSession } from '../core/session';

describe('central gameplay input', () => {
  it('prioritizes touch aiming on hybrid devices and hands back to mouse aiming cleanly', () => {
    const input = new InputBuffer(), out = emptyCommand();
    input.mouseActive = true; input.setMouseAim(1, 0); input.setAim(-1, 0);
    input.read(out); expect(out.aiming).toBe(true); expect(out.aimX).toBe(-1); expect(input.touchAiming).toBe(true);
    input.setAim(0, 0); input.read(out); expect(out.aimX).toBe(1); expect(input.touchAiming).toBe(false);
    input.reset(); input.read(out); expect(out.aiming).toBe(false);
  });
  it('buffers short actions, ignores held-key repeats, and bounds combined analog/keyboard movement', () => {
    const input = new InputBuffer(), out = emptyCommand();
    input.keyDown('Space'); input.keyUp('Space'); input.keyDown('KeyE'); input.keyUp('KeyE');
    input.keyDown('KeyD'); input.keyDown('KeyS'); input.setMovement(1, 1);
    input.read(out); expect(out.dodge).toBe(true); expect(out.interact).toBe(true); expect(Math.hypot(out.x, out.y)).toBeCloseTo(1);
    input.read(out); expect(out.dodge).toBe(false); expect(out.interact).toBe(false);
    input.keyDown('Space', true); input.read(out); expect(out.dodge).toBe(false);
    input.reset(); input.read(out); expect(out.x).toBe(0); expect(out.y).toBe(0);
  });
  it('routes each action once and detaches its listeners on disposal', () => {
    const session = new ArenaSession(); session.update({ status: 'playing' });
    const host = document.createElement('div'), manager = new InputManager(session, host, () => true), command = emptyCommand();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    session.input.read(command); expect(command.x).toBe(1);
    manager.dispose();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    session.input.read(command); expect(command.x).toBe(0);
    const next = new InputManager(session, host, () => true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    session.input.read(command); expect(command.dodge).toBe(true);
    session.input.read(command); expect(command.dodge).toBe(false); next.dispose();
  });
  it('blocks gameplay while typing or a modal has focus and clears held movement', () => {
    const session = new ArenaSession(); session.update({ status: 'playing' });
    const host = document.createElement('div'), manager = new InputManager(session, host, () => true), command = emptyCommand();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    const input = document.createElement('input'); document.body.append(input); input.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    session.input.read(command); expect(command.x).toBe(0); expect(command.y).toBe(0);
    input.remove(); manager.dispose();
  });
});
