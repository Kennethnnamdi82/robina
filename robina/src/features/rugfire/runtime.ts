import { ENEMIES, MISSION, WEAPONS, type EnemyRole, type WeaponId } from './gameData';
export type GameMode = 'briefing' | 'active' | 'paused' | 'rugged' | 'complete';
export class MissionRuntime {
  mode: GameMode = 'briefing'; stage = 0; health = 100; time = 0; kills = 0; damageReceived = 0; shots = 0; hits = 0;
  weaponId: WeaponId = 'rifle'; ammo = this.createAmmo(); reloadLeft = 0; reloadWeapon: WeaponId | null = null;
  shotCooldown = 0; dodgeCooldown = 0; dodgeLeft = 0; sinceDamage = 100; damagePulse = 0; hitPulse = 0; killPulse = 0;
  feed = 'OPERATOR UPLINK ESTABLISHED'; cause = ''; feedLeft = 0; rewarded = false;
  private createAmmo() {
    return Object.fromEntries(Object.values(WEAPONS).map(w => [w.id, { magazine: w.magazineSize, reserve: w.reserveAmmo }])) as Record<WeaponId, { magazine: number; reserve: number }>;
  }
  get weapon() { return WEAPONS[this.weaponId]; }
  tick(dt: number) {
    if (this.mode !== 'active') return;
    this.time += dt; this.sinceDamage += dt; this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt); this.dodgeLeft = Math.max(0, this.dodgeLeft - dt);
    this.damagePulse = Math.max(0, this.damagePulse - dt); this.hitPulse = Math.max(0, this.hitPulse - dt); this.killPulse = Math.max(0, this.killPulse - dt);
    this.feedLeft = Math.max(0, this.feedLeft - dt);
    if (this.reloadLeft > 0) {
      this.reloadLeft = Math.max(0, this.reloadLeft - dt);
      if (!this.reloadLeft && this.reloadWeapon) {
        const id = this.reloadWeapon, slot = this.ammo[id], loaded = Math.min(WEAPONS[id].magazineSize - slot.magazine, slot.reserve);
        slot.magazine += loaded; slot.reserve -= loaded; this.reloadWeapon = null;
      }
    }
    // Modest recovery only after a sustained safe interval; damage remains recorded.
    if (this.sinceDamage > 8 && this.health < 100) this.health = Math.min(100, this.health + dt * 3);
  }
  notify(message: string, duration = 3) { this.feed = message; this.feedLeft = duration; }
  switchWeapon(id: WeaponId) { if (this.mode !== 'active' || id === this.weaponId) return; this.reloadLeft = 0; this.reloadWeapon = null; this.weaponId = id; this.shotCooldown = .15; }
  reload() {
    const slot = this.ammo[this.weaponId];
    if (this.mode !== 'active' || this.reloadLeft || slot.magazine === this.weapon.magazineSize || !slot.reserve) return false;
    this.reloadWeapon = this.weaponId; this.reloadLeft = this.weapon.reloadMs / 1000; return true;
  }
  fire() {
    if (this.mode !== 'active' || this.reloadLeft || this.shotCooldown > 0 || this.dodgeLeft > 0) return false;
    const slot = this.ammo[this.weaponId];
    if (!slot.magazine) { this.notify(slot.reserve ? 'MAGAZINE EMPTY / R TO RELOAD' : 'AMMO DEPLETED / SWITCH WEAPON'); this.shotCooldown = .25; return false; }
    slot.magazine--; this.shots++; this.shotCooldown = this.weapon.fireInterval / 1000; return true;
  }
  dodge() {
    if (this.mode !== 'active' || this.dodgeCooldown > 0) return false;
    this.dodgeLeft = .38; this.dodgeCooldown = 1.8; this.reloadLeft = 0; this.reloadWeapon = null; return true;
  }
  damage(amount: number, source: EnemyRole | 'drain') {
    if (this.mode !== 'active' || this.stage === 6 || this.dodgeLeft > .12) return false;
    const actual = Math.min(this.health, amount); this.health -= actual; this.damageReceived += actual;
    this.damagePulse = .5; this.sinceDamage = 0;
    if (this.health <= 0) { this.mode = 'rugged'; this.cause = source === 'drain' ? 'Liquidity drain' : ENEMIES[source].name; this.notify('YOU GOT RUGGED'); }
    return true;
  }
  kill(role: EnemyRole) { this.kills++; this.hitPulse = .12; this.killPulse = .35; this.notify(ENEMIES[role].name + ' / THREAT ELIMINATED', 2); }
  supply() { this.health = Math.min(100, this.health + 25); for (const id of Object.keys(this.ammo) as WeaponId[]) this.ammo[id].reserve += id === 'pistol' ? 12 : 40; }
  complete() { if (this.mode !== 'active' || this.stage !== 6) return; this.mode = 'complete'; this.rewarded = true; this.notify('MISSION COMPLETE'); }
  get rewards() { return this.rewarded ? MISSION.rewards : { xp: this.kills * 60, credits: this.kills * 15, item: 'No item extracted' }; }
}
