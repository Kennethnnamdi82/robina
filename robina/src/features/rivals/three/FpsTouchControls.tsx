import {useEffect,useRef} from 'react';
import {Crosshair} from 'lucide-react';
import type {SandboxSession} from './SandboxSession';
import type {RaidRuntime} from './RaidRuntime';

/** Independent pointer ownership allows move + look + trigger simultaneously. */
export function FpsTouchControls({session,runtime,disabled}:{session:SandboxSession;runtime:RaidRuntime|undefined;disabled:boolean}){
  const look=useRef<{id:number;x:number;y:number}|null>(null),trigger=useRef<number|null>(null);
  useEffect(()=>{if(disabled){look.current=null;trigger.current=null;session.input.setFire(false);}return()=>{look.current=null;trigger.current=null;session.input.setFire(false);};},[session,disabled]);
  const release=(id:number)=>{if(trigger.current===id){trigger.current=null;session.input.setFire(false);}};
  return <>
    <div className="r3-fps-look" role="group" aria-label="Swipe to look" data-testid="fps-look-area"
      onPointerDown={e=>{if(disabled||look.current)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);look.current={id:e.pointerId,x:e.clientX,y:e.clientY};}}
      onPointerMove={e=>{const p=look.current;if(disabled||p?.id!==e.pointerId)return;runtime?.rig.rotate(e.clientX-p.x,e.clientY-p.y);p.x=e.clientX;p.y=e.clientY;}}
      onPointerUp={e=>{if(look.current?.id===e.pointerId)look.current=null;}}
      onPointerCancel={e=>{if(look.current?.id===e.pointerId)look.current=null;}}
      onLostPointerCapture={e=>{if(look.current?.id===e.pointerId)look.current=null;}}/>
    <button className="r3-fps-shoot" aria-label="Shoot weapon" disabled={disabled}
      onPointerDown={e=>{if(disabled||trigger.current!==null)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);trigger.current=e.pointerId;session.input.setFire(true);}}
      onPointerUp={e=>release(e.pointerId)} onPointerCancel={e=>release(e.pointerId)} onLostPointerCapture={e=>release(e.pointerId)}
      onClick={e=>{if(e.detail===0){session.input.setFire(true);session.input.setFire(false);}}}><Crosshair size={28}/><span>SHOOT</span></button>
  </>;
}
