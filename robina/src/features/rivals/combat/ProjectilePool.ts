import { segmentBox, segmentCircle, type Blocker } from './geometry';
import type { DamageEvent, Team } from './Health';

export interface Damageable {
  id: string; team: Team; x: number; y: number; radius: number;
  alive: () => boolean; damage: (event: DamageEvent) => number;
}
export interface Projectile {
  active: boolean; x: number; y: number; vx: number; vy: number;
  life: number; range: number; angle: number; damage: number; serial: number; owner: string; team: Team;
}
export interface Shot { x: number; y: number; angle: number; speed: number; lifetime: number; range: number; damage: number; owner: string; team: Team }

/** Fixed-size pool, continuous collision, nearest impact first. No physics body per shot. */
export class ProjectilePool {
  readonly entries: Projectile[];
  private serial = 0;
  constructor(readonly width: number, readonly height: number, capacity = 48) {
    this.entries = Array.from({ length: capacity }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, range: 0, angle: 0, damage: 0, serial: 0, owner: '', team: 'operative' }));
  }
  spawn(shot: Shot): boolean {
    if (![shot.x, shot.y, shot.angle, shot.speed, shot.lifetime, shot.range, shot.damage].every(Number.isFinite) || shot.speed <= 0 || shot.lifetime <= 0 || shot.range <= 0 || shot.damage <= 0) return false;
    const slot = this.entries.find(entry => !entry.active); if (!slot) return false;
    Object.assign(slot, shot, { active: true, vx: Math.cos(shot.angle) * shot.speed, vy: Math.sin(shot.angle) * shot.speed, life: shot.lifetime, serial: ++this.serial });
    return true;
  }
  step(dt: number, blockers: readonly Blocker[], targets: readonly Damageable[], impact: (shot: Projectile, damage: number, targetId: string | null) => void) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const shot of this.entries) {
      if (!shot.active) continue;
      const speed = Math.hypot(shot.vx, shot.vy), travel = Math.min(dt, shot.life, shot.range / speed);
      const dx = shot.vx * travel, dy = shot.vy * travel;
      let nearest = Infinity, target: Damageable | null = null;
      for (const box of blockers) {
        if (!box.enabled) continue;
        const t = segmentBox(shot.x, shot.y, dx, dy, box, 3);
        if (t < nearest) { nearest = t; target = null; }
      }
      for (const candidate of targets) {
        if (candidate.id === shot.owner || candidate.team === shot.team || !candidate.alive()) continue;
        const t = segmentCircle(shot.x, shot.y, dx, dy, candidate.x, candidate.y, candidate.radius + 3);
        if (t < nearest) { nearest = t; target = candidate; }
      }
      const fraction = Math.min(1, nearest); shot.x += dx * fraction; shot.y += dy * fraction;
      shot.life -= travel; shot.range -= speed * travel;
      if (nearest <= 1) {
        shot.active = false;
        const taken = target?.damage({ id: shot.owner + ':' + shot.serial, sourceId: shot.owner, team: shot.team, amount: shot.damage, angle: shot.angle }) ?? 0;
        impact(shot, taken, target?.id ?? null);
      } else if (shot.life <= .00001 || shot.range <= .00001 || shot.x < 0 || shot.y < 0 || shot.x > this.width || shot.y > this.height) shot.active = false;
    }
  }
  get activeCount() { let count = 0; for (const shot of this.entries) if (shot.active) count++; return count; }
  clear() { for (const shot of this.entries) shot.active = false; }
}
