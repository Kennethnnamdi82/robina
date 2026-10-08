export class GameInput {
  keys = new Set<string>(); pressed = new Set<string>();
  fire = false; firePressed = false; aim = false; locked = false; mouseX = 0; mouseY = 0;
  private abort = new AbortController();
  constructor(private canvas: HTMLCanvasElement, private onPause: () => void) {
    const options = { signal: this.abort.signal };
    window.addEventListener('keydown', event => {
      if (!this.locked) return;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code); this.keys.add(event.code);
    }, options);
    window.addEventListener('keyup', event => this.keys.delete(event.code), options);
    window.addEventListener('mousemove', event => { if (this.locked) { this.mouseX += event.movementX; this.mouseY += event.movementY; } }, options);
    window.addEventListener('mousedown', event => {
      if (!this.locked) return;
      if (event.button === 0) { this.fire = true; this.firePressed = true; } if (event.button === 2) this.aim = true;
    }, options);
    window.addEventListener('mouseup', event => { if (event.button === 0) this.fire = false; if (event.button === 2) this.aim = false; }, options);
    canvas.addEventListener('contextmenu', event => event.preventDefault(), options);
    document.addEventListener('pointerlockchange', () => {
      const wasLocked = this.locked; this.locked = document.pointerLockElement === canvas;
      if (wasLocked && !this.locked) { this.clear(); this.onPause(); }
    }, options);
    window.addEventListener('blur', () => { this.clear(); if (this.locked) this.onPause(); }, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); this.onPause(); } }, options);
  }
  async lock() { await this.canvas.requestPointerLock(); }
  clear() { this.keys.clear(); this.pressed.clear(); this.fire = false; this.firePressed = false; this.aim = false; this.mouseX = this.mouseY = 0; }
  consume(code: string) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  release() { this.clear(); if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }
  dispose() { this.abort.abort(); this.release(); }
}
