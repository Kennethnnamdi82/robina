import { VISUAL_MANIFEST } from './data/visualManifest';
import type { CharacterId } from './core/presentation';
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
  const textures = [VISUAL_MANIFEST.floor, VISUAL_MANIFEST.props, VISUAL_MANIFEST.walls, VISUAL_MANIFEST.characters[character]];
  return { textureBytes: textures.reduce((sum, t) => sum + t.width * t.height * 4, 0), essentialBytes: textures.reduce((sum, t) => sum + t.bytes, 0) };
}
