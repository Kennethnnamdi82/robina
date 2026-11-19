import { useEffect, useRef, type PointerEvent, type MouseEvent } from 'react';
import type { SandboxSession } from './SandboxSession';
import type { RaidRuntime } from './RaidRuntime';

/** Pointer events update the camera directly; firing never schedules React
 * renders. The captured finger keeps looking after it leaves the button. */
export function useFireLook(session:SandboxSession,runtime:RaidRuntime|undefined,disabled:boolean,lookEnabled:boolean){
  const pointer=useRef<{id:number;x:number;y:number}|null>(null);
  useEffect(()=>{
    const reset=()=>{pointer.current=null;session.input.setFire(false);};
    const hidden=()=>{if(document.hidden)reset();};
    if(disabled)reset();
    window.addEventListener('blur',reset);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden);reset();};
  },[session,disabled,lookEnabled]);
  const release=(event:PointerEvent<HTMLButtonElement>)=>{if(pointer.current?.id===event.pointerId){pointer.current=null;session.input.setFire(false);}};
  return {
    style:{touchAction:'none' as const},
    onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>{
      if(disabled||pointer.current)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
      pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY};session.input.setFire(true);
    },
    onPointerMove:(event:PointerEvent<HTMLButtonElement>)=>{
      const p=pointer.current;if(disabled||p?.id!==event.pointerId)return;
      if(lookEnabled)runtime?.rig.rotate(event.clientX-p.x,event.clientY-p.y);p.x=event.clientX;p.y=event.clientY;
    },
    onPointerUp:release,onPointerCancel:release,onLostPointerCapture:release,
    onClick:(event:MouseEvent<HTMLButtonElement>)=>{if(!disabled&&event.detail===0){session.input.setFire(true);session.input.setFire(false);}},
  };
}
