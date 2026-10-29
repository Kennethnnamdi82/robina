import type { CharacterDefinition, Vector } from '../core/contracts';
import type { PropKey } from '../assets';

export const OPERATIVE: CharacterDefinition = {
  id: 'vex', name: 'VEX', speed: 235, radius: 14,
  animation: { idleFrames: 4, walkFrames: 6, frameSize: 96 },
};

export interface ArenaProp { texture: PropKey; x: number; y: number; solid?: boolean; light?: number }
export const TRAINING_VAULT = {
  id: 'neon-insertion', title: 'Neon Vault', tileSize: 64, width: 28, height: 22,
  spawn: { x: 288, y: 288 } as Vector,
  props: [
    { texture: 'extraction_portal', x: 288, y: 416, light: 0x9c65ff },
    { texture: 'crate', x: 480, y: 288, solid: true },
    { texture: 'storage_box', x: 480, y: 352, solid: true },
    { texture: 'data_console', x: 160, y: 640, solid: true, light: 0x21c9ec },
    { texture: 'terminal_on', x: 1056, y: 288, solid: true, light: 0x21c9ec },
    { texture: 'power_generator', x: 1440, y: 1056, solid: true, light: 0xffb744 },
    { texture: 'vault_door', x: 1536, y: 192, solid: true, light: 0xffb744 },
    ...[160, 608, 1184, 1632].map(x => ({ texture: 'light_column' as const, x, y: 112, light: 0x29baff })),
    ...[160, 608, 1184, 1632].map(x => ({ texture: 'light_column' as const, x, y: 1296, light: 0x995cff })),
    { texture: 'crate', x: 1248, y: 736, solid: true },
    { texture: 'storage_box', x: 1312, y: 736, solid: true },
  ] satisfies ArenaProp[],
} as const;

/** Independent collision layer; the supplied atlas contains art, not collision semantics. */
export function isWall(x: number, y: number): boolean {
  const { width, height } = TRAINING_VAULT;
  if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return true;
  if (x === 10 && y >= 3 && y <= 16 && ![8, 9, 15].includes(y)) return true;
  if (y === 7 && x >= 11 && x <= 23 && ![16, 17].includes(x)) return true;
  return y === 16 && x >= 4 && x <= 22 && ![8, 9, 18, 19].includes(x);
}

export function floorFrame(x: number, y: number): number {
  if (isWall(x, y)) return 3;
  if (x >= 21 && y <= 4) return 12 + x % 4;
  if (x % 9 === 0 || y === 10) return 8 + (x + y) % 4;
  return (x >= 11 && y <= 7 ? 4 : 0) + ((x * 7 + y * 11) % 4);
}
