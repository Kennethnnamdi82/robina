import type { ArenaSession } from '../core/session';

const GAME_KEYS = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyE','KeyR']);
export function isTextOrModalTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],dialog[open]'));
}

/** The only gameplay DOM keyboard/pointer router. Touch controls feed the same session buffer. */
export class InputManager {
  private removers: (() => void)[] = [];
  constructor(private session: ArenaSession, host: HTMLElement, private active: () => boolean) {
    const listen = (target: EventTarget, name: string, handler: EventListener) => { target.addEventListener(name, handler); this.removers.push(() => target.removeEventListener(name, handler)); };
    listen(window, 'keydown', this.keyDown as EventListener); listen(window, 'keyup', this.keyUp as EventListener);
    listen(host, 'pointermove', this.pointerMove as EventListener); listen(host, 'pointerdown', this.pointerDown as EventListener);
    listen(window, 'pointerup', this.pointerUp as EventListener); listen(window, 'pointercancel', this.pointerUp as EventListener);
    listen(document, 'focusin', this.focusIn as EventListener);
  }
  private keyDown = (event: KeyboardEvent) => {
    if (!this.active() || event.defaultPrevented) return;
    if (event.code === 'Escape' && !event.repeat && !document.querySelector('dialog[open]') && !(event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]'))) {
      event.preventDefault();
      if (this.session.getSnapshot().status === 'paused') this.session.resume(); else this.session.pause();
      return;
    }
    if (!GAME_KEYS.has(event.code)) return;
    if (!this.session.canControl() || isTextOrModalTarget(document.activeElement) || isTextOrModalTarget(event.target)) { this.session.clearInput(); return; }
    event.preventDefault(); this.session.input.keyDown(event.code, event.repeat);
  };
  private keyUp = (event: KeyboardEvent) => { this.session.input.keyUp(event.code); };
  private pointerMove = (event: PointerEvent) => {
    if (!this.active() || !this.session.canControl() || event.pointerType === 'touch' || isTextOrModalTarget(document.activeElement)) return;
    const input = this.session.input; input.mouseClientX = event.clientX; input.mouseClientY = event.clientY; input.mouseActive = true;
  };
  private pointerDown = (event: PointerEvent) => {
    if (this.active() && this.session.canControl() && event.pointerType !== 'touch' && event.button === 0) {
      if (event.target instanceof HTMLCanvasElement) event.target.focus();
      if (!isTextOrModalTarget(document.activeElement)) { this.pointerMove(event); this.session.input.setFire(true); }
    }
  };
  private pointerUp = (event: PointerEvent) => { if (event.pointerType !== 'touch') this.session.input.setFire(false); };
  private focusIn = (event: FocusEvent) => { if (isTextOrModalTarget(event.target)) this.session.clearInput(); };
  dispose() { this.removers.forEach(remove => remove()); this.removers.length = 0; this.session.clearInput(); }
}
