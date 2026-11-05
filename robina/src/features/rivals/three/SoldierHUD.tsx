import { ArrowUp, Bomb, Crosshair, Shield, Wind, Zap } from 'lucide-react';
import type { SandboxSession } from './SandboxSession';
import type { RaidRuntime } from './RaidRuntime';
import { useArenaValue } from '../ui/useArenaValue';
import { TouchStick } from '../ui/TouchStick';
import { press } from './controlPress';
import { drivingStick } from './stickResponse';

function EquipmentGlyph({ id }: { id: string }) {
  return <svg className="r3-equipment-glyph" viewBox="0 0 88 30" aria-hidden="true" fill="currentColor">
    {id === 'knife' ? <><path d="M8 19L57 5l23 1-19 13-32 3-2 5-5 1-3-8-10 4z"/><path d="M29 19L60 10l12-1-14 8z" fill="#bfd5dc" opacity=".55"/></> : id === 'pistol' ? <><path d="M12 6h62v8H51l-6 4-3 11H28l4-14H15z"/><path d="M49 15v7H36v-3h9v-4z" fillRule="evenodd"/><path d="M18 7h51v3H18z" fill="#b2c9d0" opacity=".45"/></> : <><path d="M3 15l15-5h13V6h24v4h20v3h10v3H64l-4 4H48l4 10H41l-5-10h-9l-2 7H14l2-9H3z"/><path d="M34 4h14v3H34zM62 8h5v4h-5z"/><path d="M30 11h29v3H30z" fill="#b2c9d0" opacity=".45"/>{id === 'smg' && <path d="M53 19h7v10h-7z"/>}</>}
  </svg>;
}
export function SoldierControls({ session,runtime,pov }: { session: SandboxSession; runtime: RaidRuntime | undefined; pov: string }) {
  const state = useArenaValue(session,s => s.soldier),status = useArenaValue(session,s => s.status),cooldown = useArenaValue(session,s => s.dodgeCooldown),nearby = useArenaValue(session,s => s.nearby),sprint = useArenaValue(session,s => s.mobileSprint);
  const disabled = status !== 'playing' || Boolean(state?.blocked);
  if(runtime?.vehicles?.current)return <DrivingControls runtime={runtime} disabled={disabled}/>;
  return <div className="rv-controls r3-soldier-controls" data-mobile="auto">
    <TouchStick kind="move" disabled={disabled} onMove={session.setMovement}/>
    <TouchStick kind="aim" disabled={disabled} onMove={session.setAim} onPress={held => session.input.setFire(held && session.canControl())}/>
    <button className="rv-sprint-control rv-touch-only" disabled={disabled} aria-label="Toggle sprint" aria-pressed={sprint} {...press(session.toggleSprint)}><Wind size={19}/><span>{sprint ? 'SPRINT ON' : 'SPRINT'}</span></button>
    <div className="rv-action-buttons">
      <button className="r3-reload" aria-label="Reload weapon" disabled={disabled||Boolean(state?.slots[state.active]?.kind==='melee')} {...press(session.reload)}><span>↻</span><span>RELOAD</span></button>
      <button className="rv-dodge-control" aria-label="Dodge" disabled={disabled || cooldown > .01} {...press(session.dodge)}><Zap size={20}/><span>{cooldown > .01 ? cooldown.toFixed(1) + 's' : 'EVADE'}</span></button>
      <button className="rv-interact-control" aria-label="Inspect nearby equipment" disabled={disabled || !nearby} {...press(session.interact)}><Crosshair size={19}/><span>COLLECT</span></button>
      <button className="rv-fire-control" aria-label="Fire weapon" disabled={disabled} onClick={e => { if (e.detail === 0) { session.input.setFire(true); session.input.setFire(false); } }} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); session.input.setFire(true); }} onPointerUp={() => session.input.setFire(false)} onPointerCancel={() => session.input.setFire(false)} onLostPointerCapture={() => session.input.setFire(false)}><Crosshair size={22}/><span>FIRE</span></button>
      <button className="r3-bomb" aria-label="Throw bomb" disabled={disabled || !state?.canThrow} {...press(() => runtime?.throwBomb())}><Bomb size={20}/><b>{state?.bombs ?? 0}</b><span>GRENADE</span></button>
      <button className="r3-jump" aria-label="Jump" disabled={disabled} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); runtime?.holdJump(true); }} onPointerUp={() => runtime?.holdJump(false)} onPointerCancel={() => runtime?.holdJump(false)} onLostPointerCapture={() => runtime?.holdJump(false)} onClick={e => { if (e.detail === 0) runtime?.requestJump(); }}><ArrowUp size={20}/><span>HOLD JUMP</span></button>
      {(pov === 'first' || pov === 'third') && <button className="r3-ads" aria-label="Aim down sights" disabled={disabled || state?.slots[state.active]?.kind === 'melee'} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); if (runtime) runtime.rig.ads = true; }} onPointerUp={() => { if (runtime) runtime.rig.ads = false; }} onPointerCancel={() => { if (runtime) runtime.rig.ads = false; }} onLostPointerCapture={() => { if (runtime) runtime.rig.ads = false; }}><Crosshair size={19}/><span>SIGHTS</span></button>}
    </div>
  </div>;
}
export function DrivingControls({runtime,disabled}:{runtime:RaidRuntime;disabled:boolean}){
  const vehicle=runtime.vehicles!.snapshot;
  const release=(value:Parameters<RaidRuntime['setDriving']>[0])=>runtime.setDriving(Object.fromEntries(Object.keys(value).map(key=>[key,key==='brake'?false:0])));
  const held=(value:Parameters<RaidRuntime['setDriving']>[0])=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);runtime.setDriving(value);},onPointerUp:()=>release(value),onPointerCancel:()=>release(value),onLostPointerCapture:()=>release(value)});
  return <div className="r3-driving-controls" aria-label="Driving controls">
    <TouchStick kind="drive" disabled={disabled} onMove={vector=>runtime.setDriving({steer:drivingStick(vector).steer})}/>
    <output className="r3-speed">{vehicle.speed}<small>KM/H · {vehicle.kind?.toUpperCase()} · {vehicle.health} HP</small></output>
    <div className="r3-pedals"><button aria-label="Reverse vehicle" disabled={disabled} {...held({throttle:-1})}>REVERSE</button><button aria-label="Brake vehicle" disabled={disabled} {...held({brake:true})}>BRAKE</button><button aria-label="Accelerate vehicle" disabled={disabled} {...held({throttle:1})}>ACCELERATE</button></div>
    <span className="r3-drive-hint">JOYSTICK STEERS · PEDALS CONTROL SPEED</span>
    <button className="r3-exit-car" disabled={disabled} onClick={runtime.vehicleInteract}>EXIT VEHICLE · F</button>
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
