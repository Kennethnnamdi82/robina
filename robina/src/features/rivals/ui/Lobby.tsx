import { useRef } from 'react';
import { ArrowLeft, ArrowUpRight, Crosshair, Settings2, Shield, Swords, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { assetUrl } from '../assets';
import { ControlHelp } from './ControlHelp';

export function Lobby({ onPlay, onContinue, canContinue, onMissions, onCustomise, onSettings, onRankings, onBack, onProfile }: {
  onPlay: () => void; onContinue: () => void; canContinue: boolean; onMissions: () => void;
  onCustomise: () => void; onSettings: () => void; onRankings: () => void; onBack: () => void;
  onProfile: () => void;
}) {
  const guide = useRef<HTMLDialogElement>(null);
  return <div className="rv-command-menu">
    <header className="rivals-topbar"><div className="rivals-brand"><span className="rivals-crest"><Swords size={25} /></span><div><strong>RIVALS</strong><span>RIVAL HEIST</span></div></div>
      <span className="rv-menu-mode">SOLO HEIST / NEON DISTRICT</span>
      <button className="rivals-icon-button" aria-label="Exit to website" onClick={onBack}><ArrowLeft size={18} /></button>
    </header>
    <section className="rv-menu-hero" aria-label="RIVALS main menu">
      <div className="rv-menu-art" style={{ backgroundImage: 'url(' + assetUrl('art/chamber-reference.png') + ')' }} /><div className="rv-menu-light" /><div className="rv-menu-scan" />
      <div className="rv-menu-copy"><p className="rivals-overline">THE CITY KEEPS ITS SECRETS.</p><h1 tabIndex={-1}>RIVAL<br /><em>HEIST</em><span>.</span></h1><p>Get in. Find your edge.<br />Leave your rivals behind.</p>
        <nav className="rv-main-actions" aria-label="Main menu" onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]'));
          const index = nodes.indexOf(document.activeElement as HTMLElement);
          nodes[event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length]?.focus();
        }}>
          <button className="rivals-primary" onClick={canContinue ? onContinue : onPlay}><Swords size={19} />{canContinue ? 'CONTINUE' : 'PLAY'}<ArrowUpRight size={20} /></button>
          <button onClick={onMissions}><Crosshair size={17} /><span>MISSIONS</span><small>01 available</small></button>
          <button onClick={onCustomise}><Shield size={17} /><span>CHARACTER CUSTOMIZATION</span></button>
          <Link to="/profile" onClick={e => { e.preventDefault(); onProfile(); }}><UserRound size={17} /><span>PLAYER PROFILE</span><ArrowUpRight size={14} /></Link>
          <button onClick={onRankings}><span className="rv-menu-rank">#</span><span>LEADERBOARDS</span><small>Preview</small></button>
          <button onClick={onSettings}><Settings2 size={17} /><span>SETTINGS</span></button>
          <button className="rv-menu-back" onClick={onBack}><ArrowLeft size={16} />EXIT / BACK</button>
        </nav>
      </div>
      <aside className="rv-menu-sector"><span className="rivals-overline">NEXT INSERTION / 01</span><h2>NEON DISTRICT</h2><p>A sealed vault. A quiet approach.<br />Your first route through the undercity.</p><button className="rivals-text-button" onClick={() => guide.current?.showModal()}>Field guide <ArrowUpRight size={15} /></button><span className="rv-art-label">V4 VISUAL TARGET / CHAMBER ART</span></aside>
    </section>
    <footer className="rivals-lobby-footer"><span>TRAINING ACCESS · NO PURCHASE REQUIRED</span><span>RIVALS / RIVAL HEIST</span></footer>
    <dialog ref={guide} className="rivals-guide" aria-labelledby="rivals-guide-title"><button className="rivals-guide-close rivals-icon-button" aria-label="Close field guide" onClick={() => guide.current?.close()}><X size={18} /></button><span className="rivals-overline">OPERATIVE HANDBOOK</span><h2 id="rivals-guide-title">Your first insertion.</h2><p>Calibrate your carbine in the west range, then infiltrate the guarded concourse. Camera cones respect walls and cover. Loud gunfire draws investigations; firing windups and laser warnings give you time to dodge. Hack the sector terminal, link WEST to EAST while the phase pads are OPEN, and activate both vault relays. Recover the core and extract south. Hacking pauses the field; reserve ammunition and retries are free. Competitive scoring and rewards come later.</p><ControlHelp /><button className="rivals-primary" onClick={() => guide.current?.close()}>UNDERSTOOD <ArrowUpRight size={18} /></button></dialog>
  </div>;
}
