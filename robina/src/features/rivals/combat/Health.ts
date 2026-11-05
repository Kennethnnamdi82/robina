export type Team = 'operative' | 'security' | 'civilian';
export interface DamageEvent {
  id: string; sourceId: string; team: Team; amount: number; angle: number;
}

/** Local simulation only. Competitive rewards must validate commands on a server. */
export class Health {
  current: number;
  invulnerable = 0;
  private seen = new Set<string>();
  private history: string[] = [];
  constructor(readonly maximum = 100, readonly graceSeconds = .32) { this.current = maximum; }
  step(dt: number) { if (Number.isFinite(dt) && dt > 0) this.invulnerable = Math.max(0, this.invulnerable - dt); }
  damage(event: DamageEvent, immune = false): number {
    if (!Number.isFinite(event.amount) || event.amount <= 0 || !event.id || this.seen.has(event.id)) return 0;
    this.seen.add(event.id); this.history.push(event.id);
    if (this.history.length > 64) this.seen.delete(this.history.shift()!);
    if (immune || this.invulnerable > .00001 || this.current <= 0) return 0;
    const taken = Math.min(this.current, event.amount);
    this.current -= taken; this.invulnerable = this.graceSeconds;
    return taken;
  }
  heal(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0 || this.current <= 0) return 0;
    const gain = Math.min(this.maximum - this.current, amount); this.current += gain; return gain;
  }
}
