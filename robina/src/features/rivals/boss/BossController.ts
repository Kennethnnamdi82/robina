import { Health, type DamageEvent } from '../combat/Health';
import { clearSight, type NavigationGrid, type Point } from '../ai/navigation';
import { VAULT_GUARDIAN, type BossAbility, type BossDefinition, type BossPhase, type BossState } from './definitions';

export interface BossEffects {
  projectile: (angle: number, damage: number, speed: number) => void;
  pulse: (point: Point, radius: number, damage: number, serial: number) => void;
  defeated: () => void;
}
export interface BossSnapshot {
  id: string; name: string; state: BossState; phase: BossPhase; health: number; maximum: number;
  x: number; y: number; angle: number; ability: BossAbility | null; remaining: number;
  shielded: boolean; vulnerable: boolean; deaths: number; attacks: Record<BossAbility, number>;
}
/** Fixed-step boss rules; no timers/listeners, bounded attacks and shared projectile simulation. */
export class BossController {
  readonly health: Health; state: BossState = 'DORMANT'; phase: BossPhase = 'A';
  x: number; y: number; angle = Math.PI / 2; remaining = 0; ability: BossAbility | null = null;
  target: Point = { x: 0, y: 0 }; deaths = 0; serial = 0; clock = 0;
  readonly attacks: Record<BossAbility, number> = { burst: 0, charge: 0, pulse: 0, reposition: 0 };
  private index = 0; private cooldowns = new Map<BossAbility, number>(); private fired = false;
  private staggerDamage = 0; private staggerCooldown = 0; private hurt = 0;
  private moveCooldown = 0; private path: Point[] = []; private pathIndex = 0;
  constructor(readonly navigation: NavigationGrid, readonly definition: BossDefinition = VAULT_GUARDIAN) {
    this.health = new Health(definition.health, 0); this.x = definition.spawn.x; this.y = definition.spawn.y;
  }
  get active() { return !['DORMANT', 'DEFEATED'].includes(this.state); }
  get shielded() { return this.state === 'WINDUP' && this.ability === 'charge'; }
  get vulnerable() { return ['RECOVERY', 'STAGGERED'].includes(this.state); }
  get flashing() { return this.hurt > 0; }
  activate(reducedMotion = false) {
    if (this.state !== 'DORMANT') return false;
    this.enter('INTRO', reducedMotion ? .15 : this.definition.intro); return true;
  }
  skipIntro() { if (this.state === 'INTRO') this.enter('READY', .8); }
  private enter(state: BossState, seconds: number) { this.state = state; this.remaining = seconds; }
  damage(event: DamageEvent) {
    if (!this.active || ['INTRO', 'TRANSITION'].includes(this.state)) return 0;
    const taken = this.health.damage({ ...event, amount: event.amount * (this.shielded ? .5 : 1) });
    if (!taken) return 0;
    this.hurt = .12; this.staggerDamage += taken;
    if (this.health.current <= 0) { this.enter('DEFEATED', 0); this.deaths = 1; return taken; }
    const ratio = this.health.current / this.health.maximum;
    const phase = ratio <= this.definition.thresholds.C ? 'C' : ratio <= this.definition.thresholds.B ? 'B' : 'A';
    if (phase !== this.phase) { this.phase = phase; this.index = 0; this.ability = null; this.staggerDamage = 0; this.enter('TRANSITION', .85); }
    else if (this.staggerDamage >= this.definition.stagger.damage && this.staggerCooldown <= 0) {
      this.staggerDamage = 0; this.staggerCooldown = this.definition.stagger.cooldown; this.ability = null; this.enter('STAGGERED', this.definition.stagger.seconds);
    }
    return taken;
  }
  private deathPublished = false;
  step(dt: number, player: Point, effects: BossEffects) {
    if (!Number.isFinite(dt) || dt <= 0 || this.state === 'DORMANT') return;
    if (this.state === 'DEFEATED') { if (!this.deathPublished) { this.deathPublished = true; effects.defeated(); } return; }
    this.clock += dt; this.health.step(dt); this.hurt = Math.max(0, this.hurt - dt); this.staggerCooldown -= dt;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.state === 'INTRO') { if (!this.remaining) this.skipIntro(); return; }
    const tuning = this.definition.phases[this.phase];
    if (this.state === 'TRANSITION' || this.state === 'STAGGERED' || this.state === 'RECOVERY') {
      if (!this.remaining) { this.ability = null; this.enter('READY', tuning.cadence); } return;
    }
    if (this.state === 'READY') {
      this.angle = Math.atan2(player.y - this.y, player.x - this.x);
      this.moveCooldown -= dt;
      const sight = clearSight(this, player, this.navigation.blockers);
      if (Math.hypot(this.x - player.x, this.y - player.y) > 230 || !sight) {
        if (this.moveCooldown <= 0) { this.moveCooldown = .8; this.path = this.navigation.path(this, player); this.pathIndex = 0; }
        const next = this.path[this.pathIndex];
        if (next) { const dx = next.x - this.x, dy = next.y - this.y, distance = Math.hypot(dx, dy); if (distance < 8) this.pathIndex++; else this.navigation.move(this, dx / distance * tuning.speed * dt, dy / distance * tuning.speed * dt); }
      }
      if (this.remaining || !sight || Math.hypot(this.x - player.x, this.y - player.y) > 480) return;
      for (let attempt = 0; attempt < tuning.pattern.length; attempt++) {
        const ability = tuning.pattern[this.index++ % tuning.pattern.length];
        if ((this.cooldowns.get(ability) ?? 0) > this.clock) continue;
        this.ability = ability; this.target = { ...player }; this.fired = false;
        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.enter('WINDUP', this.definition.abilities[ability].windup); return;
      }
      this.remaining = .15; return;
    }
    const ability = this.ability!; const config = this.definition.abilities[ability];
    if (this.state === 'WINDUP' && !this.remaining) this.enter('ACTIVE', config.active);
    if (this.state === 'ACTIVE') {
      if (!this.fired) {
        this.fired = true; this.serial++; this.attacks[ability]++; this.cooldowns.set(ability, this.clock + config.cooldown);
        if (ability === 'pulse') effects.pulse(this.target, config.radius, config.damage, this.serial);
        else if (ability !== 'reposition') {
          const count = config.count + (ability === 'burst' && this.phase !== 'A' ? 2 : 0);
          for (let i = 0; i < count; i++) effects.projectile(this.angle + (i - (count - 1) / 2) * config.spread, config.damage, config.speed);
        }
      }
      if (ability === 'reposition') this.navigation.move(this, Math.cos(this.angle) * config.speed * dt, Math.sin(this.angle) * config.speed * dt);
      if (!this.remaining) this.enter('RECOVERY', config.recovery);
    }
  }
  snapshot(): BossSnapshot { return { id: this.definition.id, name: this.definition.name, state: this.state, phase: this.phase, health: this.health.current, maximum: this.health.maximum, x: this.x, y: this.y, angle: this.angle, ability: this.ability, remaining: this.remaining, shielded: this.shielded, vulnerable: this.vulnerable, deaths: this.deaths, attacks: { ...this.attacks } }; }
}
