export interface WeaponDefinition {
  id: string; name: string; damage: number; interval: number; automatic: boolean;
  speed: number; lifetime: number; range: number; spread: number;
  magazine: number; reloadSeconds: number; recoil: number; impact: string;
}
export const PULSE_CARBINE: WeaponDefinition = {
  id: 'aegis-pulse', name: 'PULSE CARBINE', damage: 25, interval: .16, automatic: true,
  speed: 900, lifetime: .85, range: 765, spread: 0,
  magazine: 12, reloadSeconds: 1.25, recoil: 3, impact: 'pulse-impact',
};

/** Simulation seconds, independent of wall time. No catch-up bursts after pause. */
export class WeaponController {
  ammo: number; cooldown = 0; reloadRemaining = 0; shots = 0;
  private held = false;
  constructor(readonly definition: WeaponDefinition = PULSE_CARBINE) { this.ammo = definition.magazine; }
  step(dt: number, fire: boolean, reload: boolean, allowed: boolean): boolean {
    if (!Number.isFinite(dt) || dt <= 0) return false;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadRemaining > 0) {
      this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
      if (this.reloadRemaining <= .00001) { this.reloadRemaining = 0; this.ammo = this.definition.magazine; }
    }
    if (allowed && reload && this.ammo < this.definition.magazine && !this.reloadRemaining) this.reloadRemaining = this.definition.reloadSeconds;
    const trigger = fire && (this.definition.automatic || !this.held); this.held = fire;
    if (!allowed || !trigger || this.cooldown > .00001 || this.reloadRemaining > 0) return false;
    if (this.ammo <= 0) { this.reloadRemaining = this.definition.reloadSeconds; return false; }
    this.ammo--; this.cooldown = this.definition.interval; this.shots++; return true;
  }
  cancelTrigger() { this.held = false; }
  shotAngle(base: number) {
    const seed = (Math.imul(this.shots, 1664525) + 1013904223) >>> 0;
    return base + (seed / 0xffffffff * 2 - 1) * this.definition.spread;
  }
}
