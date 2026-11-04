import { Box3, Vector3 } from 'three';
import type { Health } from '../combat/Health';
import type { Target3D } from './Projectile3D';
import type { Solid3D } from './world3d';
import { traceSolids } from './physics3d';
import { Loadout, type EquipmentId } from './Loadout';

export type Supply = { kind: 'weapon'; weapon: EquipmentId } | { kind: 'health'; amount: number } | { kind: 'bomb'; amount: number };
export interface Pickup { id: string; position: Vector3; supply: Supply; consumed: boolean }
export const HEALTH_BOXES = { small: 20,medium: 40,large: 75 } as const;
export const BOMB = { capacity: 6,fuse: 1.5,radius: 7,damage: 110,speed: 11.5,vertical: 4.2,gravity: 12,cooldown: .65 } as const;
export const ENEMY_DROPS = { guard: 'pistol',enforcer: 'smg',heavy: 'rifle' } as const;
export interface ThrownBomb { active: boolean; serial: number; position: Vector3; velocity: Vector3; life: number }
/** Gameplay-only items share Health, target damage and the physical solid set. */
export class FieldItems {
  readonly pickups: Pickup[] = []; readonly bombs: ThrownBomb[] = Array.from({ length: 6 },() => ({ active: false,serial: 0,position: new Vector3(),velocity: new Vector3(),life: 0 }));
  quantity = 3; thrown = 0; exploded = 0; pending: string | null = null; message = ''; private serial = 0;
  private delta = new Vector3(); private direction = new Vector3(); private nearest = new Vector3(); private before = new Vector3();
  add(id: string,position: Vector3,supply: Supply) { if (this.pickups.some(p => p.id === id)) return; this.pickups.push({ id,position: position.clone(),supply,consumed: false }); }
  nearby(point: Vector3,solids: readonly Solid3D[]) {
    let found: Pickup | undefined,distance = 1.8;
    for (const p of this.pickups) { const d = p.position.distanceTo(point); if (p.consumed || d > distance) continue; this.direction.subVectors(p.position,point).setY(0); const length = this.direction.length(); this.before.copy(point).y += .6; if (length && traceSolids(this.before,this.direction.normalize(),solids,length) < length - .05) continue; distance = d; found = p; } return found;
  }
  take(item: Pickup,loadout: Loadout,health: Health,allowed: boolean,index?: number) {
    if (!allowed || health.current <= 0 || item.consumed || loadout.busy && this.pending !== item.id) return false;
    if (item.supply.kind === 'health') { const gain = health.heal(item.supply.amount); if (!gain) { this.message = 'Health Full.'; return false; } this.message = `+${gain} HP / FIELD CARE`; }
    else if (item.supply.kind === 'bomb') { const gain = Math.min(item.supply.amount,BOMB.capacity - this.quantity); if (gain <= 0) { this.message = 'Bomb inventory full.'; return false; } this.quantity += gain; this.message = `+${gain} GRENADES`; }
    else { if (!loadout.collect(item.supply.weapon,index)) { this.pending = item.id; this.message = 'Choose a slot to replace.'; return false; } this.message = 'WEAPON RECOVERED'; }
    item.consumed = true; this.pending = null; return true;
  }
  cancel() { this.pending = null; this.message = ''; }
  throw(point: Vector3,aim: Vector3,allowed: boolean) {
    const free = this.bombs.find(b => !b.active); if (!allowed || !this.quantity || !free) { if (!this.quantity) this.message = 'No grenades remaining.'; return false; }
    this.direction.subVectors(aim,point).setY(0); if (this.direction.lengthSq() < .001) return false; this.direction.normalize();
    free.position.copy(point).y += 1.25; free.velocity.copy(this.direction).multiplyScalar(BOMB.speed); free.velocity.y = BOMB.vertical; free.active = true; free.life = BOMB.fuse; free.serial = ++this.serial; this.quantity--; this.thrown++; return true;
  }
  step(dt: number,solids: readonly Solid3D[],targets: readonly Target3D[],explode: (point: Vector3,radius: number) => void) {
    for (const b of this.bombs) {
      if (!b.active) continue; this.before.copy(b.position); b.velocity.y -= BOMB.gravity * dt; this.delta.copy(b.velocity).multiplyScalar(dt); const length = this.delta.length();
      if (length) { this.direction.copy(this.delta).divideScalar(length); const clear = traceSolids(b.position,this.direction,solids,length,.07); b.position.addScaledVector(this.direction,Math.max(0,clear - (clear < length ? .01 : 0))); if (clear < length) b.velocity.multiplyScalar(-.25); }
      if (b.position.y <= .1) { b.position.y = .1; b.velocity.x *= .92; b.velocity.z *= .92; b.velocity.y = Math.abs(b.velocity.y) * .25; }
      b.life -= dt; if (b.life > 0) continue; b.active = false; this.exploded++;
      for (const target of targets) {
        if (target.team !== 'security' || !target.alive()) continue; target.box.clampPoint(b.position,this.nearest); this.delta.subVectors(this.nearest,b.position); const d = this.delta.length(); if (d > BOMB.radius) continue;
        this.direction.copy(this.delta).normalize(); if (d > .01 && traceSolids(b.position,this.direction,solids,d) < d - .01) continue;
        target.damage({ id: 'pulse-bomb:' + b.serial,sourceId: 'operative',team: 'operative',amount: Math.round(BOMB.damage * (1 - .65 * Math.min(1,d / BOMB.radius))),angle: Math.atan2(this.delta.z,this.delta.x) });
      }
      explode(b.position,BOMB.radius);
    }
  }
  snapshot() { return { quantity: this.quantity,thrown: this.thrown,exploded: this.exploded,pending: this.pending,message: this.message,pickups: this.pickups.map(p => ({ id: p.id,position: p.position.toArray(),supply: p.supply,consumed: p.consumed })),bombs: this.bombs.filter(b => b.active).map(b => ({ serial: b.serial,position: b.position.toArray(),life: b.life })) }; }
}
export function meleeStrike(origin: Vector3,direction: Vector3,targets: readonly Target3D[],solids: readonly Solid3D[],damage: number,range: number,serial: number,onHit?: (point: Vector3) => void) {
  const near = new Vector3(),delta = new Vector3(),forward = direction.clone().setY(0).normalize(); let hits = 0;
  for (const t of targets) { if (t.team !== 'security' || !t.alive()) continue; t.box.clampPoint(origin,near); delta.subVectors(near,origin); const d = delta.length(); if (d > range) continue; const horizontal = delta.clone().setY(0).normalize(); if (d > .05 && horizontal.dot(forward) < .6) continue; delta.normalize(); if (traceSolids(origin,delta,solids,d) < d - .01) continue; if (t.damage({ id: 'knife:' + serial,sourceId: 'operative',team: 'operative',amount: damage,angle: Math.atan2(forward.z,forward.x) })) { hits++; onHit?.(near); } } return hits;
}
