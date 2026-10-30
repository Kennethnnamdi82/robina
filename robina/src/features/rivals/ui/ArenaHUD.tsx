import { memo, useEffect, useRef } from 'react';
import { Check, Crosshair, Pause, Shield, Volume2, VolumeX } from 'lucide-react';
import type { ArenaSession } from '../core/session';
import { CHARACTERS } from '../characters/definitions';
import { missionTime } from '../core/presentation';
import { useArenaValue } from './useArenaValue';
import { MiniMap } from './MiniMap';

const formatTime = (seconds: number) => Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');
function Vitals({ session }: { session: ArenaSession }) {
  const health = useArenaValue(session, s => s.health), maximum = useArenaValue(session, s => s.maxHealth);
  const shield = useArenaValue(session, s => s.shield), weapon = useArenaValue(session, s => s.weapon);
  const character = useArenaValue(session, s => s.characterId);
  return <div className="rv-vitals"><div className="rv-health-title"><strong>{CHARACTERS[character].name}</strong><span aria-label="Health value">{health} / {maximum} HP</span></div><div className="rv-health-track" role="progressbar" aria-label="Health" aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={health}><i style={{ width: (health / maximum * 100) + '%' }} /></div>
    {shield && <div className="rv-shield"><Shield size={12} />{shield.current} / {shield.maximum}</div>}
    <div className="rv-weapon" aria-label="Equipped weapon"><Crosshair size={13} /><span>{weapon?.name ?? 'EQUIPPING'}</span>{weapon?.ammo !== null && weapon?.ammo !== undefined && <span>{weapon.reloading ? 'RELOADING' : weapon.ammo + ' / ' + weapon.capacity}</span>}</div>
  </div>;
}
function Objective({ session }: { session: ArenaSession }) {
  const activeId = useArenaValue(session,s => s.mission?.activeId), completed = useArenaValue(session,s => s.mission?.completed ?? 0);
  const success = useArenaValue(session,s => s.mission?.state === 'SUCCESS');
  const objective = session.mission.definition.objectives.find(o => o.id === activeId);
  return <div className={'rv-objective' + (success ? ' rv-objective-complete' : '')} aria-label="Active objective">{success ? <Check size={14} /> : <Crosshair size={14} />}<span><small>{objective?.stage ?? 'THE LAUNCH / NEON DISTRICT'}</small><strong>{objective?.title ?? 'Insertion complete'}</strong></span><b aria-label="Objective progress">{completed} / {session.mission.definition.objectives.filter(o => !o.optional).length}</b></div>;
}
function Clock({ session }: { session: ArenaSession }) {
  const elapsed = useArenaValue(session, s => Math.floor(s.elapsed));
  const remaining = useArenaValue(session, s => s.mission?.remaining === null || s.mission?.remaining === undefined ? null : Math.ceil(s.mission.remaining));
  return <span className={'rivals-timer' + (remaining !== null && remaining <= 60 ? ' rv-clock-warning' : '')} aria-label="Session time" title={remaining === null ? 'Elapsed field time / no deadline' : 'Challenge time remaining'}>{remaining === null ? formatTime(elapsed) : '↓ ' + missionTime(remaining)}</span>;
}
function PositionMap({ session }: { session: ArenaSession }) {
  const player = useArenaValue(session, s => s.player);
  const world = useArenaValue(session, s => s.world);
  const activeId = useArenaValue(session,s => s.mission?.activeId);
  const objective = session.mission.definition.objectives.find(o => o.id === activeId);
  return <MiniMap player={player} openDoors={world.openDoors} objective={objective?.marker} />;
}
function FieldStatus({ session }: { session: ArenaSession }) {
  const worldMessage = useArenaValue(session, s => s.world.message), combat = useArenaValue(session, s => s.combat);
  const securityMessage = useArenaValue(session,s => s.security.message), core = useArenaValue(session,s => s.world.core);
  return <aside className="rv-field-status" aria-label="Field status"><span role="status">{core ? worldMessage : securityMessage}</span><small>{combat.hits} HITS · {combat.kills} / {combat.targetHealth.length} TARGETS DISABLED · FIELD TRAINING</small></aside>;
}
function HitFeedback({ session }: { session: ArenaSession }) {
  const serial = useArenaValue(session, s => s.combat.hitSerial);
  return serial > 0 ? <div className="rv-hit-feedback" key={serial} aria-label="Hit confirmation">✛<span>CONFIRMED</span></div> : null;
}
function SecurityStatus({ session }: { session: ArenaSession }) {
  const security = useArenaValue(session,s => s.security), enemies = useArenaValue(session,s => s.enemies);
  return <aside className="rv-security-status" data-alarm={security.alarm} aria-label="Security link"><strong>{security.alarm ? '⚠ ALARM / ' + Math.ceil(security.seconds) + 's' : '◇ SECURITY NETWORK'}<span>{enemies.filter(e => e.health > 0).length} GUARDS</span></strong>
    <p aria-label="Phase window">PHASE {security.linked ? 'LINKED ✓' : (security.phase === 'ACTIVE' ? 'OPEN ' : security.phase === 'WARNING' ? 'READY ' : 'WAIT ') + security.window.toFixed(1) + 's'}{security.linkRemaining > 0 && ' · LINK ' + security.linkRemaining.toFixed(1) + 's'}</p>
    <small>SECTOR {security.hacks ? '✓' : 'LOCKED'} · RELAYS {security.relays}/2{security.disabled.length > 0 && ' · GRID SUPPRESSED'}</small>
  </aside>;
}
function DamageFeedback({ session }: { session: ArenaSession }) {
  const damage = useArenaValue(session, s => s.damage);
  return damage.serial > 0 ? <div key={damage.serial} className="rv-damage-feedback" aria-label="Damage indicator"><span style={{ transform: 'rotate(' + damage.angle + 'rad)' }} /><b role="status">−{damage.amount} HP</b></div> : null;
}
export const ArenaHUD = memo(function ArenaHUD({ session, onAudio, pauseRef }: { session: ArenaSession; onAudio: () => void; pauseRef: React.RefObject<HTMLButtonElement> }) {
  const status = useArenaValue(session, s => s.status), muted = useArenaValue(session, s => s.muted);
  return <><header className="rv-game-hud"><div className="rv-hud-left"><Vitals session={session} /><Objective session={session} /></div><div className="rivals-arena-tools"><Clock session={session} /><button className="rivals-icon-button" disabled={status !== 'playing'} aria-label={muted ? 'Enable ambient audio' : 'Mute ambient audio'} onClick={onAudio}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><button ref={pauseRef} className="rivals-icon-button" aria-label="Pause game" disabled={status !== 'playing'} onClick={session.pause}><Pause size={19} /></button></div></header><FieldStatus session={session} /><SecurityStatus session={session} /><PositionMap session={session} /><DamageFeedback session={session} /><HitFeedback session={session} /></>;
});

/** QA telemetry updates DOM attributes at the throttled session cadence, not React state. */
export function ArenaTelemetry({ session }: { session: ArenaSession }) {
  const output = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const paint = () => {
      const node = output.current; if (!node) return;
      const s = session.getSnapshot(), data: Record<string,string> = {};
      data.renderer = s.metrics.renderer ?? 'pending';
      data.missionState = s.mission?.state ?? 'NOT_STARTED'; data.missionMode = s.mission?.mode ?? 'standard';
      data.missionCompleted = String(s.mission?.completed ?? 0); data.missionRemaining = String(s.mission?.remaining ?? 'none');
      data.missionElapsed = String(s.mission?.elapsed ?? 0); data.practiceXP = String(s.mission?.practiceXP ?? 0);
      data.boss = JSON.stringify(s.boss); data.bossState = s.boss?.state ?? 'DORMANT'; data.bossPhase = s.boss?.phase ?? 'A'; data.bossHealth = String(s.boss?.health ?? 450);
      const values = { character: s.characterId, quality: s.quality, animation: s.animation, frame: s.animationFrame, facing: s.facing, reducedMotion: s.reducedMotion, fps: s.metrics.fps.toFixed(2), p95: s.metrics.p95FrameMs.toFixed(2), startupMs: s.metrics.startupMs.toFixed(1), textureBytes: s.metrics.textureBytes, essentialBytes: s.metrics.essentialBytes, renderScale: s.metrics.renderScale, x: s.player.x.toFixed(2), y: s.player.y.toFixed(2), cameraX: s.camera.x.toFixed(2), cameraY: s.camera.y.toFixed(2), collisions: s.collisions, health: s.health, cooldown: s.dodgeCooldown.toFixed(3), dodgeSerial: s.dodgeSerial, sprinting: s.sprinting, aiming: s.aiming, aimAngle: s.aimAngle.toFixed(3) };
      for (const [key, value] of Object.entries(values)) data[key] = String(value);
      data.speed = Math.hypot(s.velocity.x, s.velocity.y).toFixed(2);
      data.runId = String(session.startedAt);
      data.shots = String(s.combat.shots); data.hits = String(s.combat.hits); data.kills = String(s.combat.kills);
      data.projectiles = String(s.combat.projectiles); data.targets = s.combat.targetHealth.join(',');
      data.ammo = String(s.weapon?.ammo ?? 0); data.reload = String(s.weapon?.reloading ?? 0);
      data.doors = s.world.openDoors.join(','); data.core = String(s.world.core); data.extracted = String(s.world.extracted);
      data.worldRevision = String(s.world.revision); data.rangeActive = String(s.world.rangeActive);
      data.cameraZoom = String(s.camera.zoom ?? 1); data.viewX = String(s.camera.left ?? 0); data.viewY = String(s.camera.top ?? 0);
      data.enemyStates = s.enemies.map(e => e.id + ':' + e.state).join(','); data.enemyHealth = s.enemies.map(e => e.health).join(',');
      data.enemies = JSON.stringify(s.enemies);
      data.damageAmount = String(s.damage.amount);
      data.enemyShots = String(s.enemies.reduce((sum,e) => sum + e.shots,0)); data.enemyDeaths = String(s.enemies.reduce((sum,e) => sum + e.deaths,0));
      data.alarm = String(s.security.alarm); data.alarmSerial = String(s.security.serial); data.phase = s.security.phase; data.phaseWindow = s.security.window.toFixed(2); data.phaseLink = String(s.security.linked);
      data.relays = String(s.security.relays); data.hacks = String(s.security.hacks); data.disabled = s.security.disabled.join(','); data.hacking = String(Boolean(s.hack)); data.debug = String(s.debug);
      for (const [key,value] of Object.entries(data)) if (node.dataset[key] !== value) node.dataset[key] = value;
      const label = Math.round(s.player.x) + ' : ' + Math.round(s.player.y);
      if (node.textContent !== label) node.textContent = label;
    };
    paint(); return session.subscribe(paint);
  }, [session]);
  return <output ref={output} className="rivals-telemetry" data-testid="arena-position" aria-label="Player coordinates" />;
}
