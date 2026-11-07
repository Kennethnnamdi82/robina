import {useContext} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import NativeAuthProvider from './NativeAuthProvider';
import {AuthContext} from '@/context/AuthContext';
const mocks=vi.hoisted(()=>({me:vi.fn(),logout:vi.fn(),listen:vi.fn(),cancel:vi.fn()}));
vi.mock('@/context/AuthContext',async()=>{const {createContext}=await import('react');return{AuthContext:createContext(null)};});
vi.mock('@/services/api',()=>({authApi:{me:mocks.me,logout:mocks.logout}}));
vi.mock('./auth',()=>({listenForNativeLogin:mocks.listen,cancelNativeLogin:mocks.cancel,startNativeLogin:vi.fn(),NATIVE_AUTH_EVENT:'rivals:native-authenticated'}));
function Probe(){const auth=useContext(AuthContext)!;return <><span>{auth.isLoggedIn?'signed in':'signed out'}</span><span>{auth.isAuthLoading?'restoring':'ready'}</span><button onClick={()=>void auth.signOut()}>Sign out</button></>;}
const user={wallet:'0x1111111111111111111111111111111111111111',chainType:'evm',completedTasks:[]};
beforeEach(()=>{vi.resetAllMocks();mocks.listen.mockResolvedValue(vi.fn());mocks.logout.mockResolvedValue({ok:true});});
afterEach(cleanup);
it('restores the existing account and rechecks suspended sessions after returning to the app',async()=>{
 mocks.me.mockResolvedValueOnce({user}).mockRejectedValueOnce(Object.assign(Error('suspended'),{status:403}));render(<NativeAuthProvider><Probe/></NativeAuthProvider>);
 await screen.findByText('signed in');await act(async()=>{window.dispatchEvent(new Event('rivals:native-resume'));});await screen.findByText('signed out');expect(mocks.me).toHaveBeenCalledTimes(2);
});
it('does not let a stale session restore sign the user back in after logout',async()=>{
 let finish!:(value:{user:typeof user})=>void;mocks.me.mockReturnValue(new Promise(resolve=>{finish=resolve;}));render(<NativeAuthProvider><Probe/></NativeAuthProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Sign out'}));await waitFor(()=>expect(mocks.logout).toHaveBeenCalledOnce());await act(async()=>{finish({user});});
 expect(screen.getByText('signed out')).toBeTruthy();expect(screen.getByText('ready')).toBeTruthy();expect(mocks.cancel).toHaveBeenCalledOnce();
});
it('keeps a restored account during a temporary network outage',async()=>{
 mocks.me.mockResolvedValueOnce({user}).mockRejectedValueOnce(Error('network unavailable'));render(<NativeAuthProvider><Probe/></NativeAuthProvider>);
 await screen.findByText('signed in');await act(async()=>{window.dispatchEvent(new Event('rivals:native-resume'));});expect(screen.getByText('signed in')).toBeTruthy();
});
