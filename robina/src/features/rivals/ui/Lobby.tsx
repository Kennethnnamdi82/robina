import { useRef } from 'react';
import { ArrowLeft, ArrowUpRight, Crosshair, Keyboard, LockKeyhole, MoveUpRight, Radio, Shield, Swords, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { assetUrl, VISUAL_MANIFEST, visualUrl } from '../assets';
import { CHARACTERS } from '../characters/definitions';
import type { CharacterId, QualityId } from '../core/presentation';
import { OperativeSelector } from './OperativeSelector';

export function Lobby({ onEnter, characterId, onCharacter, quality, onQuality }: { onEnter: () => void; characterId: CharacterId; onCharacter: (id: CharacterId) => void; quality: QualityId; onQuality: (id: QualityId) => void }) {
  const guide = useRef<HTMLDialogElement>(null);
  const operative = CHARACTERS[characterId];
  return <div className="rivals-lobby">
    <header className="rivals-topbar">
      <div className="rivals-brand"><span className="rivals-crest"><Swords size={25} /></span><div><strong>RIVALS</strong><span>RIVAL HEIST</span></div></div>
      <nav className="rivals-topnav" aria-label="RIVALS navigation"><span className="rivals-active-tab" aria-current="page">Arena</span><button onClick={() => guide.current?.showModal()}>Field guide <ArrowUpRight size={13} /></button></nav>
      <span className="rivals-system-status"><i /> SYSTEMS ONLINE</span>
      <Link to="/" className="rivals-icon-button" aria-label="Return to website home"><ArrowLeft size={18} /></Link>
    </header>

    <div className="rivals-lobby-heading"><div><p className="rivals-overline">THE CITY KEEPS ITS SECRETS. TAKE THEM.</p><h1>Welcome to the <em>Arena.</em></h1></div><span className="rivals-build-label">RIVAL HEIST / RECON ACCESS</span></div>
    <OperativeSelector selected={characterId} onSelect={onCharacter} quality={quality} onQuality={onQuality} />

    <div className="rivals-lobby-grid">
      <aside className="rivals-operative-panel">
        <div className="rivals-profile"><img src={visualUrl(VISUAL_MANIFEST.characters[characterId].portraitFile)} alt={`${operative.name} operative portrait`} /><div><span className="rivals-overline">YOUR OPERATIVE</span><h2>{operative.name}</h2><span>{operative.role}</span></div></div>
        <div className="rivals-readiness"><Shield size={24} /><div><span>OPERATIVE STATUS</span><strong>Ready for insertion</strong></div><i /></div>
        <div className="rivals-panel-section"><span className="rivals-overline">FIELD BRIEFING</span><h3>Know your way out.</h3><p>Every heist starts with knowing the terrain. Step inside the Neon Vault and find your footing.</p></div>
        <ol className="rivals-briefing-list"><li><b>01</b><div><strong>Enter the district</strong><span>A private training sector.</span></div></li><li><b>02</b><div><strong>Find your flow</strong><span>Move through the vault’s passages.</span></div></li><li><b>03</b><div><strong>Return on your terms</strong><span>Pause and leave at any time.</span></div></li></ol>
        <div className="rivals-input-note"><Keyboard size={19} /><span>KEYBOARD OR TOUCH<strong>Built for your browser</strong></span></div>
      </aside>

      <section className="rivals-operation" aria-label="Rival Heist operation">
        <div className="rivals-operative-stage" role="img" aria-label="Illustrated operative standing in a neon-lit vault chamber">
          <div className="rivals-chamber-art" style={{ backgroundImage: `url(${assetUrl('art/chamber-reference.png')})` }} />
          <div className="rivals-chamber-glow" /><div className="rivals-operative-caption"><span className="rivals-overline">OPERATIVE / 001</span><strong>VEX<span>THE INFILTRATOR</span></strong><span className="rivals-chamber-caption">CHAMBER ART / NEON DISTRICT</span></div>
        </div>
        <div className="rivals-operation-content">
          <div className="rivals-operation-topline"><span><Radio size={13} /> SECTOR 01</span><span>SOLO / TRAINING</span></div>
          <div className="rivals-operation-copy"><span className="rivals-overline">WELCOME TO THE UNDERCITY</span><h2>RIVAL<br /><em>HEIST</em><span>.</span></h2><p>The vault is waiting.<br />Make your first move.</p></div>
          <div className="rivals-entry"><div className="rivals-entry-location"><Crosshair size={19} /><div><strong>NEON VAULT</strong><span>Reconnaissance sector · Free exploration</span></div></div><button className="rivals-primary rivals-enter-button" onClick={onEnter}><Swords size={19} /> ENTER THE ARENA <ArrowUpRight size={21} /></button><p className="rivals-entry-note"><i /> SECTOR CLEAR <span>No hostiles. No time limit.</span></p></div>
        </div>
      </section>
    </div>

    <div className="rivals-lobby-bottom"><div><MoveUpRight size={18} /><span><strong>MOVE WITH PURPOSE</strong>Fluid movement & directional animation</span></div><div><LockKeyhole size={18} /><span><strong>LEARN THE TERRAIN</strong>Solid walls, cover & connected passages</span></div><div><Shield size={18} /><span><strong>YOUR OWN PACE</strong>Pause, explore & return safely</span></div></div>
    <footer className="rivals-lobby-footer"><span><i /> PRIVATE TRAINING SECTOR</span><span>NEON DISTRICT / 01 <b>RIVALS</b></span></footer>

    <dialog ref={guide} className="rivals-guide" aria-labelledby="rivals-guide-title"><button className="rivals-guide-close rivals-icon-button" aria-label="Close field guide" onClick={() => guide.current?.close()}><X size={18} /></button><span className="rivals-overline">OPERATIVE HANDBOOK</span><h2 id="rivals-guide-title">Your first insertion.</h2><p>Explore a real, collision-enabled training vault. Follow the passages and use the minimap to learn the district.</p><dl><div><dt>MOVE</dt><dd>WASD or arrow keys</dd></div><div><dt>MOBILE</dt><dd>Drag the movement stick</dd></div><div><dt>PAUSE / RESUME</dt><dd>Escape or the pause button</dd></div><div><dt>LEAVE</dt><dd>Pause → Return to lobby</dd></div></dl><p className="rivals-guide-note">This sector is for free exploration. Combat, missions and competitive rankings arrive in later phases.</p><button className="rivals-primary" onClick={() => guide.current?.close()}>UNDERSTOOD <ArrowUpRight size={18} /></button></dialog>
  </div>;
}
