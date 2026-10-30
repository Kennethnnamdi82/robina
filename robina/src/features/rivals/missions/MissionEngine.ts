import type { HeistMissionDefinition, MissionMode, MissionSnapshot, MissionState } from './types';

const transitions: Record<MissionState, readonly MissionState[]> = {
  NOT_STARTED: ['PREPARING', 'ABANDONED'], PREPARING: ['ACTIVE', 'ABANDONED'],
  ACTIVE: ['SUCCESS', 'FAILED', 'ABANDONED'], SUCCESS: [], FAILED: [], ABANDONED: [],
};
/** Pure local mission rules. Events come from validated gameplay adapters, never account APIs. */
export class MissionEngine {
  state: MissionState = 'NOT_STARTED'; elapsed = 0; reason = ''; warning: number | null = null;
  readonly completed = new Set<string>();
  private evidence = new Set<string>(); private activated = new Map<string, number>();
  private warnings = new Set<number>();
  private stats = { enemiesDefeated: 0, damageTaken: 0, shots: 0, hits: 0, bossDefeated: false };
  constructor(readonly definition: HeistMissionDefinition, readonly runId: string, readonly mode: MissionMode = 'standard') {
    const ids = new Set(definition.objectives.map(o => o.id));
    if (ids.size !== definition.objectives.length || definition.objectives.some(o => o.prerequisites.some(p => !ids.has(p))) || definition.success.some(id => !ids.has(id))) throw new Error('Invalid mission objective references.');
    const visited = new Set<string>();
    while (visited.size < ids.size) {
      const ready = definition.objectives.filter(o => !visited.has(o.id) && o.prerequisites.every(p => visited.has(p)));
      if (!ready.length) throw new Error('Mission objectives contain a cycle.');
      ready.forEach(o => visited.add(o.id));
    }
  }
  transition(next: MissionState) {
    if (!transitions[this.state].includes(next)) return false;
    if (next === 'SUCCESS' && !this.definition.success.every(id => this.completed.has(id))) return false;
    this.state = next; if (next === 'ACTIVE') this.reconcile(); return true;
  }
  prepare(unlocks: ReadonlySet<string> = new Set()) { return this.definition.prerequisites.every(id => unlocks.has(id)) && this.transition('PREPARING'); }
  start() { return this.transition('ACTIVE'); }
  ready(id: string) { return this.completed.has(id) || this.definition.objectives.find(o => o.id === id)?.prerequisites.every(p => this.completed.has(p)) === true; }
  private reconcile() {
    let changed = true;
    while (changed) {
      changed = false;
      for (const o of this.definition.objectives) {
        if (this.completed.has(o.id) || !this.ready(o.id)) continue;
        if (!this.activated.has(o.id)) this.activated.set(o.id, this.elapsed);
        if (this.evidence.has(o.event)) { this.completed.add(o.id); changed = true; }
      }
    }
  }
  event(id: string) {
    if (this.state !== 'ACTIVE') return false;
    if (this.evidence.has(id)) return false;
    const objective = this.definition.objectives.find(o => o.event === id);
    if (!objective) return false;
    // Extraction is an action, not a latched fact. An early attempt can never finish later.
    if (id === 'extraction' && !this.ready(objective.id)) return false;
    this.evidence.add(id); this.reconcile();
    if (id === this.definition.boss.unlock) this.stats.bossDefeated = true;
    if (this.definition.success.every(key => this.completed.has(key))) this.transition('SUCCESS');
    return true;
  }
  damage(amount: number) { if (this.state === 'ACTIVE' && Number.isFinite(amount) && amount > 0) this.stats.damageTaken += amount; }
  sample(shots: number, hits: number, enemies: number) {
    if (this.state !== 'ACTIVE') return;
    this.stats.shots = shots; this.stats.hits = hits; this.stats.enemiesDefeated = enemies;
  }
  step(dt: number, paused = false) {
    if (this.state !== 'ACTIVE' || paused || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    const limit = this.definition.timer.seconds;
    if (limit !== null) {
      const remaining = Math.max(0, limit - this.elapsed);
      for (const threshold of this.definition.timer.warnings) if (remaining <= threshold && !this.warnings.has(threshold)) { this.warnings.add(threshold); this.warning = threshold; }
      if (remaining <= .00001) { this.elapsed = limit; this.fail('Mission timer expired.'); return; }
    }
    for (const o of this.definition.objectives) if (o.seconds && this.activated.has(o.id) && !this.completed.has(o.id) && this.elapsed - this.activated.get(o.id)! >= o.seconds) { this.fail('Objective timer expired: ' + o.title); return; }
  }
  fail(reason: string) { if (!this.transition('FAILED')) return false; this.reason = reason; return true; }
  abandon() { if (!this.transition('ABANDONED')) return false; this.reason = 'Insertion abandoned.'; return true; }
  snapshot(): MissionSnapshot {
    const objectives = this.definition.objectives.map(o => ({ ...o, state: this.completed.has(o.id) ? 'COMPLETED' as const : this.ready(o.id) ? 'ACTIVE' as const : 'LOCKED' as const, remaining: o.seconds && this.activated.has(o.id) ? Math.max(0, o.seconds - (this.elapsed - this.activated.get(o.id)!)) : null }));
    return { runId: this.runId, id: this.definition.id, name: this.definition.name, mode: this.mode, state: this.state, elapsed: this.elapsed,
      remaining: this.definition.timer.seconds === null ? null : Math.max(0, this.definition.timer.seconds - this.elapsed), warning: this.warning, reason: this.reason,
      objectives, activeId: objectives.find(o => !o.optional && o.state === 'ACTIVE')?.id ?? null,
      completed: objectives.filter(o => !o.optional && o.state === 'COMPLETED').length, mandatory: objectives.filter(o => !o.optional).length,
      stats: { ...this.stats }, practiceXP: this.state === 'SUCCESS' ? this.definition.rewards.practiceXP + objectives.filter(o => o.optional && o.state === 'COMPLETED').length * this.definition.rewards.optionalXP : 0 };
  }
}
