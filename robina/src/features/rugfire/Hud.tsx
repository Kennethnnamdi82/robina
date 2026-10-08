import { Crosshair, Shield, Radio, Volume2, VolumeX, Maximize, Pause } from 'lucide-react';
import type { HudSnapshot } from './engine';
import { WEAPONS } from './gameData';
import { clock } from './format';

export default function Hud({ hud, onPause, onMute, onFullscreen }: { hud: HudSnapshot; onPause: () => void; onMute: () => void; onFullscreen: () => void }) {
  const live = hud.mode === 'active';
  return <div className="rf-hud">
    {hud.mode !== 'briefing' && <div className="rf-topline"><div className="rf-operation"><span className="rf-kicker">RUGFIRE / OPERATION 01</span><strong>THE LAUNCH</strong><span className="rf-objective"><i />{hud.objective}</span><small>{hud.distance} M TO OBJECTIVE <b> / </b> {String(hud.stage + 1).padStart(2, '0')} / 07</small></div>
      <div className="rf-compass"><span>{Math.round((hud.bearing + 315) % 360)}</span><span>│</span><b>{String(Math.round(hud.bearing)).padStart(3, '0')}</b><span>│</span><span>{Math.round((hud.bearing + 45) % 360)}</span><i>▼</i></div>
      <div className="rf-intel"><div className="rf-map"><svg viewBox="-13 -83 26 100" role="img" aria-label="District tactical map"><path d="M -5 16 V -81 M 5 16 V -81" stroke="#52605e" strokeWidth=".35" /><path d="M 0 16 V -81" stroke="#66726b" strokeWidth=".15" strokeDasharray="2 2" />{hud.map.enemies.map(([x, z], i) => <circle key={i} cx={x} cy={z} r="1.2" fill="#c66d61" />)}<path d={'M ' + hud.map.target[0] + ' ' + (hud.map.target[1] - 1.4) + ' l 1.4 1.4 -1.4 1.4 -1.4 -1.4 Z'} fill="#ccba8e" /><circle cx={hud.map.player[0]} cy={hud.map.player[1]} r="1.15" fill="#dce3d8" /></svg><small>MEME CITY / SECTOR 04</small></div><div className="rf-status"><Radio size={11} /> UPLINK ACTIVE <b>{clock(hud.time)}</b></div></div>
    </div>}
    {live && <>
      <div className={'rf-reticle ' + (hud.aiming ? 'aiming ' : '') + (hud.hit ? 'hit ' : '') + (hud.kill ? 'kill ' : '')}><i /><i /><i /><i /><b /></div>
      {hud.targets.map(t => <div key={t.id} className={'rf-threat ' + (t.warning ? 'warning' : '')} style={{ left: t.x + '%', top: t.y + '%' }}><span>{t.name}</span><div><i style={{ width: t.hp * 100 + '%' }} /></div><small>{t.threat}</small></div>)}
      {hud.sniper && <div className="rf-alert">WHALE LOCKED ON <small>BREAK SIGHTLINE / EVADE</small></div>}
      {hud.bossHealth !== null && <div className="rf-boss"><div><span>MEGA RUGGER</span><small>{hud.bossPhase}</small></div><div className="rf-bossbar"><i style={{ width: hud.bossHealth * 100 + '%' }} /></div><small>$MEGARUG / EXTREME THREAT</small></div>}
      <div className="rf-feed" role="status">{hud.feed}</div>
      {hud.interact && <div className="rf-interact">{hud.interact}</div>}
      <div className="rf-bottom"><div className="rf-vitals"><div><Shield size={15} /><span>OPERATOR / GHOST-01</span><b>{hud.health}<small> HP</small></b></div><div className={'rf-healthbar ' + (hud.health <= 30 ? 'low' : '')}><i style={{ width: hud.health + '%' }} /></div><small>{hud.covered ? 'COVER / SIGHTLINE OBSTRUCTED' : 'COMBAT SYSTEMS ONLINE'}</small><div className="rf-dodge"><span>SPACE / EVADE</span><i style={{ width: (1 - hud.dodge / 1.8) * 100 + '%' }} /><b>{hud.dodge > 0 ? hud.dodge.toFixed(1) + 's' : 'READY'}</b></div></div>
        <div className="rf-comms"><Crosshair size={12} /><span>{hud.kills} THREATS ELIMINATED</span></div>
        <div className="rf-weapon"><span>{WEAPONS[hud.weaponId].name}</span><div><strong>{String(hud.ammo).padStart(2, '0')}</strong><i>/</i><b>{hud.reserve}</b></div>{hud.reload > 0 ? <div className="rf-reload"><i style={{ width: hud.reload * 100 + '%' }} /><small>RELOADING</small></div> : <small>1 PISTOL <b>/</b> 2 SMG <b>/</b> 3 AR <b>·</b> R RELOAD</small>}</div>
      </div>
      {hud.damage > 0 && <div className="rf-damage-direction" style={{ transform: 'translate(-50%, -50%) rotate(' + hud.damageAngle + 'rad)', opacity: hud.damage * 2 }} />}
    </>}
    <div className="rf-tools"><button onClick={onMute} aria-label={hud.muted ? 'Enable audio' : 'Mute audio'}>{hud.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button><button onClick={onFullscreen} aria-label="Toggle fullscreen"><Maximize size={15} /></button>{live && <button onClick={onPause} aria-label="Pause operation"><Pause size={15} /></button>}</div>
  </div>;
}
