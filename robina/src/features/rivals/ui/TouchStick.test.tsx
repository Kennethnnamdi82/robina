import {render,fireEvent,cleanup,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {TouchStick} from './TouchStick';
import {DrivingControls} from '../three/SoldierHUD';
import type {RaidRuntime} from '../three/RaidRuntime';

beforeEach(()=>{
  vi.stubGlobal('PointerEvent',class extends MouseEvent {pointerId:number;constructor(type:string,init:PointerEventInit={}){super(type,init);this.pointerId=init.pointerId??1;}});
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:120,bottom:120,width:120,height:120,toJSON:()=>({})});
  HTMLElement.prototype.setPointerCapture=vi.fn();HTMLElement.prototype.hasPointerCapture=vi.fn(()=>true);HTMLElement.prototype.releasePointerCapture=vi.fn();
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('responsive owned analog sticks',()=>{
  it('keeps a second finger from releasing the aim or movement owner',()=>{
    const move=vi.fn(),press=vi.fn();render(<TouchStick kind="aim" disabled={false} onMove={move} onPress={press}/>);const stick=screen.getByTestId('aim-stick');
    fireEvent.pointerDown(stick,{pointerId:1,clientX:62,clientY:60});expect(move.mock.lastCall![0].x).toBeGreaterThan(0);expect(press).toHaveBeenLastCalledWith(true);
    fireEvent.pointerCancel(stick,{pointerId:2});expect(press).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(stick,{pointerId:1,clientX:90,clientY:60});expect(move.mock.lastCall![0].x).toBeGreaterThan(.8);
    fireEvent.pointerUp(stick,{pointerId:1});expect(move).toHaveBeenLastCalledWith({x:0,y:0});expect(press).toHaveBeenLastCalledWith(false);
  });
  it('releases controls on blur, disable and unmount',()=>{
    const move=vi.fn();const view=render(<TouchStick kind="drive" disabled={false} onMove={move}/>),stick=screen.getByTestId('driving-stick');
    fireEvent.pointerDown(stick,{clientX:80,clientY:30});fireEvent.blur(window);expect(move).toHaveBeenLastCalledWith({x:0,y:0});
    fireEvent.pointerDown(stick,{clientX:80,clientY:30});view.rerender(<TouchStick kind="drive" disabled onMove={move}/>);expect(move).toHaveBeenLastCalledWith({x:0,y:0});view.unmount();expect(move).toHaveBeenLastCalledWith({x:0,y:0});
  });
  it('steers independently of the acceleration, reverse and brake pedals',()=>{
    const runtime={vehicles:{snapshot:{speed:0,kind:'sedan',health:200}},setDriving:vi.fn(),vehicleInteract:vi.fn()} as unknown as RaidRuntime;
    render(<DrivingControls runtime={runtime} disabled={false}/>);expect(screen.queryByRole('button',{name:'Steer left'})).toBeNull();expect(screen.queryByRole('button',{name:'Steer right'})).toBeNull();
    const stick=screen.getByRole('group',{name:'Driving joystick'});fireEvent.pointerDown(stick,{pointerId:1,clientX:75,clientY:30});
    expect(runtime.setDriving).toHaveBeenLastCalledWith({steer:expect.any(Number)});
    const before=vi.mocked(runtime.setDriving).mock.lastCall![0];expect(before.steer).toBeGreaterThan(0);expect(before.throttle).toBeUndefined();
    const gas=screen.getByRole('button',{name:'Accelerate vehicle'});fireEvent.pointerDown(gas,{pointerId:2});expect(runtime.setDriving).toHaveBeenLastCalledWith({throttle:1});fireEvent.pointerUp(gas,{pointerId:2});expect(runtime.setDriving).toHaveBeenLastCalledWith({throttle:0});
    const reverse=screen.getByRole('button',{name:'Reverse vehicle'});fireEvent.pointerDown(reverse,{pointerId:2});expect(runtime.setDriving).toHaveBeenLastCalledWith({throttle:-1});fireEvent.pointerUp(reverse,{pointerId:2});expect(runtime.setDriving).toHaveBeenLastCalledWith({throttle:0});
    const brake=screen.getByRole('button',{name:'Brake vehicle'});fireEvent.pointerDown(brake,{pointerId:2});expect(runtime.setDriving).toHaveBeenLastCalledWith({brake:true});fireEvent.pointerUp(brake,{pointerId:2});expect(runtime.setDriving).toHaveBeenLastCalledWith({brake:false});
    fireEvent.pointerUp(stick,{pointerId:1});expect(runtime.setDriving).toHaveBeenLastCalledWith({steer:0});
  });
});
