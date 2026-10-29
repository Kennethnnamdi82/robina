import type Phaser from 'phaser';
import { assetBudget, VISUAL_MANIFEST, visualUrl } from '../assets';
import type { ArenaSession } from '../core/session';
import { FACINGS } from '../characters/definitions';

export function preloadVisuals(scene: Phaser.Scene, session: ArenaSession) {
  const character = VISUAL_MANIFEST.characters[session.getSnapshot().characterId];
  session.loading('Loading Neon District artwork', 0);
  scene.load.on('progress', (progress: number) => session.loading('Loading Neon District artwork', progress));
  scene.load.on('loaderror', (file: Phaser.Loader.File) => {
    if (file.key !== 'ambience') session.fail(`Unable to load ${file.key}. Return to the lobby and retry.`);
  });
  scene.load.xhr.timeout = 18000;
  scene.load.spritesheet('rv-floor', visualUrl(VISUAL_MANIFEST.floor.file), { frameWidth: 128, frameHeight: 128 });
  for (const [key, entry] of [['rv-props', VISUAL_MANIFEST.props], ['rv-walls', VISUAL_MANIFEST.walls], ['rv-character', character]] as const) {
    scene.load.atlas(key, visualUrl(entry.file), visualUrl(entry.atlasFile));
  }
}

/** Do not let a corrupt/mismatched atlas silently render the wrong rectangle. */
export function validateLoadedVisuals(scene: Phaser.Scene, session: ArenaSession) {
  for (const [key, frameNames] of [
    ['rv-character', FACINGS.flatMap(direction => Array.from({ length: 6 }, (_, i) => `walk/${direction}/${i}`))],
    ['rv-props', ['crate', 'console', 'vault-door', 'reactor', 'camera', 'hologram', 'light-column']],
    ['rv-walls', ['horizontal', 'vertical', 'corner', 'junction', 'lamp', 'glass', 'vent', 'end']],
  ] as const) {
    const texture = scene.textures.get(key);
    if (!texture || texture.key === '__MISSING') throw new Error(`Missing texture: ${key}`);
    const source = texture.getSourceImage() as HTMLImageElement;
    for (const name of frameNames) {
      if (!texture.has(name)) throw new Error(`Missing atlas frame: ${key}/${name}`);
      const frame = texture.get(name);
      if (frame.cutX < 0 || frame.cutY < 0 || frame.cutX + frame.cutWidth > source.width || frame.cutY + frame.cutHeight > source.height) throw new Error(`Invalid atlas bounds: ${key}/${name}`);
    }
  }
  const budget = assetBudget(session.getSnapshot().characterId);
  session.update({ metrics: { ...session.getSnapshot().metrics, ...budget } });
}
