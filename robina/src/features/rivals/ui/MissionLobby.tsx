import { ArrowLeft, ArrowUpRight, Check, Crosshair, Shield, Swords } from 'lucide-react';
import { RECON_MISSION } from '../data/missions';
import type { CharacterId, QualityId } from '../core/presentation';
import { OperativePreview } from './OperativePreview';
import { OperativeSelector } from './OperativeSelector';
import type { MissionMode } from '../missions/types';
import { loadPractice } from '../missions/progression';
import { missionTime } from '../core/presentation';

export function MissionLobby({ characterId, onCharacter, quality, onQuality, reducedMotion, onStart, onBack, mode, onMode }: {
  characterId: CharacterId; onCharacter: (id: CharacterId) => void; quality: QualityId; onQuality: (id: QualityId) => void; reducedMotion: boolean; onStart: () => void; onBack: () => void;
  mode: MissionMode; onMode: (mode: MissionMode) => void;
}) {
  const progress = loadPractice(), best = progress.best['the-launch:' + mode];
  return <section className="rv-menu-page" aria-label="Mission briefing">
    <button className="rivals-text-button" onClick={onBack}><ArrowLeft size={16} />Back to main menu</button>
    <div className="rv-page-heading"><span className="rivals-overline">MISSION BRIEFING / 01</span><h1 tabIndex={-1}>THE LAUNCH</h1><p>Neon District · Solo practice operation</p></div>
    <div className="rv-briefing-grid"><div className="rv-briefing-preview"><OperativePreview characterId={characterId} reducedMotion={reducedMotion} /><span className="rv-ready"><Check size={15} />OPERATIVE READY</span></div>
      <article className="rv-briefing-info"><span className="rivals-overline">THE APPROACH</span><h2>Quiet streets.<br /><em>Sharp instincts.</em></h2><p>{RECON_MISSION.description}</p>
        <dl className="rv-mission-details"><div><dt>Difficulty</dt><dd><Shield size={15} />{mode === 'timed' ? '8-minute challenge' : 'Standard / no deadline'}</dd></div><div><dt>Opening objective</dt><dd><Crosshair size={15} />Enter the restricted compound</dd></div><div><dt>Equipped weapon</dt><dd>{RECON_MISSION.weapon}</dd></div><div><dt>Extraction</dt><dd>Vault Core + Guardian defeat required</dd></div><div><dt>Progress</dt><dd>100 practice XP + 25 optional recon XP</dd></div></dl>
        <label className="rv-mission-mode">INSERTION RULES<select aria-label="Mission timing" value={mode} onChange={event => onMode(event.target.value as MissionMode)}><option value="standard">Standard — no deadline</option><option value="timed">Timed challenge — 8 minutes</option></select></label>
        <p className="rv-mission-note">Fight or evade the patrols. Hack sector access; link WEST → EAST within 3.5 seconds while OPEN, then bring both relays online. The Guardian seals the chamber: dodge its warnings and attack during recovery. Defeat it, recover the core, and extract south. Pause, hacking and the brief reveal suspend field time. Progress stays on this browser; no currency or ranked rewards.</p>
        <p className="rv-practice-summary">LOCAL PRACTICE / {progress.completions} clears · {progress.practiceXP} XP{best !== undefined && ' · Best ' + missionTime(best)}{progress.unlocks.includes('guardian-cleared') && ' · Guardian clearance recorded'}</p>
        <button className="rivals-primary" onClick={onStart}><Swords size={18} />START MISSION<ArrowUpRight size={19} /></button>
      </article></div>
    <OperativeSelector selected={characterId} onSelect={onCharacter} quality={quality} onQuality={onQuality} />
  </section>;
}
