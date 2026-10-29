import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowUpRight, LoaderCircle, Pause, Play, Radio, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { ArenaSession } from '../core/session';
import { MiniMap } from './MiniMap';
import { TouchStick } from './TouchStick';
import { CHARACTERS } from '../characters/definitions';
import { isQuality, QUALITY_PRESETS, type CharacterId, type QualityId } from '../core/presentation';

export function ArenaView({ onExit, characterId, quality, reducedMotion, onQuality }: { onExit: () => void; characterId: CharacterId; quality: QualityId; reducedMotion: boolean; onQuality: (id: QualityId) => void }) {
  const [session] = useState(() => new ArenaSession({ characterId, quality, reducedMotion }));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const host = useRef<HTMLDivElement>(null);
  const resumeButton = useRef<HTMLButtonElement>(null);
  const pauseButton = useRef<HTMLButtonElement>(null);
  const paused = snapshot.status === 'paused';

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const target = host.current;
    const startupTimeout = window.setInterval(() => {
      if (session.getSnapshot().status === 'loading' && performance.now() - session.lastLoadActivity > 45000) session.fail('Loading stopped responding. Check your connection and return to the lobby to retry.');
    }, 1000);
    const stopLoadingWatch = session.subscribe(() => { if (session.getSnapshot().status !== 'loading') window.clearInterval(startupTimeout); });
    import('../game/createGame').then(({ createArena }) => {
      if (!cancelled && target && session.getSnapshot().status === 'loading') { session.loading('Starting the game renderer'); destroy = createArena(target, session); }
    }).catch(() => session.fail('The game engine could not load. Check your connection and return to the lobby to retry.'));
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || event.repeat) return;
      event.preventDefault();
      if (session.getSnapshot().status === 'paused') session.resume(); else session.pause();
    };
    const blur = () => session.pause();
    const visibility = () => { if (document.hidden) session.pause(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelled = true; window.clearInterval(startupTimeout); stopLoadingWatch(); destroy?.();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [session]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => session.setReducedMotion(preference.matches);
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, [session]);

  useEffect(() => { if (paused) resumeButton.current?.focus(); }, [paused]);

  const clock = `${Math.floor(snapshot.elapsed / 60).toString().padStart(2, '0')}:${Math.floor(snapshot.elapsed % 60).toString().padStart(2, '0')}`;
  return <section className="rivals-game-view" aria-label="RIVALS playable arena" data-status={snapshot.status}>
    <div ref={host} className="rivals-engine-host" data-testid="arena-host" />
    <div className="rivals-game-vignette" />
    <header className="rivals-arena-hud">
      <div className="rivals-sector"><span className="rivals-overline">SOLO RECON / {CHARACTERS[snapshot.characterId].name}</span><strong>NEON VAULT</strong><span className="rivals-hud-subtitle">Explore the district. Learn the routes.</span></div>
      <div className="rivals-arena-tools"><span className="rivals-timer" aria-label="Session time">{clock}</span>
        <button className="rivals-icon-button" disabled={snapshot.status !== 'playing'} aria-label={snapshot.muted ? 'Enable ambient audio' : 'Mute ambient audio'} onClick={session.toggleMute}>{snapshot.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
        <button ref={pauseButton} className="rivals-icon-button" aria-label="Pause game" disabled={snapshot.status !== 'playing'} onClick={session.pause}><Pause size={19} /></button>
      </div>
    </header>
    <MiniMap player={snapshot.player} />
    <div className="rivals-field-note"><i /><span>RECONNAISSANCE ONLY<strong>No hostiles in this sector</strong></span></div>
    <div className="rivals-desktop-controls"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / ARROWS TO MOVE</span><span><kbd>ESC</kbd> PAUSE</span></div>
    {snapshot.status === 'playing' && <TouchStick disabled={false} onMove={vector => session.setMovement(vector)} />}
    {snapshot.nearby && <aside className="rivals-equipment" aria-label="Nearby equipment"><div><span>{snapshot.nearby.name}</span><p role="status">{snapshot.nearby.description}</p></div><button aria-label="Inspect nearby equipment" onClick={session.interact} disabled={snapshot.status !== 'playing'}><Radio size={23} /><small>INSPECT / E</small></button></aside>}
    <output className="rivals-telemetry" data-testid="arena-position" data-character={snapshot.characterId} data-quality={snapshot.quality} data-animation={snapshot.animation} data-frame={snapshot.animationFrame} data-facing={snapshot.facing} data-reduced-motion={snapshot.reducedMotion} data-fps={snapshot.metrics.fps.toFixed(2)} data-p95={snapshot.metrics.p95FrameMs.toFixed(2)} data-startup-ms={snapshot.metrics.startupMs.toFixed(1)} data-texture-bytes={snapshot.metrics.textureBytes} data-essential-bytes={snapshot.metrics.essentialBytes} data-render-scale={snapshot.metrics.renderScale} data-x={snapshot.player.x.toFixed(2)} data-y={snapshot.player.y.toFixed(2)} data-camera-x={snapshot.camera.x.toFixed(2)} data-camera-y={snapshot.camera.y.toFixed(2)} data-collisions={snapshot.collisions} aria-label="Player coordinates">{Math.round(snapshot.player.x)} : {Math.round(snapshot.player.y)}</output>
    {snapshot.status === 'loading' && <div className="rivals-arena-overlay" role="status"><div className="rivals-loading-mark"><LoaderCircle size={28} className="rivals-spin" /><span className="rivals-overline">ESTABLISHING UPLINK</span><h2>Entering the vault</h2><p>{snapshot.loadingStage} · {Math.round(snapshot.progress * 100)}%</p><div className="rivals-progress"><span style={{ width: `${snapshot.progress * 100}%` }} /></div><button className="rivals-text-button" onClick={onExit}><ArrowLeft size={15} /> Return to lobby</button></div></div>}
    {paused && <div className="rivals-arena-overlay"><section className="rivals-pause-panel" role="dialog" aria-modal="true" aria-labelledby="rivals-pause-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select, [href], [tabindex="0"]');
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    }}>
      <span className="rivals-overline">UPLINK ON HOLD</span><h2 id="rivals-pause-title">Take a breath.</h2><p>Your operative is safe. Resume when you’re ready.</p>
      <div className="rivals-pause-stats"><div><span>FIELD TIME</span><b>{clock}</b></div><div><span>DISTANCE</span><b>{Math.round(snapshot.distance / 64)} <small>tiles</small></b></div></div>
      <div className="rivals-graphics-panel"><label htmlFor="rivals-graphics">Graphics quality</label><select id="rivals-graphics" value={snapshot.quality} onChange={event => { if (isQuality(event.target.value)) { session.setQuality(event.target.value); onQuality(event.target.value); } }}>{Object.entries(QUALITY_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}</select><span>{snapshot.metrics.fps > 0 ? `${Math.round(snapshot.metrics.fps)} fps` : 'Measuring performance…'}{snapshot.reducedMotion ? ' · Reduced motion' : ''}</span></div>
      <button ref={resumeButton} className="rivals-primary" onClick={() => { session.resume(); pauseButton.current?.focus(); }}><Play size={17} fill="currentColor" /> RESUME RECON <ArrowUpRight size={18} /></button>
      <button className="rivals-secondary" onClick={onExit}><ArrowLeft size={16} /> RETURN TO LOBBY</button>
      <small className="rivals-pause-hint">WASD / ARROWS · MOVE &nbsp; ESC · RESUME</small>
    </section></div>}
    {snapshot.status === 'error' && <div className="rivals-arena-overlay"><div className="rivals-pause-panel" role="alert"><span className="rivals-overline">UPLINK INTERRUPTED</span><h2>Let’s reconnect.</h2><p>{snapshot.error}</p><button className="rivals-primary" onClick={onExit}><RotateCcw size={17} /> RETURN & RETRY</button></div></div>}
  </section>;
}
