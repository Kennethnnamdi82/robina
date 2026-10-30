import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LoaderCircle, Play, RotateCcw, Settings2 } from 'lucide-react';
import type { ArenaSession } from '../core/session';
import type { GameSettings } from '../core/settings';
import { SettingsPanel } from './SettingsPanel';
import { ArenaHUD, ArenaTelemetry } from './ArenaHUD';
import { useArenaValue } from './useArenaValue';
import { ActionControls } from './ActionControls';
import { InputManager } from '../input/InputManager';
import { ConfirmDialog } from './ConfirmDialog';
import { trapFocus } from './trapFocus';
import { HackPanel } from './HackPanel';
import { MissionResults } from './MissionResults';
import { BossHUD } from './BossHUD';
import '../missions.css';

export function ArenaView({ session, active, settings, reducedMotion, persisted, onSettingsChange, onMenu, onRestart, onEnd, validation = false }: {
  session: ArenaSession; active: boolean; settings: GameSettings; reducedMotion: boolean; persisted: boolean;
  onSettingsChange: (patch: Partial<GameSettings>) => void; onMenu: () => void; onRestart: () => void; onEnd: () => void; validation?: boolean;
}) {
  const status = useArenaValue(session, s => s.status), health = useArenaValue(session, s => s.health);
  const nearby = useArenaValue(session, s => s.nearby);
  const hacking = useArenaValue(session,s => Boolean(s.hack));
  const encounter = useArenaValue(session,s => Boolean(s.boss && !['DORMANT','DEFEATED'].includes(s.boss.state)));
  const wasHacking = useRef(false);
  const [panel, setPanel] = useState<'pause' | 'settings'>('pause'), [confirmRestart, setConfirmRestart] = useState(false);
  const host = useRef<HTMLDivElement>(null), resume = useRef<HTMLButtonElement>(null), pause = useRef<HTMLButtonElement>(null);
  const pausePanel = useRef<HTMLElement>(null);
  const activeRef = useRef(active); activeRef.current = active;
  useEffect(() => {
    let cancelled = false, destroy: (() => void) | undefined;
    const target = host.current;
    const startupTimeout = window.setInterval(() => {
      if (session.getSnapshot().status === 'loading' && performance.now() - session.lastLoadActivity > 45000) session.fail('Loading stopped responding. Return to the main menu and retry.');
    }, 1000);
    const stopWatch = session.subscribe(() => { if (session.getSnapshot().status !== 'loading') clearInterval(startupTimeout); });
    import('../game/createGame').then(({ createArena }) => {
      if (!cancelled && target && session.getSnapshot().status === 'loading') { session.loading('Starting the game renderer'); destroy = createArena(target, session); }
    }).catch(() => session.fail('The game engine could not load. Return to the main menu and retry.'));
    const input = target ? new InputManager(session, target, () => activeRef.current) : null;
    const blur = () => session.pause(), visibility = () => { if (document.hidden) session.pause(); };
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { cancelled = true; clearInterval(startupTimeout); stopWatch(); input?.dispose(); destroy?.(); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  }, [session]);
  useEffect(() => { session.setSettings(settings); }, [session, settings]);
  useEffect(() => { if (wasHacking.current && !hacking && status === 'playing') host.current?.querySelector('canvas')?.focus(); wasHacking.current = hacking; },[hacking,status]);
  useEffect(() => { session.setReducedMotion(reducedMotion); }, [session, reducedMotion]);
  useEffect(() => { if (!active) session.pause(); else if (session.getSnapshot().status === 'paused') session.resume(); }, [active, session]);
  useEffect(() => { if (!active && status === 'playing') session.pause(); }, [active, status, session]);
  useEffect(() => { if (status === 'paused') { setPanel('pause'); resume.current?.focus(); } }, [status]);
  useEffect(() => { if (status === 'paused' && panel === 'settings') pausePanel.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [panel, status]);
  useEffect(() => {
    if (!active) return;
    const nav = host.current?.closest('main.rivals-shell')?.nextElementSibling;
    if (!(nav instanceof HTMLElement) || nav.tagName !== 'NAV') return;
    const previousInert = nav.getAttribute('inert'), previousHidden = nav.getAttribute('aria-hidden');
    nav.setAttribute('inert', ''); nav.setAttribute('aria-hidden', 'true');
    return () => { if (previousInert === null) nav.removeAttribute('inert'); else nav.setAttribute('inert', previousInert); if (previousHidden === null) nav.removeAttribute('aria-hidden'); else nav.setAttribute('aria-hidden', previousHidden); };
  }, [active]);
  const resumeGame = () => { session.resume(); pause.current?.focus(); };
  return <section hidden={!active} className="rivals-game-view" data-active={active} data-status={status} data-contrast={settings.highContrast} data-motion={reducedMotion ? 'reduced' : 'full'} aria-label="RIVALS playable arena">
    <div ref={host} className="rivals-engine-host" data-testid="arena-host" /><div className="rivals-game-vignette" />
    <ArenaHUD session={session} onAudio={() => onSettingsChange({ muted: !settings.muted })} pauseRef={pause} />
    {status !== 'finished' && <BossHUD session={session} />}
    <div className="rivals-desktop-controls"><span><kbd>WASD</kbd> MOVE <kbd>SHIFT</kbd> SPRINT <kbd>SPACE</kbd> DODGE</span><span><kbd>CLICK</kbd> FIRE <kbd>R</kbd> RELOAD <kbd>E</kbd> INTERACT <kbd>ESC</kbd> PAUSE</span></div>
    {status === 'playing' && health > 0 && !hacking && <ActionControls session={session} visibility={settings.mobileControls} />}
    <HackPanel session={session} />
    {nearby && status !== 'finished' && (!encounter || nearby.id === 'vault-gate') && <aside className="rv-equipment-prompt" aria-label="Nearby equipment"><strong>{nearby.name}</strong><p role="status">{nearby.description}</p></aside>}
    <ArenaTelemetry session={session} />
    {status === 'loading' && <Loading session={session} onEnd={onEnd} />}
    {status === 'paused' && <div className="rivals-arena-overlay"><section ref={pausePanel} className="rivals-pause-panel rv-pause" role="dialog" aria-modal="true" aria-labelledby="rivals-pause-title" onKeyDown={event => {
      if (event.key === 'Escape' && panel === 'settings') { event.preventDefault(); setPanel('pause'); }
      trapFocus(event);
    }}>
      {panel === 'settings' ? <><button className="rivals-text-button" onClick={() => setPanel('pause')}><ArrowLeft size={15} />Back to pause menu</button><h2 id="rivals-pause-title">Field settings</h2><SettingsPanel settings={settings} onChange={onSettingsChange} persisted={persisted} /></> : <>
        <span className="rivals-overline">OPERATION ON HOLD</span><h2 id="rivals-pause-title">Take a breath.</h2><p>Your run is paused. All movement and mission time are suspended.</p>
        <button ref={resume} className="rivals-primary" onClick={resumeGame}><Play size={17} fill="currentColor" />RESUME GAME</button>
        <button className="rivals-secondary" onClick={() => setConfirmRestart(true)}><RotateCcw size={16} />RESTART MISSION</button>
        <button className="rivals-secondary" onClick={() => setPanel('settings')}><Settings2 size={16} />SETTINGS</button>
        <button className="rivals-secondary" onClick={onMenu}><ArrowLeft size={16} />RETURN TO MAIN MENU</button>
        <small className="rivals-pause-hint">Continue from the main menu to return to this paused run.</small>
      </>}
    </section></div>}
    {status === 'finished' && <MissionResults session={session} onRestart={() => setConfirmRestart(true)} onLobby={onEnd} />}
    {status === 'error' && <ErrorPanel session={session} onEnd={onEnd} />}
    {confirmRestart && <ConfirmDialog title="Restart this mission?" description="This resets your position, health, timer and local objective progress. Your account records are unaffected." confirmLabel="RESTART" onConfirm={() => { setConfirmRestart(false); onRestart(); }} onCancel={() => setConfirmRestart(false)} />}
    {validation && status === 'playing' && <details className="rv-validation"><summary>QA controls</summary><button onClick={() => session.applyDamage(25)}>Apply 25 damage</button><button onClick={() => session.applyDamage(100)}>Defeat operative</button><input aria-label="Input focus check" placeholder="Test input focus" /><label><input type="checkbox" onChange={event => session.setDebug(event.target.checked)} />AI diagnostics</label></details>}
  </section>;
}
function Loading({ session, onEnd }: { session: ArenaSession; onEnd: () => void }) {
  const stage = useArenaValue(session, s => s.loadingStage), progress = useArenaValue(session, s => s.progress);
  return <div className="rivals-arena-overlay" role="status"><div className="rivals-loading-mark"><LoaderCircle size={28} className="rivals-spin" /><span className="rivals-overline">ESTABLISHING UPLINK</span><h2>Entering the vault</h2><p>{stage} · {Math.round(progress * 100)}%</p><div className="rivals-progress"><span style={{ width: (progress * 100) + '%' }} /></div><button className="rivals-text-button" onClick={onEnd}>Return to main menu</button></div></div>;
}
function ErrorPanel({ session, onEnd }: { session: ArenaSession; onEnd: () => void }) {
  const error = useArenaValue(session, s => s.error);
  return <div className="rivals-arena-overlay"><div className="rivals-pause-panel" role="alert"><span className="rivals-overline">UPLINK INTERRUPTED</span><h2>Let's reconnect.</h2><p>{error}</p><button className="rivals-primary" onClick={onEnd}><RotateCcw size={17} />RETURN & RETRY</button></div></div>;
}
