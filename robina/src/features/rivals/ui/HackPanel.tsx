import { useEffect, useRef } from 'react';
import { Check, LockKeyhole, Radio, RotateCcw, X } from 'lucide-react';
import type { ArenaSession } from '../core/session';
import { useArenaValue } from './useArenaValue';
import { trapFocus } from './trapFocus';
import '../security.css';
export function HackPanel({ session }: { session: ArenaSession }) {
  const hack = useArenaValue(session,s => s.hack), panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.querySelector<HTMLButtonElement>('button')?.focus(); },[hack?.id,hack?.result]);
  if (!hack) return null;
  return <div className="rv-hack-overlay"><section ref={panel} className="rv-hack-panel" role="dialog" aria-modal="true" aria-labelledby="rv-hack-title" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); session.closeHack(); }
    else if (/^[1-4]$/.test(event.key) && hack.result === 'input') { event.preventDefault(); session.hackPad(Number(event.key)); }
    trapFocus(event);
  }}>
    <header><span className="rivals-overline"><Radio size={14} />AEGIS / SIGNAL INTERCEPT</span><button className="rivals-icon-button" aria-label="Close hacking terminal" onClick={session.closeHack}><X size={18} /></button></header>
    <div className="rv-hack-emblem">{hack.result === 'success' ? <Check size={32} /> : <LockKeyhole size={32} />}</div>
    <h2 id="rv-hack-title">{hack.result === 'success' ? 'Access granted.' : hack.result === 'failure' ? 'Signal rejected.' : 'Break the handshake.'}</h2>
    <p>Repeat the access code from left to right using the four signal pads. A wrong pad alerts security. Retry freely.</p>
    <div className="rv-hack-code" aria-label="Access code">{hack.sequence.map((number,index) => <span key={index} data-complete={index < hack.entered.length}><small>0{index + 1}</small><b>{number}</b>{index < hack.entered.length && <Check size={14} />}</span>)}</div>
    <div className="rv-hack-progress" aria-label="Hacking progress">{hack.entered.length} / {hack.sequence.length} signals accepted</div>
    {hack.result === 'input' && <div className="rv-hack-pads">{[1,2,3,4].map(number => <button key={number} aria-label={'Signal pad ' + number} onClick={() => session.hackPad(number)}><span>CHANNEL 0{number}</span><b>{number}</b><i /></button>)}</div>}
    {hack.result === 'failure' && <><p role="alert">{hack.reason}</p><button className="rivals-primary" onClick={session.hackRetry}><RotateCcw size={17} />RETRY HANDSHAKE</button></>}
    {hack.result === 'success' && <><p role="status">Sector door authorized. Vault lasers and the concourse camera are suppressed for 24 seconds of field time.</p><button className="rivals-primary" onClick={session.closeHack}>RETURN TO FIELD</button></>}
    <footer>TERMINAL ISOLATION · Field simulation is paused while connected. {hack.result === 'input' ? 'Keys 1–4 also work. Escape disconnects.' : ''}</footer>
  </section></div>;
}
