import {useEffect,useRef} from 'react';
import {Crosshair} from 'lucide-react';
import type {SandboxSession} from './SandboxSession';
import type {RaidRuntime} from './RaidRuntime';
import {useFireLook} from './useFireLook';

/** Independent pointer ownership allows move + look + trigger simultaneously. */
export function FpsTouchControls({session,runtime,disabled}:{session:SandboxSession;runtime:RaidRuntime|undefined;disabled:boolean}){
  const look=useRef<{id:number;x:number;y:number}|null>(null),fire=useFireLook(session,runtime,disabled,true);
  useEffect(()=>{const reset=()=>{look.current=null;},hidden=()=>{if(document.hidden)reset();};if(disabled)reset();window.addEventListener('blur',reset);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden);reset();};},[disabled]);
  return <>
    <div className="r3-fps-look" role="group" aria-label="Swipe to look" data-testid="fps-look-area"
      onPointerDown={e=>{if(disabled||look.current)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);look.current={id:e.pointerId,x:e.clientX,y:e.clientY};}}
      onPointerMove={e=>{const p=look.current;if(disabled||p?.id!==e.pointerId)return;runtime?.rig.rotate(e.clientX-p.x,e.clientY-p.y);p.x=e.clientX;p.y=e.clientY;}}
      onPointerUp={e=>{if(look.current?.id===e.pointerId)look.current=null;}}
      onPointerCancel={e=>{if(look.current?.id===e.pointerId)look.current=null;}}
      onLostPointerCapture={e=>{if(look.current?.id===e.pointerId)look.current=null;}}/>
    <button className="r3-fps-shoot" aria-label="Shoot weapon" disabled={disabled} {...fire}><Crosshair size={28}/><span>SHOOT</span></button>
  </>;
}
