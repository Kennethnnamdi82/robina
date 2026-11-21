import { ArrowDown, ArrowUpFromLine, Bomb, CircleStop, Crosshair, Footprints, Gauge, Hand, LogOut, RotateCw, Shield, Zap } from 'lucide-react';
import type { SandboxSession } from './SandboxSession';
import type { RaidRuntime } from './RaidRuntime';
import { useArenaValue } from '../ui/useArenaValue';
import { TouchStick } from '../ui/TouchStick';
import { press } from './controlPress';
import {useEffect,useState} from 'react';
import {FpsTouchControls} from './FpsTouchControls';
import {useFireLook} from './useFireLook';
import {FireGlyph} from './FireGlyph';

function EquipmentGlyph({ id }: { id: string }) {
  return <svg className="r3-equipment-glyph" viewBox="0 0 88 30" aria-hidden="true" fill="currentColor">
    {id === 'knife' ? <><path d="M8 19L57 5l23 1-19 13-32 3-2 5-5 1-3-8-10 4z"/><path d="M29 19L60 10l12-1-14 8z" fill="#bfd5dc" opacity=".55"/></> : id === 'pistol' ? <><path d="M12 6h62v8H51l-6 4-3 11H28l4-14H15z"/><path d="M49 15v7H36v-3h9v-4z" fillRule="evenodd"/><path d="M18 7h51v3H18z" fill="#b2c9d0" opacity=".45"/></> : <><path d="M3 15l15-5h13V6h24v4h20v3h10v3H64l-4 4H48l4 10H41l-5-10h-9l-2 7H14l2-9H3z"/><path d="M34 4h14v3H34zM62 8h5v4h-5z"/><path d="M30 11h29v3H30z" fill="#b2c9d0" opacity=".45"/>{id === 'smg' && <path d="M53 19h7v10h-7z"/>}</>}
  </svg>;
}
export function SoldierControls({ session,runtime,pov }: { session: SandboxSession; runtime: RaidRuntime | undefined; pov: string }) {
  const state = useArenaValue(session,s => s.soldier),status = useArenaValue(session,s => s.status),cooldown = useArenaValue(session,s => s.dodgeCooldown),nearby = useArenaValue(session,s => s.nearby),sprint = useArenaValue(session,s => s.mobileSprint);
  const disabled = status !== 'playing' || Boolean(state?.blocked);
  const driving=Boolean(runtime?.vehicles?.current);
  const fire=useFireLook(session,runtime,disabled,pov==='first'||pov==='third');
  const [ads,setAds]=useState(false);
  useEffect(()=>{setAds(false);if(runtime)runtime.rig.ads=false;},[pov,disabled,runtime,driving,state?.active]);
  if(runtime?.vehicles?.current)return <DrivingControls runtime={runtime} disabled={disabled}/>;
  return <div className="rv-controls r3-soldier-controls" data-mobile="auto" data-pov={pov}>
    <TouchStick kind="move" disabled={disabled} onMove={session.setMovement}/>
    {pov==='first'?<FpsTouchControls session={session} runtime={runtime} disabled={disabled}/>:<TouchStick kind="aim" disabled={disabled} onMove={session.setAim} onPress={held => session.input.setFire(held && session.canControl())}/>}
    <div className="r3-action-controls">
      <button className="r3-touch-key r3-sprint rv-touch-only" disabled={disabled} aria-label="Toggle sprint" title="Sprint" aria-pressed={sprint} {...press(session.toggleSprint)}><Footprints aria-hidden="true"/></button>
      <button className="r3-touch-key r3-dodge" aria-label="Dodge" title={cooldown > .01 ? `Dodge ready in ${cooldown.toFixed(1)} seconds` : 'Dodge'} disabled={disabled || cooldown > .01} {...press(session.dodge)}><Zap aria-hidden="true"/></button>
      <button className="r3-touch-key r3-reload" aria-label="Reload weapon" title="Reload" disabled={disabled||Boolean(state?.slots[state.active]?.kind==='melee')} {...press(session.reload)}><RotateCw aria-hidden="true"/></button>
      {nearby && <button className="r3-touch-key r3-interact" aria-label="Inspect nearby equipment" title={nearby.name} disabled={disabled} {...press(session.interact)}><Hand aria-hidden="true"/></button>}
      {pov !== 'first' && <button className="r3-touch-key r3-trigger rv-touch-only" aria-label="Fire weapon" title="Fire" disabled={disabled} {...fire}><FireGlyph/></button>}
      <button className="r3-touch-key r3-bomb" aria-label="Throw bomb" aria-description={`${state?.bombs ?? 0} grenades`} title="Throw grenade" disabled={disabled || !state?.canThrow} {...press(() => runtime?.throwBomb())}><Bomb aria-hidden="true"/><b aria-hidden="true">{state?.bombs ?? 0}</b></button>
      <button className="r3-touch-key r3-jump" aria-label="Jump" title="Jump" disabled={disabled} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); runtime?.holdJump(true); }} onPointerUp={() => runtime?.holdJump(false)} onPointerCancel={() => runtime?.holdJump(false)} onLostPointerCapture={() => runtime?.holdJump(false)} onClick={e => { if (e.detail === 0) runtime?.requestJump(); }}><ArrowUpFromLine aria-hidden="true"/></button>
      {(pov === 'first' || pov === 'third') && <button className="r3-touch-key r3-ads" aria-label="Aim down sights" title="Aim down sights" aria-pressed={ads} disabled={disabled || state?.slots[state.active]?.kind === 'melee'} {...press(()=>{if(runtime){runtime.rig.ads=!runtime.rig.ads;setAds(runtime.rig.ads);}})}><Crosshair aria-hidden="true"/></button>}
    </div>
  </div>;
}
export function DrivingControls({runtime,disabled}:{runtime:RaidRuntime;disabled:boolean}){
  const vehicle=runtime.vehicles!.snapshot;
  const release=(value:Parameters<RaidRuntime['setDriving']>[0])=>runtime.setDriving(Object.fromEntries(Object.keys(value).map(key=>[key,key==='brake'?false:0])));
  const held=(value:Parameters<RaidRuntime['setDriving']>[0])=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);runtime.setDriving(value);},onPointerUp:()=>release(value),onPointerCancel:()=>release(value),onLostPointerCapture:()=>release(value)});
  return <div className="r3-driving-controls" aria-label="Driving controls">
    <TouchStick kind="drive" disabled={disabled} onMove={vector=>runtime.setDriving({stickX:vector.x,stickY:vector.y})}/>
    {vehicle.burning&&<strong className="r3-engine-warning" role="alert">ENGINE FIRE — EXIT NOW{vehicle.escapeSeconds!=null?' · '+Math.ceil(vehicle.escapeSeconds)+'s':''}</strong>}
    <div className="r3-drive-actions">
      <button className="r3-touch-key r3-reverse" aria-label="Reverse vehicle" title="Reverse" disabled={disabled} {...held({throttle:-1})}><ArrowDown aria-hidden="true"/></button>
      <button className="r3-touch-key r3-brake" aria-label="Brake vehicle" title="Brake" disabled={disabled} {...held({brake:true})}><CircleStop aria-hidden="true"/></button>
      <button className="r3-touch-key r3-accelerate" aria-label="Accelerate vehicle" title="Accelerate" disabled={disabled} {...held({throttle:1})}><Gauge aria-hidden="true"/></button>
      <button className="r3-touch-key r3-exit-car" aria-label="Exit vehicle" title="Exit vehicle · F" disabled={disabled} onClick={runtime.vehicleInteract}><LogOut aria-hidden="true"/></button>
    </div>
  </div>;
}
export function SoldierDock({ session,runtime }: { session: SandboxSession; runtime: RaidRuntime | undefined }) {
  const soldier = useArenaValue(session,s => s.soldier),weapon = useArenaValue(session,s => s.weapon),security = useArenaValue(session,s => s.security);
  if (!soldier) return null;
  const blocked = soldier.blocked || soldier.remaining > 0 || !session.canControl();
  return <><div className="r3-loadout" aria-label="Equipped loadout"><div className="r3-loadout-title"><span>FIELD LOADOUT</span><small>{soldier.action === 'idle' ? 'TAP TO EQUIP' : soldier.action.toUpperCase()}</small></div><div className="r3-slots" role="list">{soldier.slots.map((slot,i) => <div key={i} role="listitem" data-active={soldier.active === i}><button aria-label={'Equip Slot ' + (i + 1) + ': ' + (slot?.name ?? 'Empty')} aria-pressed={soldier.active === i} disabled={blocked || !slot} {...press(() => runtime?.switchWeapon(i))}><kbd>{i + 1}</kbd><EquipmentGlyph id={slot?.id ?? 'empty'}/><span>{slot ? ({ rifle: 'CARBINE',pistol: '9MM',smg: 'SMG',knife: 'KNIFE' } as Record<string,string>)[slot.id] : 'EMPTY'}<small>{slot?.kind === 'melee' ? 'MELEE' : slot ? slot.ammo + ' / ' + slot.reserve : 'AVAILABLE'}</small></span></button></div>)}</div><div className="r3-ammo" aria-label="Ammunition reserve">{weapon?.ammo === null ? 'KNIFE / CLOSE QUARTERS' : <><b>{String(weapon?.ammo ?? 0).padStart(2,'0')}</b><span>/ {weapon?.capacity}</span><i/><span>{weapon?.reserve ?? 0} <small>RESERVE</small></span>{weapon?.reloading ? <strong>AUTO RELOAD</strong> : null}</>}</div></div>
    {soldier.notice && <div className="r3-notice" role="status">{soldier.notice}</div>}
    {security.alarm && <div className="r3-alarm" role="status"><Shield size={13}/> AEGIS ALERT / {Math.ceil(security.seconds)}s</div>}
  </>;
}
