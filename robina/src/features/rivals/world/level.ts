import { NEON_PROPS } from './neonDistrict';
import type { Blocker } from '../combat/geometry';
import type { EnemySpawn } from '../ai/definitions';
import { HEIST_SECURITY, type SecurityDefinition } from '../security/definitions';

export interface WorldObject {
  id: string; kind: 'door' | 'terminal' | 'switch' | 'vault' | 'collectible' | 'extraction';
  name: string; x: number; y: number; range: number;
  requires?: string; frame?: string; width?: number; height?: number; size?: number;
  requiresAll?: readonly string[]; hack?: string; timed?: boolean;
  solid?: { width: number; height: number };
}
export interface LevelDefinition {
  assignmentIndex?:number;
  id: string; title: string; tileSize: number; width: number; height: number;
  spawn: { x: number; y: number }; walls: readonly (readonly number[])[];
  props: typeof NEON_PROPS; objects: readonly WorldObject[];
  targets: readonly { id: string; x: number; y: number; health: number }[];
  markers: readonly { id: string; kind: 'enemy' | 'security' | 'vault' | 'extraction'; x: number; y: number }[];
  signs: readonly { x: number; y: number; text: string; color: string; size: number }[];
  zones: readonly { x: number; y: number; width: number; height: number; color: number }[];
  enemies: readonly EnemySpawn[]; security: SecurityDefinition;
}
const width = 28, height = 22;
const walls = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => Number(
  x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
  x === 10 && y >= 1 && y <= 16 && ![8, 9, 15].includes(y) ||
  y === 7 && x >= 11 && x <= 26 && ![16, 17].includes(x) ||
  y === 16 && x >= 4 && x <= 22 && ![8, 9, 18, 19].includes(x)
)));

/** All gameplay locations are level data. Markers do not spawn future AI systems. */
export const THE_LAUNCH: LevelDefinition = {
  id: 'neon-insertion', title: 'The Launch / Neon District', tileSize: 64, width, height, walls,
  spawn: { x: 288, y: 288 }, props: NEON_PROPS,
  objects: [
    { id: 'insertion-uplink', kind: 'terminal', name: 'Insertion uplink', x: 288, y: 416, range: 105 },
    { id: 'auxiliary-console', kind: 'switch', name: 'Live-fire range switch', x: 160, y: 640, range: 110 },
    { id: 'sector-console', kind: 'terminal', name: 'Sector access terminal', x: 1056, y: 672, range: 110, hack: 'sector-hack' },
    { id: 'transit-door', kind: 'door', name: 'Transit shutter', x: 672, y: 576, range: 130, frame: 'barricade-v', width: 64, height: 128, size: 160 },
    { id: 'vault-gate', kind: 'door', name: 'Restricted sector door', x: 1088, y: 480, range: 125, requires: 'sector-console', frame: 'security-door', width: 128, height: 64, size: 150 },
    { id: 'vault', kind: 'vault', name: 'Central vault access', x: 1536, y: 192, range: 150, requires: 'sector-console', requiresAll: ['relay-a','relay-b','timed-access','guardian-defeated'] },
    { id: 'relay-a', kind: 'terminal', name: 'Vault relay A', x: 1248, y: 320, range: 100, frame: 'console', size: 100, solid: { width: 46, height: 40 } },
    { id: 'relay-b', kind: 'terminal', name: 'Vault relay B', x: 1568, y: 384, range: 100, frame: 'console', size: 100, solid: { width: 46, height: 40 } },
    { id: 'sequence-start', kind: 'terminal', name: 'Phase pad WEST', x: 864, y: 960, range: 80, frame: 'hologram', size: 70, timed: true },
    { id: 'sequence-end', kind: 'terminal', name: 'Phase pad EAST', x: 1056, y: 960, range: 80, frame: 'hologram', size: 70, timed: true },
    { id: 'training-core', kind: 'collectible', name: 'Training Vault Core', x: 1536, y: 320, range: 85, requires: 'vault', frame: 'hologram', size: 75 },
    { id: 'med-station', kind: 'collectible', name: 'Field med charge', x: 288, y: 800, range: 80, frame: 'equipment-case', size: 60 },
    { id: 'extraction', kind: 'extraction', name: 'South extraction', x: 288, y: 1152, range: 90, requires: 'training-core', frame: 'hologram', size: 130 },
  ],
  enemies: [
    { id: 'guard-01', type: 'guard', x: 864, y: 736, angle: Math.PI / 2, patrol: [{ x: 864,y: 736 },{ x: 864,y: 864 },{ x: 992,y: 864 },{ x: 992,y: 736 }] },
    { id: 'enforcer-01', type: 'enforcer', x: 1440, y: 832, angle: 0, patrol: [{ x: 1440,y: 832 },{ x: 1632,y: 832 },{ x: 1632,y: 608 },{ x: 1440,y: 608 }] },
    { id: 'heavy-01', type: 'heavy', x: 1376, y: 288, angle: Math.PI / 2, patrol: [{ x: 1376,y: 288 },{ x: 1376,y: 352 },{ x: 1472,y: 352 },{ x: 1472,y: 288 }] },
  ],
  security: HEIST_SECURITY,
  targets: [ { id: 'target-a', x: 416, y: 640, health: 100 }, { id: 'target-b', x: 544, y: 768, health: 100 }, { id: 'target-c', x: 1376, y: 1152, health: 100 } ],
  markers: [
    { id: 'range-emitter', kind: 'security', x: 384, y: 896 },
    { id: 'future-patrol', kind: 'enemy', x: 864, y: 736 },
    { id: 'central-vault', kind: 'vault', x: 1536, y: 192 },
    { id: 'south-extract', kind: 'extraction', x: 288, y: 1152 },
  ],
  signs: [
    { x: 288, y: 196, text: '01 / THE LAUNCH', color: '#86dbec', size: 16 },
    { x: 288, y: 475, text: 'UPLINK  /  RANGE ↓', color: '#9da3cf', size: 10 },
    { x: 352, y: 550, text: 'LIVE-FIRE LAB\nTARGETS ↓  •  ACCESS →', color: '#f2bd74', size: 12 },
    { x: 864, y: 854, text: 'NEON DISTRICT', color: '#6b819e', size: 24 },
    { x: 864, y: 890, text: 'AEGIS / ACCESS TERMINAL ↑', color: '#86a5b6', size: 10 },
    { x: 1320, y: 400, text: 'RESTRICTED / VAULT 01', color: '#e5af67', size: 13 },
    { x: 288, y: 1248, text: 'EXTRACTION / SOUTH', color: '#65e7b9', size: 12 },
    { x: 384, y: 965, text: '↑ RETURN-FIRE LANE\nENABLE AT WEST CONSOLE', color: '#e79c8b', size: 9 },
  ],
  zones: [
    { x: 352, y: 736, width: 448, height: 448, color: 0x254258 },
    { x: 1216, y: 256, width: 1024, height: 384, color: 0x56301e },
    { x: 288, y: 1152, width: 192, height: 192, color: 0x174f48 },
  ],
};
export const solidTile = (level: LevelDefinition, x: number, y: number) => level.walls[y]?.[x] === 1;
export function wallBlockers(level: LevelDefinition): Blocker[] {
  const result: Blocker[] = [], tile = level.tileSize;
  // Merge contiguous row cells once. Projectile collision never rebuilds the map.
  for (let y = 0; y < level.height; y++) for (let x = 0; x < level.width; x++) {
    if (!solidTile(level, x, y)) continue;
    const start = x; while (x + 1 < level.width && solidTile(level, x + 1, y)) x++;
    result.push({ id: `wall-${start}-${y}`, x: (start + x + 1) * tile / 2, y: y * tile + tile / 2, width: (x - start + 1) * tile, height: tile, enabled: true });
  }
  return result;
}
