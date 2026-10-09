import { useCallback, useRef, useState } from 'react';
import { ArrowUpRight, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RugfireMission, { type MissionHandle } from '@/features/rugfire/RugfireMission';
import Hud from '@/features/rugfire/Hud';
import { clock } from '@/features/rugfire/format';
import type { HudSnapshot } from '@/features/rugfire/engine';
import '@/features/rugfire/rugfire.css';

export default function GamingPage() {
  const navigate = useNavigate(), handle = useRef<MissionHandle>({ engine: null }), root = useRef<HTMLElement>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0), [starting, setStarting] = useState(false);
  const reportError = useCallback((message: string) => setError(message), []);
  const start = async () => { setError(''); setStarting(true); try { await handle.current.engine?.start(); } finally { setStarting(false); } };
  const retry = () => { setError(''); setHud(null); setAttempt(value => value + 1); };
  const exit = () => { handle.current.engine?.pause(); navigate('/'); };
  const fullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen(); }
    catch { setError('Fullscreen is unavailable in this browser. The operation can continue in this window.'); }
  };
  return <main ref={root} className="rf-game">
    <RugfireMission key={attempt} handle={handle} onHud={setHud} onError={reportError} />
    <div className="rf-film" />
      {(!hud || hud.mode === 'briefing') && <section className="rf-overlay" aria-label="Mission briefing"><div className="rf-panel">
        <div className="rf-brand">RUG<i>FIRE</i></div>
        <span className="rf-kicker">MEME CITY / 20:47 / OPERATION 01</span>
        <h1>THE<br />LAUNCH<span style={{ color: '#ae9770' }}>.</span></h1>
        <p className="rf-desc">Everyone bought the hype. Someone pulled the trigger.<br />A fraudulent token launch is draining the district. Find the source. Shut it down. Make it out.</p>
        <div className="rf-brief-objective"><small>PRIMARY DIRECTIVE</small><p>Locate and disable the liquidity operation.</p></div>
        <div className="rf-loadout"><span>GHOST-01<b>OPERATOR</b></span><span>03 WEAPONS<b>FIELD LOADOUT</b></span><span>MEGA RUGGER<b>PRIORITY TARGET</b></span></div>
        <button className="rf-primary" disabled={starting || !hud?.assetsReady} onClick={start}>{starting ? 'ENTERING OPERATION…' : 'ENTER OPERATION'}<ArrowUpRight size={18} /></button>
        {hud && !hud.assetsReady && !error && <p className="rf-controlhint" role="status">PREPARING DISTRICT / {Math.round(hud.assetsProgress * 100)}%</p>}
        <button className="rf-secondary" onClick={exit}>RETURN TO BASE</button>
        <p className="rf-controlhint">WASD MOVE / MOUSE LOOK / RMB AIM / LMB FIRE<br />SHIFT SPRINT / SPACE EVADE / R RELOAD / 1–3 WEAPONS<br />E INTERACT / ESC PAUSE · DESKTOP KEYBOARD + MOUSE</p>
      </div><div className="rf-footer"><span>● UPLINK SECURE</span>LAUNCH DISTRICT / LIQUIDITY AT RISK</div></section>}
    {hud && <>
      <Hud hud={hud} onPause={() => handle.current.engine?.pause()} onMute={() => handle.current.engine?.toggleMute()} onFullscreen={fullscreen} />
      {hud.health <= 30 && hud.mode === 'active' && <div className="rf-low-health" style={{ opacity: 1 - hud.health / 60 }} />}
      {hud.mode === 'paused' && <section className="rf-overlay paused"><div className="rf-panel"><span className="rf-kicker">OPERATOR LINK SUSPENDED</span><h1>OPERATION<br />PAUSED.</h1><p className="rf-desc">Take a breath. The district can wait.</p><div className="rf-controls"><span><b>WASD</b> Move</span><span><b>MOUSE</b> Look</span><span><b>LMB / RMB</b> Fire / Aim</span><span><b>SHIFT</b> Sprint</span><span><b>SPACE</b> Directional evade</span><span><b>R</b> Reload</span><span><b>1 / 2 / 3</b> Equip weapon</span><span><b>E</b> Disable core</span></div><button className="rf-primary" onClick={start} disabled={starting}>RESUME OPERATION<ArrowUpRight size={18} /></button><button className="rf-secondary" onClick={retry}>RESTART OPERATION</button><button className="rf-secondary" onClick={exit}>RETURN TO BASE</button></div></section>}
      {(hud.mode === 'rugged' || hud.mode === 'complete') && <section className={'rf-overlay result ' + (hud.mode === 'rugged' ? 'rugged' : '')}><div className="rf-panel"><span className="rf-kicker">{hud.mode === 'complete' ? 'THREAT ELIMINATED / EXTRACTION CONFIRMED' : 'OPERATOR DOWN / SIGNAL LOST'}</span><h1>{hud.mode === 'complete' ? 'MISSION COMPLETE.' : 'YOU GOT RUGGED.'}</h1><p className="rf-desc">{hud.mode === 'complete' ? 'The drain is closed. Mega Rugger is down. This city gets another night.' : 'The liquidity disappeared. Cause of death: ' + hud.cause + '.'}</p><div className="rf-result-stats"><Stat label="THREATS ELIMINATED" value={String(hud.kills)} /><Stat label="OPERATION TIME" value={clock(hud.time)} /><Stat label="DAMAGE RECEIVED" value={String(hud.damageReceived)} /><Stat label="ACCURACY" value={(hud.shots ? Math.round(hud.hits / hud.shots * 100) : 0) + '%'} /><Stat label="MISSION PROGRESS" value={Math.round(hud.stage / 6 * 100) + '%'} /><Stat label="XP EARNED" value={'+' + hud.rewards.xp} /></div><div className="rf-reward">+{hud.rewards.credits} LOOT CREDITS<br />{hud.rewards.item}<br /><small>FIELD REPORT / OPERATION REWARDS</small></div><button className="rf-primary" onClick={retry}>RETRY OPERATION<RotateCcw size={16} /></button><button className="rf-secondary" onClick={exit}>RETURN TO BASE</button></div></section>}
    </>}
    {error && <div className="rf-error" role="alert">{error}<button className="rf-secondary" onClick={retry}>RESTART GRAPHICS</button></div>}
  </main>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div>; }
