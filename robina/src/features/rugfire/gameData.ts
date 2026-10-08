export type WeaponId = "pistol" | "smg" | "rifle";
export type EnemyRole = "kol" | "rugger" | "whale" | "boss";

export type WeaponDefinition = {
  id: WeaponId;
  name: string;
  damage: number;
  fireInterval: number;
  magazineSize: number;
  reserveAmmo: number;
  reloadMs: number;
  range: number;
  color: string;
};

export type EnemyDefinition = {
  role: EnemyRole;
  name: string;
  token: string;
  threat: "LOW" | "HIGH" | "EXTREME";
  health: number;
  damage: number;
  range: number;
  cooldown: number;
  color: string;
};

export type MissionEnemy = {
  id: string;
  role: EnemyRole;
  position: [number, number, number];
  wave: number;
};

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  pistol: { id: "pistol", name: "Kestrel 9", damage: 28, fireInterval: 340, magazineSize: 12, reserveAmmo: 72, reloadMs: 1250, range: 32, color: "#d8ff56" },
  smg: { id: "smg", name: "Slipstream SMG", damage: 12, fireInterval: 100, magazineSize: 32, reserveAmmo: 160, reloadMs: 1650, range: 25, color: "#ffbd4a" },
  rifle: { id: "rifle", name: "Audit AR", damage: 20, fireInterval: 180, magazineSize: 24, reserveAmmo: 120, reloadMs: 1900, range: 42, color: "#8ceeff" },
};

export const ENEMIES: Record<EnemyRole, EnemyDefinition> = {
  kol: { role: "kol", name: "FAKE KOL", token: "$MOONPUG", threat: "LOW", health: 72, damage: 7, range: 18, cooldown: 1250, color: "#ff6b6b" },
  rugger: { role: "rugger", name: "RUG PULLER", token: "$PUMPCTRL", threat: "HIGH", health: 150, damage: 14, range: 15, cooldown: 1500, color: "#e14b55" },
  whale: { role: "whale", name: "WHALE", token: "$APEX", threat: "HIGH", health: 105, damage: 31, range: 42, cooldown: 3100, color: "#d38cff" },
  boss: { role: "boss", name: "MEGA RUGGER", token: "$MEGARUG", threat: "EXTREME", health: 520, damage: 20, range: 28, cooldown: 1050, color: "#ff374f" },
};

export const MISSION_ENEMIES: MissionEnemy[] = [
  { id: "kol-alpha", role: "kol", position: [-4, 0.9, -7], wave: 1 },
  { id: "kol-bravo", role: "kol", position: [4.5, 0.9, -11], wave: 1 },
  { id: "rugger-alpha", role: "rugger", position: [-3.5, 0.9, -25], wave: 2 },
  { id: "kol-charlie", role: "kol", position: [3.5, 0.9, -29], wave: 2 },
  { id: "whale-one", role: "whale", position: [7.5, 4.1, -34], wave: 2 },
  { id: "rugger-bravo", role: "rugger", position: [1, 0.9, -39], wave: 3 },
  { id: "boss", role: "boss", position: [0, 1.4, -51], wave: 3 },
];

export const OBJECTIVES = [
  "Reach the launch district",
  "Investigate the fake launch",
  "Locate the liquidity facility",
  "Disable the liquidity operation",
  "Defeat Mega Rugger",
];
