export type WeaponId = 'pistol' | 'smg' | 'rifle';
export type EnemyRole = 'kol' | 'rugger' | 'whale' | 'boss';
export type WeaponDefinition = { id: WeaponId; name: string; damage: number; fireInterval: number; magazineSize: number; reserveAmmo: number; reloadMs: number; range: number; recoil: number; spread: number; automatic: boolean };
export const WEAPON_ORDER: WeaponId[] = ['pistol', 'smg', 'rifle'];
export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  pistol: { id: 'pistol', name: 'KESTREL / 9MM', damage: 34, fireInterval: 310, magazineSize: 12, reserveAmmo: 96, reloadMs: 1100, range: 65, recoil: .013, spread: .006, automatic: false },
  smg: { id: 'smg', name: 'SLIPSTREAM / SMG', damage: 15, fireInterval: 85, magazineSize: 32, reserveAmmo: 224, reloadMs: 1500, range: 42, recoil: .017, spread: .019, automatic: true },
  rifle: { id: 'rifle', name: 'AUDIT / ASSAULT RIFLE', damage: 27, fireInterval: 145, magazineSize: 30, reserveAmmo: 240, reloadMs: 1800, range: 90, recoil: .01, spread: .008, automatic: true },
};
export const ENEMIES: Record<EnemyRole, { name: string; token: string; threat: string; health: number; damage: number; speed: number; range: number; cooldown: number; telegraph: number; color: number }> = {
  kol: { name: 'FAKE KOL', token: '$MOONPUG', threat: 'MOBILE / RANGED', health: 78, damage: 8, speed: 2.6, range: 24, cooldown: 2.4, telegraph: .75, color: 0xb87c55 },
  rugger: { name: 'RUG PULLER', token: '$PUMPCTRL', threat: 'HEAVY / ASSAULT', health: 162, damage: 15, speed: 1.6, range: 19, cooldown: 2.8, telegraph: .95, color: 0x9e4340 },
  whale: { name: 'WHALE', token: '$APEX', threat: 'SNIPER / ELEVATED', health: 108, damage: 28, speed: 1.8, range: 65, cooldown: 5, telegraph: 1.65, color: 0x8a95aa },
  boss: { name: 'MEGA RUGGER', token: '$MEGARUG', threat: 'EXTREME', health: 900, damage: 18, speed: 2.1, range: 32, cooldown: 2.2, telegraph: .9, color: 0x963b37 },
};
export const OBJECTIVES = ['Reach Launch District', 'Investigate the launch. Clear the hostiles.', 'Secure Market Street', 'Locate the liquidity facility. Watch the rooftops.', 'Disable the liquidity operation', 'Defeat Mega Rugger', 'Reach the extraction beacon'];
export const MISSION = {
  id: 'the-launch', name: 'THE LAUNCH', difficulty: 'OPERATOR', rewards: { xp: 1800, credits: 650, item: 'Audit AR · Field schematic' },
  zones: [4, -17, -34, -47, -59, -76],
  enemies: [
    { id: 'kol-a', role: 'kol' as EnemyRole, x: -3, y: 0, z: -7, stage: 1 },
    { id: 'kol-b', role: 'kol' as EnemyRole, x: 4, y: 0, z: -11, stage: 1 },
    { id: 'rug-a', role: 'rugger' as EnemyRole, x: -4, y: 0, z: -23, stage: 2 },
    { id: 'kol-c', role: 'kol' as EnemyRole, x: 4, y: 0, z: -27, stage: 2 },
    { id: 'whale-a', role: 'whale' as EnemyRole, x: 8, y: 3.4, z: -39, stage: 3 },
    { id: 'kol-d', role: 'kol' as EnemyRole, x: -3, y: 0, z: -40, stage: 3 },
    { id: 'rug-b', role: 'rugger' as EnemyRole, x: 4, y: 0, z: -51, stage: 4 },
    { id: 'kol-e', role: 'kol' as EnemyRole, x: -4, y: 0, z: -52, stage: 4 },
    { id: 'boss', role: 'boss' as EnemyRole, x: 0, y: 0, z: -68, stage: 5 },
  ],
};
