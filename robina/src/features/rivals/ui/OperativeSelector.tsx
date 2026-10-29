import { CHARACTERS } from '../characters/definitions';
import { CHARACTER_IDS, isQuality, QUALITY_PRESETS, type CharacterId, type QualityId } from '../core/presentation';
import { VISUAL_MANIFEST, visualUrl } from '../assets';

export function OperativeSelector({ selected, onSelect, quality, onQuality }: {
  selected: CharacterId; onSelect: (id: CharacterId) => void; quality: QualityId; onQuality: (id: QualityId) => void;
}) {
  return <section className="rivals-roster-bar" aria-label="Field deployment settings">
    <div className="rivals-operative-choices" role="group" aria-label="Choose field operative">
      {CHARACTER_IDS.map(id => <button key={id} aria-label={`Select ${CHARACTERS[id].name}`} aria-pressed={selected === id} onClick={() => onSelect(id)} className="rivals-operative-choice" style={{ borderColor: selected === id ? CHARACTERS[id].color : undefined }}>
        <img src={visualUrl(VISUAL_MANIFEST.characters[id].portraitFile)} alt="" />
        <span><strong>{CHARACTERS[id].name}</strong><small>{CHARACTERS[id].role}</small></span>
        <i style={{ background: selected === id ? CHARACTERS[id].color : undefined }} />
      </button>)}
    </div>
    <label className="rivals-quality-choice"><span>GRAPHICS QUALITY</span><select aria-label="Lobby graphics quality" value={quality} onChange={event => { if (isQuality(event.target.value)) onQuality(event.target.value); }}>{Object.entries(QUALITY_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}</select></label>
  </section>;
}
