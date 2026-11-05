import { Box3, Vector3 } from 'three';
import type { DamageEvent, Team } from '../combat/Health';
import type { Solid3D } from './world3d';
import { rayBox, traceSolids } from './physics3d';
export interface Target3D { id: string; team: Team; box: Box3; alive: () => boolean; damage: (event: DamageEvent) => number }
export interface Bullet3D { active: boolean; position: Vector3; origin: Vector3; direction: Vector3; speed: number; life: number; range: number; damage: number; owner: string; team: Team; serial: number }
export class Projectile3D {
  readonly entries: Bullet3D[] = Array.from({ length: 48 },() => ({ active: false,position: new Vector3(),origin: new Vector3(),direction: new Vector3(),speed: 0,life: 0,range: 0,damage: 0,owner: '',team: 'operative',serial: 0 }));
  private serial = 0;
  fire(origin: Vector3,direction: Vector3,speed: number,life: number,range: number,damage: number,owner: string,team: Team) {
    const shot = this.entries.find(b => !b.active); if (!shot || ![...origin.toArray(),...direction.toArray(),speed,life,range,damage].every(Number.isFinite) || direction.lengthSq() < .001 || speed <= 0) return false;
    Object.assign(shot,{ active: true,speed,life,range,damage,owner,team,serial: ++this.serial }); shot.position.copy(origin); shot.origin.copy(origin); shot.direction.copy(direction).normalize(); return true;
  }
  step(dt: number,solids: readonly Solid3D[],targets: readonly Target3D[],impact: (p: Vector3,damage: number,owner: string) => void,travelled?: (bullet: Bullet3D) => void) {
    for (const b of this.entries) {
      if (!b.active) continue; const travel = Math.min(b.speed * dt,b.range,b.life * b.speed);
      const ownerCar=b.owner.startsWith('police-car-')?'city-traffic-'+b.owner.slice(11):'';
      let distance = traceSolids(b.position,b.direction,ownerCar?solids.filter(s=>s.id!==ownerCar):solids,travel,.045),target: Target3D | null = null;
      for (const t of targets) {
        if (t.team === b.team || !t.alive()) continue;
        const hit = rayBox(b.position,b.direction,{ id: t.id,box: t.box,enabled: true,kind: 'cover' },travel,.045);
        if (hit < distance || t.id.startsWith('vehicle-')&&hit<=distance+1e-6&&hit<travel) { distance = hit; target = t; }
      }
      b.position.addScaledVector(b.direction,distance); b.range -= distance; b.life -= dt;
      travelled?.(b);
      if (distance < travel - 1e-6 || target) {
        b.active = false; const taken = target?.damage({ id: b.owner + ':' + b.serial,sourceId: b.owner,team: b.team,amount: b.damage,angle: Math.atan2(b.direction.z,b.direction.x) }) ?? 0;
        impact(b.position,taken,b.owner);
      } else if (b.life <= 0 || b.range <= 0) b.active = false;
    }
  }
  clear() { this.entries.forEach(b => { b.active = false; }); }
}
