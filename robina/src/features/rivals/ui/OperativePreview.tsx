import { VISUAL_MANIFEST, visualUrl } from '../assets';
import { CHARACTERS } from '../characters/definitions';
import type { CharacterId } from '../core/presentation';

/** CSS sprite animation reuses the selected atlas without importing Phaser into menus. */
export function OperativePreview({ characterId, reducedMotion }: { characterId: CharacterId; reducedMotion: boolean }) {
  return <div className="rv-operative-preview" role="img" aria-label={CHARACTERS[characterId].name + ' character preview'}>
    <div className="rv-preview-ring" />
    <div className={'rv-preview-sprite' + (reducedMotion ? ' rv-still' : '')} style={{ backgroundImage: 'url(' + visualUrl(VISUAL_MANIFEST.characters[characterId].file) + ')' }} />
    <span>{CHARACTERS[characterId].name}</span><small>{CHARACTERS[characterId].role}</small>
  </div>;
}
