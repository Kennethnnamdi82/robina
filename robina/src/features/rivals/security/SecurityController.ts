import { clearSight, type Point } from '../ai/navigation';
import type { DamageEvent } from '../combat/Health';
import { HEIST_SECURITY, type SecurityDefinition } from './definitions';
import { HackPuzzle } from './HackPuzzle';
import type { WorldState } from '../world/WorldState';
import type { WorldObject } from '../world/level';
export type CyclePhase = 'OFF' | 'WARNING' | 'ACTIVE';
export function cyclePhase(clock: number, off: number, warning: number, active: number, offset = 0): CyclePhase {
  const phase = ((clock + offset) % (off + warning + active) + off + warning + active) % (off + warning + active);
  return phase < off ? 'OFF' : phase < off + warning ? 'WARNING' : 'ACTIVE';
}
export function touchesBeam(point: Point, a: Point, b: Point, radius: number) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
  return (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2 <= radius * radius;
}
export class SecurityController {
  clock = 0; alarmRemaining = 0; alarmSerial = 0; alarmPosition: Point = { x: 0, y: 0 }; alarmSource = '';
  detections = new Map<string, number>(); disabled = new Map<string, number>();
  hack: HackPuzzle | null = null; message = 'BREACH PROTOCOL / Hack the sector terminal. Synchronize the phase pads. Activate both vault relays.';
  sequenceStarted = -Infinity; sequenceFailures = 0; hacksCompleted = 0; private damageSerial = 0;
  private scanElapsed = 0; private alarmCooldown = new Map<string, number>(); private laserHit = new Map<string, number>();
  constructor(readonly world: WorldState, readonly definition: SecurityDefinition = HEIST_SECURITY) {}
  disabledFor(id: string) { return Math.max(0, (this.disabled.get(id) ?? 0) - this.clock); }
  cameraAngle(id: string) { const camera = this.definition.cameras.find(c => c.id === id)!; return camera.angle + Math.sin(this.clock * Math.PI * 2 / camera.period) * camera.sweep; }
  laserPhase(id: string) { const laser = this.definition.lasers.find(l => l.id === id)!; return this.disabledFor(id) ? 'OFF' : cyclePhase(this.clock, laser.off, laser.warning, laser.active, laser.offset); }
  get sequencePhase() { const s = this.definition.sequence; return cyclePhase(this.clock, s.off, s.warning, s.open); }
  get sequenceRemaining() { return Math.max(0, this.definition.sequence.deadline - (this.clock - this.sequenceStarted)); }
  raise(source: string, point: Point) {
    if ((this.alarmCooldown.get(source) ?? -Infinity) > this.clock) return false;
    this.alarmCooldown.set(source, this.clock + 5);
    if (this.alarmRemaining <= 0) this.alarmSerial++;
    this.alarmRemaining = 12; this.alarmPosition = { ...point }; this.alarmSource = source; return true;
  }
  step(dt: number, player: Point, alive: boolean, damage: (event: DamageEvent) => number) {
    this.clock += dt; this.alarmRemaining = Math.max(0, this.alarmRemaining - dt);
    if (this.sequenceStarted > -Infinity && (!this.sequenceRemaining || this.sequencePhase !== 'ACTIVE')) { this.sequenceStarted = -Infinity; this.sequenceFailures++; this.message = 'PHASE LINK RESET / Start on an OPEN window, then reach the second pad before the link expires.'; }
    if (!alive) return;
    for (const laser of this.definition.lasers) {
      if (this.laserPhase(laser.id) !== 'ACTIVE' || !touchesBeam(player, laser.a, laser.b, 17) || !clearSight(laser.a, player, this.world.blockers)) continue;
      if ((this.laserHit.get(laser.id) ?? -Infinity) > this.clock) continue;
      this.laserHit.set(laser.id, this.clock + .65); this.raise(laser.id, player);
      damage({ id: laser.id + ':' + ++this.damageSerial, sourceId: laser.id, team: 'security', amount: laser.damage, angle: Math.atan2(laser.b.y - laser.a.y, laser.b.x - laser.a.x) });
    }
    this.scanElapsed += dt; if (this.scanElapsed < .1) return; const elapsed = this.scanElapsed; this.scanElapsed = 0;
    for (const camera of this.definition.cameras) {
      const dx = player.x - camera.x, dy = player.y - camera.y, angle = Math.atan2(dy, dx) - this.cameraAngle(camera.id);
      const sees = !this.disabledFor(camera.id) && dx * dx + dy * dy <= camera.range ** 2 && Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < camera.cone && clearSight(camera, player, this.world.blockers);
      const detection = Math.max(0, Math.min(1, (this.detections.get(camera.id) ?? 0) + (sees ? elapsed / camera.detection : -elapsed * 1.4)));
      this.detections.set(camera.id, detection); if (detection >= 1) this.raise(camera.id, player);
    }
  }
  beginHack(object: WorldObject, actor: Point) {
    const definition = this.definition.hacks.find(h => h.objectId === object.id);
    if (!definition || this.world.active.has(object.id) || !this.world.reachable(object, actor)) return false;
    this.hack = new HackPuzzle(definition); return true;
  }
  submitHack(pad: number, actor: Point) {
    const hack = this.hack; if (!hack || hack.getSnapshot().result !== 'input') return false;
    const object = this.world.level.objects.find(o => o.id === hack.definition.objectId)!;
    if (!this.world.reachable(object,actor)) { hack.fail('Terminal connection lost. Return to interaction range.'); return false; }
    const success = hack.submit(pad);
    if (hack.getSnapshot().result === 'failure') { this.raise('hack-failure', actor); this.message = 'HACK FAILED / Security notified. Retry or return to the field.'; }
    if (!success || !this.world.reachable(object, actor)) return false;
    this.world.authorizeHack(object.id);
    if (!this.world.interact(object,actor)) { hack.fail('Access conditions changed. Reconnect at the terminal.'); return false; }
    for (const id of hack.definition.disable) this.disabled.set(id, this.clock + hack.definition.disableSeconds);
    this.hacksCompleted++; this.message = 'SECTOR AUTHORIZED / Vault grid and concourse camera suppressed for 24 seconds. Complete the phase link and both vault relays.'; return true;
  }
  timedInteract(object: WorldObject, actor: Point) {
    const s = this.definition.sequence;
    if (!object.timed || !this.world.reachable(object, actor)) return false;
    if (this.world.active.has(s.grant)) { this.message = 'PHASE LINK COMPLETE / Access latch retained.'; return true; }
    if (this.sequencePhase !== 'ACTIVE') { this.sequenceStarted = -Infinity; this.sequenceFailures++; this.message = 'WINDOW CLOSED / Wait for OPEN at the phase pad.'; return true; }
    if (object.id === s.start) { this.sequenceStarted = this.clock; this.message = 'PHASE LINK ARMED / Reach the east pad within 3.5 seconds, while OPEN.'; return true; }
    if (object.id === s.finish && this.sequenceRemaining > 0) { this.world.grantFlag(s.grant); this.sequenceStarted = -Infinity; this.message = 'PHASE LINK COMPLETE / Activate both relays in the vault sector.'; return true; }
    this.sequenceFailures++; this.message = 'PHASE LINK RESET / Activate the west pad first.'; return true;
  }
}
