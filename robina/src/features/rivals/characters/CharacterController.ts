import type { Facing } from '../core/contracts';
import type { PlayerCommand } from '../input/InputBuffer';
import { AnimationStateMachine, type AnimationIntent } from './AnimationStateMachine';
import { Health, type DamageEvent } from '../combat/Health';

export const MOVEMENT = { walkSpeed: 235, sprintMultiplier: 1.55, acceleration: 32, stopping: 45, dodgeSpeed: 620, evadeSpeed: 420, dodgeDuration: .18, dodgeInvulnerability: .12, dodgeRecovery: .10, dodgeCooldown: 1.1, hurtDuration: .22, interactDuration: .22 } as const;

/** Physics-independent controller stepped at Arcade's fixed 60 Hz, without per-step allocations. */
export class CharacterController {
  constructor(private readonly evasiveDodge = false) {}
  readonly animations = new AnimationStateMachine();
  readonly vitality = new Health();
  get maxHealth() { return this.vitality.maximum; }
  get health() { return this.vitality.current; }
  vx = 0; vy = 0; facing: Facing = 'down'; aimAngle = Math.PI / 2;
  dodgeRemaining = 0; dodgeCooldown = 0; dodgeSerial = 0;
  sprinting = false; aiming = false;
  private dashX = 0; private dashY = 1;
  private hurtRemaining = 0; private interactionRemaining = 0;
  private attackRemaining = 0; private recoveryRemaining = 0; private damageSerial = 0;
  get canAttack() { return this.health > 0 && this.hurtRemaining <= 0 && this.interactionRemaining <= 0 && this.dodgeRemaining <= 0 && this.recoveryRemaining <= 0; }
  get dodgeImmune() { return this.dodgeRemaining > MOVEMENT.dodgeDuration - MOVEMENT.dodgeInvulnerability; }
  private intent: AnimationIntent = { alive: true, hurt: false, dashing: false, interacting: false, moving: false, running: false, aiming: false, attacking: false };

  /** Returns true only when a real interaction request can be attempted. */
  step(input: PlayerCommand, dt: number): boolean {
    if (!Number.isFinite(dt) || dt <= 0) return false;
    this.vitality.step(dt);
    const wasDashing = this.dodgeRemaining > 0;
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.dodgeRemaining = Math.max(0, this.dodgeRemaining - dt);
    this.hurtRemaining = Math.max(0, this.hurtRemaining - dt);
    this.interactionRemaining = Math.max(0, this.interactionRemaining - dt);
    this.attackRemaining = Math.max(0, this.attackRemaining - dt);
    this.recoveryRemaining = Math.max(0, this.recoveryRemaining - dt);
    if (wasDashing && this.dodgeRemaining <= 0) this.recoveryRemaining = MOVEMENT.dodgeRecovery;
    const alive = this.health > 0, canAct = alive && this.hurtRemaining <= 0 && this.interactionRemaining <= 0;
    const canMove=alive&&this.interactionRemaining<=0&&(this.evasiveDodge||this.hurtRemaining<=0);
    const length = Math.hypot(input.x, input.y), moving = length > .01;
    const x = input.x / Math.max(1, length), y = input.y / Math.max(1, length);
    this.aiming = canAct && input.aiming;
    if (this.aiming) this.aimAngle = Math.atan2(input.aimY, input.aimX);
    else if (canAct && moving) this.aimAngle = Math.atan2(y, x);
    if (canAct && (moving || this.aiming)) {
      const fx = this.aiming ? input.aimX : x, fy = this.aiming ? input.aimY : y;
      this.facing = Math.abs(fx) > Math.abs(fy) ? fx < 0 ? 'left' : 'right' : fy < 0 ? 'up' : 'down';
    }
    if (input.dodge && canAct && this.dodgeCooldown <= .00001 && this.dodgeRemaining <= 0) {
      this.dashX = moving ? x : Math.cos(this.aimAngle);
      this.dashY = moving ? y : Math.sin(this.aimAngle);
      if (this.evasiveDodge) {
        const forwardX = Math.cos(this.aimAngle),forwardY = Math.sin(this.aimAngle),forward = this.dashX * forwardX + this.dashY * forwardY;
        if (forward > 0) { this.dashX -= forwardX * forward; this.dashY -= forwardY * forward; }
        if (!moving || Math.hypot(this.dashX,this.dashY) < .01) { this.dashX = -forwardX; this.dashY = -forwardY; }
      }
      const dashLength = Math.hypot(this.dashX, this.dashY) || 1;
      this.dashX /= dashLength; this.dashY /= dashLength;
      this.dodgeRemaining = MOVEMENT.dodgeDuration; this.dodgeCooldown = MOVEMENT.dodgeCooldown; this.dodgeSerial++;
    }
    const dashing = canAct && this.dodgeRemaining > 0;
    this.sprinting = canMove && moving && input.sprint && !dashing;
    if (!canMove) { this.vx = 0; this.vy = 0; }
    else if (dashing) { const speed = this.evasiveDodge ? MOVEMENT.evadeSpeed : MOVEMENT.dodgeSpeed; this.vx = this.dashX * speed; this.vy = this.dashY * speed; }
    else {
      const speed = MOVEMENT.walkSpeed * (input.sprint ? MOVEMENT.sprintMultiplier : 1);
      const blend = 1 - Math.exp(-(moving ? this.evasiveDodge?55:MOVEMENT.acceleration : this.evasiveDodge?65:MOVEMENT.stopping) * dt);
      this.vx += (x * speed - this.vx) * blend; this.vy += (y * speed - this.vy) * blend;
      if (!moving && Math.hypot(this.vx, this.vy) < .5) { this.vx = 0; this.vy = 0; }
    }
    const interact = input.interact && canAct && !dashing;
    const intent = this.intent;
    intent.alive = alive; intent.hurt = this.hurtRemaining > 0; intent.dashing = dashing;
    intent.interacting = this.interactionRemaining > 0; intent.moving = canMove && (moving || Math.hypot(this.vx, this.vy) > 3);
    intent.running = this.sprinting; intent.aiming = this.aiming;
    intent.attacking = this.attackRemaining > 0; this.animations.resolve(intent);
    return interact;
  }
  interacted() { if (this.health > 0) { this.interactionRemaining = MOVEMENT.interactDuration; this.vx = 0; this.vy = 0; } }
  /** Driver state ages damage/cooldowns without consuming walking controls. */
  stepMounted(dt:number){
    if(!Number.isFinite(dt)||dt<=0)return;
    this.vitality.step(dt);this.dodgeCooldown=Math.max(0,this.dodgeCooldown-dt);
    this.hurtRemaining=Math.max(0,this.hurtRemaining-dt);this.interactionRemaining=Math.max(0,this.interactionRemaining-dt);
    this.attackRemaining=Math.max(0,this.attackRemaining-dt);this.recoveryRemaining=Math.max(0,this.recoveryRemaining-dt);this.stop();
    Object.assign(this.intent,{alive:this.health>0,hurt:this.hurtRemaining>0,dashing:false,interacting:this.interactionRemaining>0,moving:false,running:false,aiming:false,attacking:false});this.animations.resolve(this.intent);
  }
  attacked() { if (this.canAttack) { this.attackRemaining = .09; this.intent.attacking = true; this.animations.resolve(this.intent); } }
  damage(amount: number): number {
    return this.receiveDamage({ id: 'local:' + ++this.damageSerial, sourceId: 'local-training', team: 'security', amount, angle: 0 });
  }
  receiveDamage(event: DamageEvent): number {
    const taken = this.vitality.damage(event, this.dodgeImmune); if (!taken) return 0;
    this.hurtRemaining = MOVEMENT.hurtDuration;
    this.dodgeRemaining = 0;if(!this.evasiveDodge||this.health<=0)this.stop(); this.intent.alive = this.health > 0; this.intent.hurt = true;
    this.animations.resolve(this.intent); return taken;
  }
  stop() { this.vx = 0; this.vy = 0; this.dodgeRemaining = 0; this.sprinting = false; this.aiming = false; }
}
