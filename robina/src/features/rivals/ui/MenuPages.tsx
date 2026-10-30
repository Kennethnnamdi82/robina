import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, Crosshair, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RECON_MISSION } from '../data/missions';
import { OperativePreview } from './OperativePreview';
import { OperativeSelector } from './OperativeSelector';
import type { CharacterId, QualityId } from '../core/presentation';

export function MenuPage({ title, eyebrow, onBack, children }: { title: string; eyebrow: string; onBack: () => void; children: ReactNode }) {
  return <section className="rv-menu-page"><button className="rivals-text-button" onClick={onBack}><ArrowLeft size={16} />Back to main menu</button><div className="rv-page-heading"><span className="rivals-overline">{eyebrow}</span><h1 tabIndex={-1}>{title}</h1></div>{children}</section>;
}
export function MissionSelect({ onSelect }: { onSelect: () => void }) {
  return <div className="rv-mission-cards"><button className="rv-mission-card rv-mission-available" onClick={onSelect}><Crosshair size={29} /><span className="rivals-overline">01 / AVAILABLE</span><h2>{RECON_MISSION.name}</h2><p>{RECON_MISSION.description}</p><strong>VIEW BRIEFING <ArrowUpRight size={18} /></strong></button>{['Phantom Fortress', 'Reactor Zone'].map((name, i) => <article className="rv-mission-card rv-mission-locked" key={name}><LockKeyhole size={25} /><span className="rivals-overline">0{i + 2} / FUTURE OPERATION</span><h2>{name}</h2><p>This operation is not available yet.</p></article>)}</div>;
}
export function Customization({ characterId, onCharacter, quality, onQuality, reducedMotion }: { characterId: CharacterId; onCharacter: (id: CharacterId) => void; quality: QualityId; onQuality: (id: QualityId) => void; reducedMotion: boolean }) {
  return <><div className="rv-loadout"><OperativePreview characterId={characterId} reducedMotion={reducedMotion} /><div><span className="rivals-overline">FIELD LOADOUT</span><h2>Your operative.<br /><em>Your approach.</em></h2><p>Choose an operative for your next insertion. All three use the same movement tuning in training.</p><dl className="rv-mission-details"><div><dt>Appearance</dt><dd>Standard field suit</dd></div><div><dt>Equipped weapon</dt><dd>Unarmed</dd></div><div><dt>Cosmetics & attachments</dt><dd>Not available yet</dd></div></dl></div></div><OperativeSelector selected={characterId} onSelect={onCharacter} quality={quality} onQuality={onQuality} /></>;
}
export function RankingsPreview({ onCommunity }: { onCommunity: () => void }) {
  return <div className="rv-empty-state"><LockKeyhole size={34} /><h2>Rival rankings are not live yet.</h2><p>Competitive scores and matchmaking arrive in a later phase. This local training mission does not submit ranked scores.</p><Link className="rivals-secondary" to="/rank" onClick={e => { e.preventDefault(); onCommunity(); }}>Open existing community leaderboard <ArrowUpRight size={17} /></Link></div>;
}
