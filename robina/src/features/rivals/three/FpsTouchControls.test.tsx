import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {FpsTouchControls} from './FpsTouchControls';
import {SandboxSession} from './SandboxSession';
import {CameraRig} from './CameraRig';
import {emptyCommand} from '../input/InputBuffer';
import type {RaidRuntime} from './RaidRuntime';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
function setup(){
  vi.stubGlobal('PointerEvent',class extends MouseEvent {pointerId:number;constructor(type:string,init:PointerEventInit={}){super(type,init);this.pointerId=init.pointerId??1;}});
  HTMLElement.prototype.setPointerCapture=vi.fn();
  const session=new SandboxSession(),rig=new CameraRig();session.update({status:'playing'});session.setMovement({x:.6,y:-.8});
  const runtime={rig} as RaidRuntime,view=render(<FpsTouchControls session={session} runtime={runtime} disabled={false}/>);
  return {session,rig,view,runtime,shoot:screen.getByRole('button',{name:'Shoot weapon'})};
}
it('moves, shoots and turns with two fingers without changing movement or losing the held trigger',()=>{
  const {session,rig,shoot}=setup();
  fireEvent.pointerDown(shoot,{pointerId:3,clientX:100,clientY:100});fireEvent.pointerMove(shoot,{pointerId:3,clientX:140,clientY:80});
  expect(rig.yaw).toBeCloseTo(-.12);expect(rig.pitch).toBeCloseTo(-.03);
  expect(session.input.read(emptyCommand())).toMatchObject({x:.6,y:-.8,fire:true});
  fireEvent.pointerMove(shoot,{pointerId:4,clientX:300,clientY:300});fireEvent.pointerCancel(shoot,{pointerId:4});
  expect(rig.yaw).toBeCloseTo(-.12);expect(session.input.read(emptyCommand()).fire).toBe(true);
  fireEvent.pointerUp(shoot,{pointerId:3});expect(session.input.read(emptyCommand()).fire).toBe(false);session.dispose();
});
it('releases a held trigger on capture loss, interruption and disabled controls',()=>{
  const {session,rig,shoot,view,runtime}=setup();
  fireEvent.pointerDown(shoot,{pointerId:3,clientX:100,clientY:100});session.input.read(emptyCommand());fireEvent.lostPointerCapture(shoot,{pointerId:3});
  expect(session.input.read(emptyCommand()).fire).toBe(false);
  fireEvent.pointerDown(shoot,{pointerId:3});session.input.read(emptyCommand());fireEvent(window,new Event('blur'));
  expect(session.input.read(emptyCommand()).fire).toBe(false);
  fireEvent.pointerDown(shoot,{pointerId:3});session.input.read(emptyCommand());view.rerender(<FpsTouchControls session={session} runtime={runtime} disabled/>);
  expect(session.input.read(emptyCommand()).fire).toBe(false);const yaw=rig.yaw;fireEvent.pointerMove(shoot,{pointerId:3,clientX:20,clientY:30});expect(rig.yaw).toBe(yaw);session.dispose();
});
