import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, ZoomIn, Play, RotateCcw } from 'lucide-react';
import { nextOperation,type Operation3D } from './Operations';
import { SandboxSession } from './SandboxSession';
import { RaidRuntime, type Diagnostics3D } from './RaidRuntime';
import {preloadRaidAssets} from './RaidAssets';
import { MissionLoading } from './MissionLoading';
import { MissionRadar } from './MissionRadar';
import { DirectionGuide } from './DirectionGuide';
import {GraphicsChooser,readGraphicsQuality,saveGraphicsQuality} from './GraphicsChooser';
import { ArenaHUD, ArenaTelemetry } from '../ui/ArenaHUD';
import { SoldierControls, SoldierDock } from './SoldierHUD';
import { press } from './controlPress';
import { HackPanel } from '../ui/HackPanel';
import { BossHUD } from '../ui/BossHUD';
import { useArenaValue } from '../ui/useArenaValue';
import { defaultSettings } from '../core/settings';
import { missionTime, type QualityId } from '../core/presentation';
import { trapFocus } from '../ui/trapFocus';
import type { CityWeather } from './LivingCityPlan';
import type { HubPreferences } from '../hub/model';
import type { MissionSnapshot } from '../missions/types';
import '../rivals.css';
import '../missions.css';
import './sandbox.css';
import './command-hud.css';
import './gameplay-clarity.css';

function newSession(operation?:Operation3D,preferences?:HubPreferences){const quality=preferences?.quality ?? readGraphicsQuality();return new SandboxSession({quality,settings:preferences ?? {...defaultSettings(),quality,muted:false,mobileControls:'auto'}},operation);}
interface RaidAppProps {
  development?: boolean; operation?: Operation3D; preferences?: HubPreferences;
  onResult?: (mission: MissionSnapshot,venue: number) => void; onExit?: () => void;
  renderWelcome?: (controls: { enter: () => void; preparing: boolean; error: string }) => ReactNode;
  renderSettings?: (back: () => void) => ReactNode;
}
export default function RaidApp({ development = false, operation, preferences, onResult, onExit, renderWelcome, renderSettings }: RaidAppProps) {
  useEffect(()=>{const timer=window.setTimeout(()=>{void preloadRaidAssets();},250);return()=>clearTimeout(timer);},[]);
  const [session,setSession] = useState(() => newSession(operation,preferences)),[generation,setGeneration] = useState(0),[entered,setEntered] = useState(false);
  const resultCallback=useRef(onResult);resultCallback.current=onResult;
  const recorded=useRef(new Set<string>());
  const capture=useCallback(()=>{const result=session.mission.snapshot();if(!resultCallback.current||result.elapsed<=0||!['SUCCESS','FAILED','ABANDONED'].includes(result.state)||recorded.current.has(result.runId))return;recorded.current.add(result.runId);resultCallback.current(result,session.operation.assignment??session.operation.venue);},[session]);
  useEffect(()=>session.subscribe(capture),[session,capture]);
  const quality=useArenaValue(session,s=>s.quality);
  const [preparing,setPreparing] = useState(false),[preparation,setPreparation]=useState(.1),[launchError,setLaunchError] = useState('');
  const launch = useRef(0);
  const lifetime = useRef(0);
  useEffect(() => {
    const ticket = ++lifetime.current;
    return () => { queueMicrotask(() => { if (lifetime.current === ticket) { launch.current++; session.dispose(); capture(); } }); };
  }, [session,capture]);
  const enter = async () => {
    session.startAudio();
    if (development) { setEntered(true); return; }
    // Keep production transport outside the unchanged runtime's 60s model
    // preparation deadline. The same shared byte cache powers welcome prefetch.
    const ticket = ++launch.current;
    setPreparing(true); setLaunchError('');
    try {
      await preloadRaidAssets(value=>setPreparation(.1+value*.5));
      if (launch.current === ticket) setEntered(true);
    } catch {
      if (launch.current === ticket) setLaunchError('Mission preparation was interrupted. Check your connection and retry.');
    } finally {
      if (launch.current === ticket) setPreparing(false);
    }
  };
  const restart = (completed = false) => { if(completed && session.mission.snapshot().state !== 'SUCCESS') return; const operation=nextOperation(session.operation,completed); session.dispose(); capture(); const next = newSession(operation,preferences); next.startAudio(); setSession(next); setGeneration(n => n + 1); setEntered(true); };
  if(!entered&&preparing)return <MissionLoading progress={preparation} title={session.operation.mission.name} message="Entering the city" onCancel={()=>{launch.current++;setPreparing(false);onExit?.();}}/>;
  if(!entered && renderWelcome)return <>{renderWelcome({enter,preparing,error:launchError})}</>;
  if (!entered) return <main className="r3-welcome"><span>{development ? 'RIVALS / DEVELOPMENT ONLY' : 'RIVALS / RIVAL HEIST'}</span><h1>One heist.<br/><em>Four perspectives.</em></h1><p>Enter an outdoor city with living traffic, pedestrians and four camera perspectives. Missions are practice runs: no currency, rankings or account rewards are changed.</p><GraphicsChooser value={quality} onChange={value=>{saveGraphicsQuality(value);session.setQuality(value);}}/><button disabled={preparing} aria-busy={preparing} onClick={enter}><Play size={18}/>{preparing ? 'PREPARING MISSION…' : 'ENTER 3D RAID'}</button>{preparing && <p role="status">Preparing mission assets. You can return to base while they load.</p>}{launchError && <p role="alert">{launchError}</p>}<a href={development ? "/tests/rivals/index.html" : "/gaming?engine=2d"}>PLAY CLASSIC 2D</a>{!development && <a href="/">RETURN TO BASE</a>}<small>WASD move · mouse aim/fire · 1/2/3 equip · Auto reload · G grenade · E collect · Space dodge · Tap J jump; double-tap for high jump · V cycle view · Z zoom. On mobile: left stick moves, right stick aims/fires. Swipe the playfield to look in FPS/TPS. Double-tap Jump for obstacle traversal. F enters or exits nearby vehicles.</small></main>;
  return <Raid key={generation} development={development} preferences={preferences} renderSettings={renderSettings} session={session} restart={() => restart()} next={() => restart(true)} exit={() => { session.dispose(); capture(); if(onExit){onExit();return;} setEntered(false); setSession(newSession()); }} />;
}
function SandboxAudio({ session }: { session: SandboxSession }) {
  const settings = useArenaValue(session,s => s.settings);
  const [lighting,setLighting]=useState(session.cityLighting);
  return <><fieldset className="r3-audio-settings"><legend>AUDIO MIX</legend>{(['masterVolume','musicVolume','sfxVolume'] as const).map((key,index) => <label key={key}>{['Master','Music','Combat & effects'][index]}<input aria-label={['Master volume','Music volume','Combat effects volume'][index]} type="range" min="0" max="1" step=".05" value={settings[key]} onChange={e => session.setSettings({ ...settings,[key]: Number(e.target.value) })}/></label>)}<label><input type="checkbox" checked={settings.muted} onChange={e => session.setSettings({ ...settings,muted: e.target.checked })}/> Mute all audio</label></fieldset><fieldset className="r3-audio-settings"><legend>CITY ATMOSPHERE</legend><label>Lighting<select aria-label="City lighting" value={lighting} onChange={e=>{const value=e.target.value as CityWeather;setLighting(value);session.cityLighting=value;session.onCityLighting?.(value);}}><option value="golden">GOLDEN HOUR</option><option value="daylight">DAYLIGHT</option><option value="night">AFTER DARK</option></select></label></fieldset></>;
}
function Raid({ session,restart,next,exit,development,preferences,renderSettings }: { session: SandboxSession; restart: () => void; next: () => void; exit: () => void; development: boolean; preferences?:HubPreferences;renderSettings?:(back:()=>void)=>ReactNode }) {
  const host = useRef<HTMLDivElement>(null),runtime = useRef<RaidRuntime>(),pause = useRef<HTMLButtonElement>(null);
  const status = useArenaValue(session,s => s.status),progress = useArenaValue(session,s => s.progress),error = useArenaValue(session,s => s.error),mission = useArenaValue(session,s => s.mission),nearby = useArenaValue(session,s => s.nearby);
  const [metrics,setMetrics] = useState<Diagnostics3D>(),[quality,setQuality] = useState<QualityId>(()=>session.getSnapshot().quality);
  const [monitor,setMonitor] = useState(preferences?.monitor ?? false),[settingsOpen,setSettingsOpen]=useState(false);
  const soldier = useArenaValue(session,s => s.soldier);
  const dialog = useRef<HTMLElement>(null),settingsDialog=useRef<HTMLDivElement>(null);
  const lifetime = useRef(0);
  useEffect(() => {
    const ticket = ++lifetime.current;
    try { if (!runtime.current) runtime.current = new RaidRuntime(host.current!,session,setMetrics); } catch (e) { session.audio?.pause(true); session.combatAudio?.pause(true); session.fail(e instanceof Error ? e.message : '3D graphics unavailable.'); }
    // StrictMode replays effects; only release resources on a real departure.
    return () => { queueMicrotask(() => { if (lifetime.current !== ticket) return; runtime.current?.dispose(); runtime.current = undefined; }); };
  },[session]);
  useEffect(()=>{
    if(!preferences)return;
    session.setSettings(preferences);session.setReducedMotion(preferences.motion==='reduce'||matchMedia('(prefers-reduced-motion: reduce)').matches);
    setMonitor(preferences.monitor);
    if(runtime.current){runtime.current.rig.sensitivity=preferences.sensitivity;}
    if(preferences.lighting!=='mission'){session.cityLighting=preferences.lighting;session.onCityLighting?.(preferences.lighting);}
  },[preferences,session]);
  const defaultPOV=preferences?.pov;
  useEffect(()=>{if(defaultPOV)runtime.current?.setPOV(defaultPOV);},[defaultPOV,session]);
  useEffect(() => { if(settingsOpen)settingsDialog.current?.querySelector<HTMLButtonElement>('button')?.focus();else if (['paused','finished','error'].includes(status)) dialog.current?.querySelector<HTMLButtonElement>('button')?.focus(); },[status,settingsOpen]);
  useEffect(() => { if (soldier?.replacement) dialog.current?.querySelector<HTMLButtonElement>('button')?.focus(); },[soldier?.replacement]);
  const audio = () => session.setSettings({ ...session.getSnapshot().settings,muted: !session.getSnapshot().muted });
  const terminal = status === 'finished';
  return <main className="rivals-shell r3-shell" data-motion="reduced" data-campaign={session.operation.assignment!==undefined} data-debug={monitor} onKeyDown={e => { if (e.code === 'Space' && e.target instanceof Element && e.target.closest('button')) e.stopPropagation(); }}><section className="rivals-game-view r3-game" data-contrast={preferences?.highContrast} data-status={status} aria-label={development ? "RIVALS 3D development raid" : "RIVALS 3D raid"}>
    <div ref={host} className="rivals-engine-host" data-testid="three-host"/>
    <ArenaHUD session={session} onAudio={audio} pauseRef={pause} securityOnMap level={session.operation.level}/><MissionRadar session={session} metrics={metrics}/><BossHUD session={session}/>
    {status==='playing'&&<DirectionGuide metrics={metrics}/>}
    {status==='playing'&&<><aside className="r3-dispatch" aria-live="polite">{metrics?.pursuit?.active?`POLICE RESPONSE / ${metrics.pursuit.units} UNITS${metrics.pursuit.evading>0?' / BREAKING CONTACT':''}`:metrics?.pursuit?.lost?'PURSUIT LOST / PROCEED TO EXTRACTION':metrics?.campaign?.carrying?'OBJECTIVE SECURED':'FOLLOW THE OBJECTIVE MARKER'}</aside>{!metrics?.vehicle?.driving&&metrics?.vehicle?.nearby&&<button className="r3-enter-car" onClick={()=>runtime.current?.vehicleInteract()}>ENTER {metrics.vehicle.nearby.toUpperCase()} · F</button>}</>}
    <div className="r3-utility"><button aria-label="Cycle camera view" title="Cycle view (V)" disabled={status !== 'playing' || Boolean(soldier?.replacement)} {...press(() => runtime.current?.cyclePOV())}><Camera size={18}/><span>{metrics?.pov === 'first' ? 'FPS' : metrics?.pov === 'third' ? 'TPS' : metrics?.pov === 'side' ? 'SIDE' : 'VIEW'}</span></button><button aria-label="Camera zoom" title="Cycle zoom (Z)" disabled={status !== 'playing'} {...press(() => runtime.current?.zoom())}><ZoomIn size={18}/><span>{(metrics?.zoom ?? 1).toFixed(1)}×</span></button></div>
    {status === 'playing' && <><SoldierControls session={session} runtime={runtime.current} pov={metrics?.pov ?? 'tactical'}/><SoldierDock session={session} runtime={runtime.current}/></>}
    {soldier?.replacement && <div className="rivals-arena-overlay r3-modal"><section ref={dialog} className="rivals-pause-panel" role="dialog" aria-modal="true" aria-label="Replace weapon" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); runtime.current?.replacePickup(); } else trapFocus(e); }}><span className="rivals-overline">RECOVERED EQUIPMENT</span><h2>Replace weapon</h2><p>Choose one slot. Your other weapons and ammunition stay equipped.</p>{soldier.slots.map((slot,i) => <button className="rivals-secondary" key={i} onClick={() => runtime.current?.replacePickup(i)}>Replace Slot {i + 1}: {slot?.name ?? 'Empty'}</button>)}<button className="rivals-secondary" onClick={() => runtime.current?.replacePickup()}>Cancel</button></section></div>}
    {nearby && status === 'playing' && <aside className="rv-equipment-prompt" aria-label="Nearby equipment"><strong>{nearby.name}</strong><p>{nearby.description}</p></aside>}
    <HackPanel session={session}/><ArenaTelemetry session={session}/>
    <output className="r3-diagnostics" data-testid="three-state" data-operation={JSON.stringify({seed:session.operation.seed,ordinal:session.operation.ordinal,venue:session.operation.venue,name:session.operation.mission.name,fingerprint:session.operation.fingerprint})} data-environment={JSON.stringify(metrics?.environment ?? null)} data-quality={metrics?.quality ?? 'low'} data-vehicle={JSON.stringify(metrics?.vehicle??null)} data-navigation={JSON.stringify(metrics?.navigation??null)} data-pursuit={JSON.stringify(metrics?.pursuit??null)} data-combat={JSON.stringify(metrics?.combat ?? null)} data-character={JSON.stringify(metrics?.character ?? null)} data-pov={metrics?.pov ?? 'tactical'} data-zoom={metrics?.zoom ?? 1} data-x={metrics?.x ?? 7.2} data-y={metrics?.y ?? 0} data-z={metrics?.z ?? 7.2} data-grounded={String(metrics?.grounded ?? true)} data-run={metrics?.runId ?? ''} data-enemy-count={metrics?.enemies ?? 3} data-fps={metrics?.fps ?? 0} data-draw-calls={metrics?.calls ?? 0} data-triangles={metrics?.triangles ?? 0} data-geometries={metrics?.geometries ?? 0} data-textures={metrics?.textures ?? 0} data-frame-ms={metrics?.frameMs ?? 0} data-dpr={metrics?.dpr ?? 1} data-targets={JSON.stringify(metrics?.targets ?? [])}>{metrics ? `${metrics.pov.toUpperCase()} · ${metrics.fps.toFixed(0)} FPS · p95 ${metrics.frameMs.toFixed(1)}ms · ${metrics.calls} calls · ${Math.round(metrics.triangles / 1000)}k tris · DPR ${metrics.dpr.toFixed(2)}` : 'Loading supplied 3D models'}</output>
    <div className="r3-reticle" aria-hidden="true">+</div>
    {status === 'loading' && <MissionLoading progress={.6+progress*.4} title={session.operation.mission.name} message={progress>.95?'Entering operation':'Entering the city'} onCancel={exit}/>}
    {(status === 'paused' || terminal || status === 'error') && !settingsOpen && <div className="rivals-arena-overlay r3-modal"><section ref={dialog} className="rivals-pause-panel" role="dialog" aria-modal="true" aria-labelledby="r3-dialog-title" onKeyDown={trapFocus}><span className="rivals-overline">OPERATIONS COMMAND</span><h2 id="r3-dialog-title">{status === 'error' ? 'Connection interrupted' : terminal ? mission?.state === 'SUCCESS' ? 'Mission completed' : 'Mission failed' : 'Raid paused'}</h2><p>{status === 'error' ? error : terminal ? `${mission?.reason || 'Objective delivered. Extraction confirmed.'} Field time ${missionTime(mission?.elapsed ?? 0)}. Objectives ${mission?.completed}/${mission?.mandatory}.` : 'Take a breath — your mission is paused'}</p>{terminal&&mission?.state==='FAILED'&&metrics?.campaign&&<p role="status">{metrics.campaign.recoveredByPolice?'POLICE RECOVERED THE OBJECTIVE':metrics.campaign.carrying?'POLICE RESPONSE / RECOVERING DROPPED EVIDENCE':'OBJECTIVE NOT EXTRACTED'}</p>}{terminal && <p>{renderSettings ? 'Operation saved to your dossier' : 'Operation complete'}</p>}{status === 'paused' && (renderSettings ? <button className="rivals-secondary" onClick={()=>setSettingsOpen(true)}>SETTINGS</button> : <><SandboxAudio session={session}/><fieldset className="r3-audio-settings"><legend>CAMERA & GRAPHICS</legend><label><input type="checkbox" checked={monitor} onChange={e => setMonitor(e.target.checked)}/> Performance monitor</label><label>Graphics<select aria-label="3D graphics quality" value={quality} onChange={e => { const value = e.target.value as QualityId; setQuality(value);saveGraphicsQuality(value);session.setQuality(value); }}><option value="low">LOW</option><option value="balanced">MEDIUM</option><option value="high">HIGH</option></select></label><label>Look sensitivity<input aria-label="Camera sensitivity" type="range" min=".4" max="2" step=".1" defaultValue={runtime.current?.rig.sensitivity ?? 1} onChange={e => { if (runtime.current) runtime.current.rig.sensitivity = Number(e.target.value); }}/></label><small>Swipe the playfield or right-drag the mouse to look. The fire stick aims without turning the camera.</small></fieldset></>)}{status === 'paused' && <button className="rivals-primary" onClick={session.resume}>RESUME RAID</button>}{terminal && mission?.state === 'SUCCESS' && <button className="rivals-primary" onClick={next}>NEXT MISSION</button>}<button className="rivals-secondary" onClick={restart}><RotateCcw size={15}/> RETRY MISSION</button><button className="rivals-secondary" onClick={exit}>RETURN TO GAME MENU</button>{!renderSettings && <><a className="rivals-secondary" href={development ? "/tests/rivals/index.html" : "/gaming?engine=2d"}>PLAY CLASSIC 2D</a>{!development && <a className="rivals-secondary" href="/">RETURN TO BASE</a>}</>}</section></div>}
    {settingsOpen && renderSettings && <div ref={settingsDialog} className="rh-game-settings-overlay rh-app" role="dialog" aria-modal="true" aria-label="Raid settings" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setSettingsOpen(false);}else trapFocus(e);}}>{renderSettings(()=>setSettingsOpen(false))}</div>}
  </section></main>;
}
