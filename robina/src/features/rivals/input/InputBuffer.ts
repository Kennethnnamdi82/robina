export interface PlayerCommand {
  x: number; y: number; aimX: number; aimY: number; aiming: boolean;
  sprint: boolean; dodge: boolean; interact: boolean; fire: boolean; reload: boolean;
}
export const emptyCommand = (): PlayerCommand => ({ x: 0, y: 0, aimX: 0, aimY: 1, aiming: false, sprint: false, dodge: false, interact: false, fire: false, reload: false });

/** Shared keyboard, mouse and touch intent. One-shot actions survive slow frames. */
export class InputBuffer {
  private keys = new Set<string>();
  private touchX = 0; private touchY = 0;
  private aimX = 0; private aimY = 0;
  private mouseX = 0; private mouseY = 1;
  mouseClientX = 0; mouseClientY = 0; mouseActive = false;
  private dodge = false; private interaction = false; private fireEdge = false; private reload = false;
  private fireHeld = false;
  mobileSprint = false;
  aimShoots = false;
  get touchMoving() { return Math.hypot(this.touchX,this.touchY) >= .12; }
  get keyboardMoving() { return ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(key => this.keys.has(key)); }
  get touchAiming() { return Math.hypot(this.aimX, this.aimY) >= .12; }
  get touchAimX() { return this.aimX; }
  get touchAimY() { return this.aimY; }
  keyDown(code: string, repeat = false) {
    if (!repeat && !this.keys.has(code)) {
      if (code === 'Space') this.queueDodge();
      if (code === 'KeyE') this.queueInteract();
      if (code === 'KeyR') this.queueReload();
    }
    this.keys.add(code);
  }
  keyUp(code: string) { this.keys.delete(code); }
  setMovement(x: number, y: number) { this.touchX = Number.isFinite(x) ? x : 0; this.touchY = Number.isFinite(y) ? y : 0; }
  setAim(x: number, y: number) { this.aimX = Number.isFinite(x) ? x : 0; this.aimY = Number.isFinite(y) ? y : 0; }
  setMouseAim(x: number, y: number) { this.mouseX = x; this.mouseY = y; }
  setFire(held: boolean) { if (held && !this.fireHeld) this.fireEdge = true; this.fireHeld = held; }
  queueDodge() { this.dodge = true; }
  queueInteract() { this.interaction = true; }
  queueReload() { this.reload = true; }
  read(out: PlayerCommand): PlayerCommand {
    const keys = this.keys;
    let x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + this.touchX;
    let y = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) + this.touchY;
    const length = Math.hypot(x, y);
    if (length < .12) { x = 0; y = 0; }
    const divisor = Math.max(1, length);
    out.x = x / divisor; out.y = y / divisor;
    const touchAim = this.touchAiming;
    const ax = touchAim ? this.aimX : this.mouseX, ay = touchAim ? this.aimY : this.mouseY;
    const aimLength = Math.hypot(ax, ay);
    out.aiming = (touchAim || this.mouseActive) && aimLength > .01;
    out.aimX = out.aiming ? ax / aimLength : 0; out.aimY = out.aiming ? ay / aimLength : 1;
    out.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || this.mobileSprint;
    out.dodge = this.dodge; out.interact = this.interaction; out.fire = this.fireHeld || this.fireEdge || (this.aimShoots && touchAim); out.reload = this.reload;
    this.dodge = false; this.interaction = false; this.fireEdge = false; this.reload = false;
    return out;
  }
  clearTouch() { this.touchX = 0; this.touchY = 0; this.aimX = 0; this.aimY = 0; this.mobileSprint = false; this.fireHeld = false; this.fireEdge = false; }
  reset() { this.keys.clear(); this.clearTouch(); this.dodge = false; this.interaction = false; this.reload = false; this.mouseActive = false; }
}
