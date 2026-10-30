import { Crosshair, Radio, RotateCw, Wind, Zap } from 'lucide-react';
import type { ArenaSession } from '../core/session';
import { useArenaValue } from './useArenaValue';
import { TouchStick } from './TouchStick';

export function ActionControls({ session, visibility }: { session: ArenaSession; visibility: 'auto' | 'show' | 'hide' }) {
  const cooldown = useArenaValue(session, s => s.dodgeCooldown), nearby = useArenaValue(session, s => s.nearby);
  const mobileSprint = useArenaValue(session, s => s.mobileSprint), weapon = useArenaValue(session, s => s.weapon);
  return <div className="rv-controls" data-mobile={visibility}>
    {visibility !== 'hide' && <><TouchStick kind="move" disabled={false} onMove={session.setMovement} /><TouchStick kind="aim" disabled={false} onMove={session.setAim} /><button className="rv-sprint-control rv-touch-only" aria-label="Toggle sprint" aria-pressed={mobileSprint} onClick={session.toggleSprint}><Wind size={18} /><span>SPRINT</span></button></>}
    <div className="rv-action-buttons"><button className="rv-dodge-control" aria-label="Dodge" disabled={cooldown > .01} onPointerDown={event => { if (cooldown > .01) return; event.preventDefault(); session.dodge(); }} onClick={event => { if (event.detail === 0) session.dodge(); }}><Zap size={21} /><span>{cooldown > .01 ? cooldown.toFixed(1) + 's' : 'DODGE'}</span></button>
      <button className="rv-interact-control" aria-label="Inspect nearby equipment" disabled={!nearby} onClick={session.interact}><Radio size={21} /><span>INTERACT</span></button>
      {visibility !== 'hide' && <><button className="rv-reload-control rv-touch-only" aria-label="Reload weapon" disabled={!weapon || Boolean(weapon.reloading) || weapon.ammo === weapon.capacity} onClick={session.reload}><RotateCw size={18} /><span>RELOAD</span></button><button className="rv-fire-control rv-touch-only" aria-label={weapon ? 'Fire weapon' : 'Fire unavailable: no weapon equipped'} disabled={!weapon} onPointerDown={event => { event.preventDefault(); if (weapon) { event.currentTarget.setPointerCapture(event.pointerId); session.input.setFire(true); } }} onPointerUp={() => session.input.setFire(false)} onPointerCancel={() => session.input.setFire(false)} onLostPointerCapture={() => session.input.setFire(false)} onClick={event => { if (event.detail === 0) { session.input.setFire(true); session.input.setFire(false); } }}><Crosshair size={21} /><span>{weapon?.reloading ? 'LOADING' : weapon ? 'FIRE' : 'UNARMED'}</span></button></>}
    </div>
  </div>;
}
