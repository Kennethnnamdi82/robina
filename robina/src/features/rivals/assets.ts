import { VISUAL_MANIFEST } from './data/visualManifest';
import type { CharacterId } from './core/presentation';
import { THE_LAUNCH } from './world/level';
/** Legacy reference URLs are retained; playable art uses the validated Phase 02 manifest. */
export const assetUrl = (file: string) => `${import.meta.env.BASE_URL}assets/rivals/v4/${file}`;

export const ARENA_ASSETS = {
  tiles: { file: 'tiles/neon.png', frameWidth: 64, frameHeight: 64 },
  idle: { file: 'characters/vex_idle_4x4.png', frameWidth: 96, frameHeight: 96 },
  walk: { file: 'characters/vex_walk_6x4.png', frameWidth: 96, frameHeight: 96 },
} as const;

export const PROP_KEYS = ['vault_door', 'light_column', 'storage_box', 'crate', 'data_console', 'extraction_portal', 'power_generator', 'terminal_on'] as const;
export type PropKey = typeof PROP_KEYS[number];

export { VISUAL_MANIFEST };
export const visualUrl = (file: string) => `${import.meta.env.BASE_URL}assets/rivals/phase02/${file}?v=${VISUAL_MANIFEST.revision}`;

export function assetBudget(character: CharacterId) {
  const textures = [VISUAL_MANIFEST.floor, VISUAL_MANIFEST.props, VISUAL_MANIFEST.walls, VISUAL_MANIFEST.characters[character], ...Object.entries(VISUAL_MANIFEST.characters).filter(([id]) => id !== character).map(([,entry]) => entry)];
  const groundBytes = THE_LAUNCH.width * THE_LAUNCH.height * THE_LAUNCH.tileSize ** 2 * 4;
  return { textureBytes: textures.reduce((sum, t) => sum + t.width * t.height * 4, 0) + (768 * 96 + 512 * 64 + 33 * 10) * 4 + groundBytes, essentialBytes: textures.reduce((sum, t) => sum + t.bytes, 0) + 35284 };
}
