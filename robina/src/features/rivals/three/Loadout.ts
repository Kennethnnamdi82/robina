import { PULSE_CARBINE, WeaponController, type WeaponDefinition } from '../combat/weapons';
import { WEAPONS } from '../../rugfire/gameData';

export type EquipmentId = 'rifle' | 'pistol' | 'smg' | 'knife';
export interface EquipmentDefinition extends WeaponDefinition { model: EquipmentId; kind: 'firearm' | 'melee'; reserve: number; maxReserve: number }
const firearm = (id: 'pistol' | 'smg'): EquipmentDefinition => {
  const w = WEAPONS[id]; return { id,name: w.name,model: id,kind: 'firearm',damage: w.damage,interval: w.fireInterval / 1000,automatic: w.automatic,magazine: w.magazineSize,reloadSeconds: w.reloadMs / 1000,range: w.range / .025,speed: 900,lifetime: w.range / 22.5,spread: w.spread,recoil: w.recoil,impact: 'pulse-impact',reserve: w.reserveAmmo,maxReserve: w.reserveAmmo * 2 };
};
export const EQUIPMENT: Record<EquipmentId,EquipmentDefinition> = {
  rifle: { ...PULSE_CARBINE,model: 'rifle',kind: 'firearm',reserve: 120,maxReserve: 240 },
  pistol: firearm('pistol'),smg: firearm('smg'),
  knife: { id: 'field-knife',name: 'VEX / FIELD KNIFE',model: 'knife',kind: 'melee',damage: 45,interval: .55,automatic: true,magazine: 0,reloadSeconds: 0,range: 1.8 / .025,speed: 0,lifetime: 0,spread: 0,recoil: 0,impact: 'melee',reserve: 0,maxReserve: 0 },
};
export interface WeaponSlot { id: EquipmentId; controller: WeaponController }
export type SoldierAction = 'idle' | 'switch' | 'melee' | 'throw' | 'pickup';
/** Three slots hold persistent controllers. No account entitlements or writes. */
export class Loadout {
  readonly slots: (WeaponSlot | null)[]; active = 0; shots = 0; serial = 0; action: SoldierAction = 'idle'; remaining = 0; meleeCooldown = 0;
  constructor(ids: readonly EquipmentId[] = ['rifle','pistol','knife']) { this.slots = Array.from({ length: 3 },(_,i) => ids[i] ? this.create(ids[i]) : null); }
  private create(id: EquipmentId): WeaponSlot { const d = EQUIPMENT[id]; return { id,controller: new WeaponController(d,d.reserve,d.maxReserve) }; }
  get current() { return this.slots[this.active]!; }
  get definition() { return EQUIPMENT[this.current.id]; }
  get busy() { return this.remaining > 0; }
  start(action: SoldierAction,seconds: number) { this.action = action; this.remaining = seconds; this.serial++; }
  switchTo(index: number,allowed: boolean) {
    if (!allowed || this.busy || index === this.active || !Number.isInteger(index) || !this.slots[index]) return false;
    this.current.controller.reloadRemaining = 0; this.current.controller.cancelTrigger(); this.active = index; this.start('switch',.22); return true;
  }
  cycle(allowed: boolean) { for (let i = 1; i < 4; i++) { const at = (this.active + i) % 3; if (this.slots[at]) return this.switchTo(at,allowed); } return false; }
  collect(id: EquipmentId,index?: number) {
    const at = index ?? this.slots.findIndex(s => s === null);
    if (!Number.isInteger(at) || at < 0 || at >= 3) return false;
    this.slots[at] = this.create(id); if (at === this.active) this.start('switch',.22); return true;
  }
  step(dt: number,fire: boolean,reload: boolean,allowed: boolean,touchRepeat = false) {
    this.remaining = Math.max(0,this.remaining - dt); this.meleeCooldown = Math.max(0,this.meleeCooldown - dt); if (!this.remaining) this.action = 'idle';
    const usable = allowed && !this.busy;
    if (this.definition.kind === 'melee') {
      if (usable && fire && this.meleeCooldown <= .00001) { this.meleeCooldown = this.definition.interval; this.start('melee',.38); this.shots++; return true; } return false;
    }
    if (touchRepeat) this.current.controller.cancelTrigger();
    const controller = this.current.controller;
    const fired = controller.step(dt,fire,reload || controller.ammo === 0 && controller.reserve > 0,usable); if (fired) this.shots++; return fired;
  }
  snapshot() { return { active: this.active,action: this.action,remaining: this.remaining,serial: this.serial,shots: this.shots,slots: this.slots.map(s => s ? { id: s.id,name: EQUIPMENT[s.id].name,kind: EQUIPMENT[s.id].kind,ammo: s.controller.ammo,reserve: s.controller.reserve,capacity: s.controller.definition.magazine,reload: s.controller.reloadRemaining } : null) }; }
}
