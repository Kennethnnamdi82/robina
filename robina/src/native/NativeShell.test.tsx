import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import NativeShell from './NativeShell';
const mocks=vi.hoisted(()=>({native:true,listeners:{} as Record<string,(event?:unknown)=>void>,setGameplay:vi.fn().mockResolvedValue(undefined),lock:vi.fn().mockResolvedValue(undefined),unlock:vi.fn().mockResolvedValue(undefined),minimize:vi.fn().mockResolvedValue(undefined),remove:vi.fn().mockResolvedValue(undefined)}));
vi.mock('@capacitor/core',()=>({registerPlugin:()=>({setGameplay:mocks.setGameplay})}));
vi.mock('./platform',()=>({isNativeAndroid:()=>mocks.native,NativeSession:{addListener:async(name:string,callback:()=>void)=>{mocks.listeners[name]=callback;return{remove:mocks.remove};}}}));
vi.mock('@capacitor/app',()=>({App:{addListener:async(name:string,callback:(event:unknown)=>void)=>{mocks.listeners[name]=callback;return{remove:mocks.remove};},minimizeApp:()=>mocks.minimize()}}));
vi.mock('@capacitor/screen-orientation',()=>({ScreenOrientation:{lock:mocks.lock,unlock:mocks.unlock}}));
beforeEach(()=>{mocks.native=true;mocks.listeners={};vi.clearAllMocks();});
afterEach(()=>{cleanup();delete document.documentElement.dataset.native;});
describe('Android lifecycle shell',()=>{
 it('does not apply native controls to the browser game',()=>{mocks.native=false;render(<MemoryRouter><NativeShell/></MemoryRouter>);expect(mocks.setGameplay).not.toHaveBeenCalled();expect(mocks.lock).not.toHaveBeenCalled();});
 it('locks only a mounted game to landscape and pauses rather than exits on back or interruptions',async()=>{
  const pause=vi.fn();window.addEventListener('rivals:native-pause',pause);
  try{
   render(<MemoryRouter><div className="r3-game" data-status="playing"/><NativeShell/></MemoryRouter>);
   await waitFor(()=>expect(mocks.lock).toHaveBeenCalledWith({orientation:'landscape'}));
   expect(mocks.setGameplay).toHaveBeenCalledWith({active:true,playing:true});
   mocks.listeners.backButton();mocks.listeners.audioInterrupted();mocks.listeners.appStateChange({isActive:false});
   expect(pause).toHaveBeenCalledTimes(3);expect(mocks.minimize).not.toHaveBeenCalled();
   document.querySelector('.r3-game')!.setAttribute('data-status','paused');
   await waitFor(()=>expect(mocks.setGameplay).toHaveBeenCalledWith({active:true,playing:false}));
  }finally{window.removeEventListener('rivals:native-pause',pause);}
 });
 it('minimizes from the lobby and releases registered listeners',async()=>{
  const view=render(<MemoryRouter><NativeShell/></MemoryRouter>);await waitFor(()=>expect(mocks.listeners.backButton).toBeTypeOf('function'));
  mocks.listeners.backButton();expect(mocks.minimize).toHaveBeenCalledOnce();expect(mocks.lock).not.toHaveBeenCalled();view.unmount();expect(mocks.remove).toHaveBeenCalledTimes(3);
 });
});
