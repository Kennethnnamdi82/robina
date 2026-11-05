import { Health, type DamageEvent } from '../combat/Health';
import { clearSight, NavigationGrid, type Point } from './navigation';
import { AI_RULES, ENEMY_TYPES, type EnemySpawn, type EnemyState, type EnemyConfig } from './definitions';
export interface Perception { player: Point; alive: boolean; permitted: boolean; near?: boolean }
export class EnemyController implements Point {
  readonly config; readonly health: Health; readonly home: Point;
  x: number; y: number; angle: number; state: EnemyState = 'IDLE'; detection = 0; lastKnown: Point | null = null;
  path: Point[] = []; pathIndex = 0; patrolIndex = 0; vx = 0; vy = 0;
  shots = 0; deaths = 0; recoveries = 0; stateAge = 0; windup = 0; hurt = 0;
  private decision = 0; private repath = 0; private cooldown = 1; private unseen = 0; private stuck = 0; private alarmSeen = 0;
  private goal: Point | null = null; private lastX: number; private lastY: number;
  private returningHome = false;
  constructor(readonly spawn: EnemySpawn, private navigation: NavigationGrid, stagger = 0,profile?:Partial<EnemyConfig>) {
    this.config = profile?{...ENEMY_TYPES[spawn.type],...profile}:ENEMY_TYPES[spawn.type]; this.health = new Health(this.config.health, .12);
    this.x = this.lastX = spawn.x; this.y = this.lastY = spawn.y; this.angle = spawn.angle; this.home = { x: spawn.x, y: spawn.y }; this.decision = stagger;
  }
  get alive() { return this.health.current > 0; }
  private transition(state: EnemyState) {
    if (this.state === 'DEAD' || state === this.state) return;
    this.state = state; this.stateAge = 0;
    // A cached pursuit path must not outlive a return/search/hurt transition.
    this.repath = 0; this.path.length = 0; this.pathIndex = 0;
    if (state !== 'ATTACK') this.windup = 0;
  }
  sees(player: Point) {
    const dx = player.x - this.x, dy = player.y - this.y;
    const angle = Math.atan2(dy, dx), difference = Math.atan2(Math.sin(angle - this.angle), Math.cos(angle - this.angle));
    return dx * dx + dy * dy <= this.config.vision ** 2 && Math.abs(difference) <= this.config.cone && clearSight(this, player, this.navigation.blockers);
  }
  private investigate(point: Point) { if (this.alive && !this.returningHome && !['CHASE','ATTACK','ALERT'].includes(this.state)) { this.lastKnown = { ...point }; this.unseen = 0; this.transition('INVESTIGATE'); this.repath = 0; } }
  hear(point: Point) { if (Math.hypot(point.x - this.x, point.y - this.y) < this.config.hearing) this.investigate(point); }
  // Network notifications carry an incident location, not direct player visibility.
  alarm(serial: number, point: Point) { if (serial <= this.alarmSeen) return; this.alarmSeen = serial; if (Math.hypot(point.x - this.x,point.y - this.y) < this.config.alertRange) this.investigate(point); }
  damage(event: DamageEvent) {
    const taken = this.health.damage(event); if (!taken) return 0;
    if (!this.alive) { this.transition('DEAD'); this.deaths++; this.vx = this.vy = 0; this.path.length = 0; }
    else { this.hurt = AI_RULES.stunSeconds; this.unseen = 0; this.lastKnown = { x: this.x - Math.cos(event.angle) * 100, y: this.y - Math.sin(event.angle) * 100 }; this.transition('HURT'); }
    return taken;
  }
  stun(seconds: number) { if (this.alive && Number.isFinite(seconds) && seconds > 0) { this.hurt = Math.min(3, seconds); this.transition('STUNNED'); } }
  step(dt: number, context: Perception, shoot: (enemy: EnemyController, angle: number) => void) {
    this.stateAge += dt; this.health.step(dt); this.cooldown = Math.max(0, this.cooldown - dt); this.repath -= dt; this.decision -= dt;
    this.vx = this.vy = 0; if (!this.alive) return;
    if (!context.alive) { this.lastKnown = null; this.transition('RETURN_TO_PATROL'); }
    if (this.hurt > 0) { this.hurt = Math.max(0, this.hurt - dt); if (this.hurt > 0) return; this.transition('INVESTIGATE'); }
    if (this.decision <= 0) { this.decision = context.near === false && ['IDLE','PATROL'].includes(this.state) ? .5 : AI_RULES.decisionSeconds; this.decide(context); }
    if (this.state === 'ATTACK') {
      this.angle = Math.atan2(context.player.y - this.y, context.player.x - this.x);
      if (!context.alive || !context.permitted || !clearSight(this, context.player, this.navigation.blockers)) { this.transition('CHASE'); return; }
      if (this.cooldown <= 0) {
        this.windup += dt;
        if (this.windup >= this.config.windup) {
          const spread = Math.sin((this.shots + 1) * 2.399) * this.config.accuracy;
          shoot(this, this.angle + spread); this.shots++; this.cooldown = this.config.interval; this.windup = 0;
        }
      }
      return;
    }
    if (!this.goal) return;
    if (this.repath <= 0) {
      this.repath = AI_RULES.repathSeconds;
      this.path = clearSight(this, this.goal, this.navigation.blockers, this.navigation.radius) ? [{ ...this.goal }] : this.navigation.path(this, this.goal); this.pathIndex = 0;
    }
    const target = this.path[this.pathIndex];
    if (!target) {
      if (this.goal && Math.hypot(this.goal.x - this.x,this.goal.y - this.y) > 40) {
        this.stuck += dt;
        if (this.stuck > .8) { this.stuck = 0; this.recoveries++; this.lastKnown = null; this.repath = 0; this.transition('RETURN_TO_PATROL'); }
      }
      return;
    }
    const dx = target.x - this.x, dy = target.y - this.y, distance = Math.hypot(dx, dy);
    if (distance < 8) { this.pathIndex++; return; }
    const travel = Math.min(distance, this.config.speed * dt), nx = dx / distance, ny = dy / distance;
    this.angle = this.state === 'CHASE' && this.lastKnown ? Math.atan2(this.lastKnown.y - this.y,this.lastKnown.x - this.x) : Math.atan2(ny, nx);
    this.navigation.move(this, nx * travel, ny * travel); this.vx = nx * this.config.speed; this.vy = ny * this.config.speed;
    if (Math.hypot(this.x - this.lastX, this.y - this.lastY) < .05) this.stuck += dt; else this.stuck = 0;
    this.lastX = this.x; this.lastY = this.y;
    if (this.stuck > .7) { this.stuck = 0; this.repath = 0; this.recoveries++; this.patrolIndex = (this.patrolIndex + 1) % this.spawn.patrol.length; this.transition('RETURN_TO_PATROL'); this.goal = this.spawn.patrol[this.patrolIndex]; }
  }
  private decide(context: Perception) {
    const visible = context.alive && this.sees(context.player), distance = Math.hypot(context.player.x - this.x, context.player.y - this.y);
    this.goal = null;
    const homeDistance = Math.hypot(this.x - this.home.x,this.y - this.home.y);
    if (homeDistance > this.config.pursuit) this.returningHome = true;
    if (this.returningHome) {
      this.lastKnown = null; this.detection = 0; this.transition('RETURN_TO_PATROL');
      if (homeDistance > 40) { this.goal = this.home; return; }
      this.returningHome = false;
    }
    if (visible) {
      this.lastKnown = { ...context.player }; this.unseen = 0; this.detection = Math.min(1, this.detection + AI_RULES.decisionSeconds / this.config.detectionSeconds);
      if (this.detection < 1 && !['CHASE','ATTACK','ALERT'].includes(this.state)) this.transition('SUSPICIOUS');
      else if (!context.permitted) this.transition('ALERT');
      else if (distance <= this.config.attackDistance && distance >= this.config.minimumDistance) this.transition('ATTACK');
      else {
        this.transition('CHASE');
        this.goal = distance < this.config.minimumDistance ? { x: this.x + (this.x - context.player.x) / Math.max(1,distance) * 110, y: this.y + (this.y - context.player.y) / Math.max(1,distance) * 110 } : this.lastKnown;
      }
    } else {
      this.detection = Math.max(0, this.detection - .12); this.unseen += AI_RULES.decisionSeconds;
      if (['CHASE','ATTACK','ALERT','SUSPICIOUS'].includes(this.state)) this.transition(this.lastKnown ? 'INVESTIGATE' : 'RETURN_TO_PATROL');
      if (this.lastKnown && Math.hypot(this.x - this.lastKnown.x, this.y - this.lastKnown.y) < 40) { this.transition('SEARCH'); this.angle += .25; }
      if (this.lastKnown && this.unseen > this.config.searchSeconds + 3) { this.lastKnown = null; this.transition('RETURN_TO_PATROL'); }
      if (this.lastKnown && this.state !== 'SEARCH') this.goal = this.lastKnown;
      if (!this.lastKnown) {
        if (this.state === 'IDLE' && this.stateAge < .6) return;
        const point = this.spawn.patrol[this.patrolIndex];
        if (Math.hypot(this.x - point.x, this.y - point.y) < 25) { this.patrolIndex = (this.patrolIndex + 1) % this.spawn.patrol.length; this.transition('PATROL'); }
        this.goal = this.spawn.patrol[this.patrolIndex];
        if (this.state !== 'RETURN_TO_PATROL') this.transition('PATROL');
      }
    }
  }
}
