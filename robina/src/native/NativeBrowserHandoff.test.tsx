import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import NativeBrowserHandoff from './NativeBrowserHandoff';
const mocks=vi.hoisted(()=>({loggedIn:true,post:vi.fn(),native:false}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({isLoggedIn:mocks.loggedIn})}));
vi.mock('@/services/api',()=>({api:{post:mocks.post}}));
vi.mock('./platform',()=>({isNativeAndroid:()=>mocks.native}));
const state='s'.repeat(43),challenge='c'.repeat(43);
const renderHandoff=()=>render(<NativeBrowserHandoff><div>Browser game</div></NativeBrowserHandoff>);
beforeEach(()=>{mocks.loggedIn=true;mocks.native=false;mocks.post.mockReset();sessionStorage.clear();history.replaceState(null,'','/');});
afterEach(cleanup);
describe('secure native browser handoff',()=>{
 it('leaves the normal website unchanged',()=>{renderHandoff();expect(screen.getByText('Browser game')).toBeTruthy();expect(mocks.post).not.toHaveBeenCalled();});
 it('requires an explicit consent click before granting an app session',()=>{
  history.replaceState(null,'','/native-sign-in?'+new URLSearchParams({state,challenge}));renderHandoff();
  expect(screen.getByRole('button',{name:'AUTHORIZE AND RETURN TO APP'})).toBeTruthy();expect(mocks.post).not.toHaveBeenCalled();expect(screen.queryByText('Browser game')).toBeNull();
 });
 it('allows the existing browser login while unauthenticated and retains the PKCE request',()=>{
  mocks.loggedIn=false;history.replaceState(null,'','/native-sign-in?'+new URLSearchParams({state,challenge}));renderHandoff();expect(screen.getByText('Browser game')).toBeTruthy();expect(JSON.parse(sessionStorage.getItem('rivals_native_browser_grant_v1')!).challenge).toBe(challenge);expect(mocks.post).not.toHaveBeenCalled();
 });
 it('rejects a grant response that redirects to a different origin',async()=>{
  history.replaceState(null,'','/native-sign-in?'+new URLSearchParams({state,challenge}));mocks.post.mockResolvedValue({redirectUrl:'https://attacker.invalid/android/auth/callback?'+new URLSearchParams({state,code:'x'.repeat(43)})});renderHandoff();
  fireEvent.click(screen.getByRole('button',{name:'AUTHORIZE AND RETURN TO APP'}));
  await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Could not return to the app'));
  expect(mocks.post).toHaveBeenCalledWith('/api/auth/native/authorize',{state,challenge});expect(screen.queryByRole('link')).toBeNull();
 });
 it('ignores expired or malformed requests and never grants inside the native WebView',()=>{
  sessionStorage.setItem('rivals_native_browser_grant_v1',JSON.stringify({state,challenge,created:Date.now()-181000}));renderHandoff();expect(screen.getByText('Browser game')).toBeTruthy();expect(mocks.post).not.toHaveBeenCalled();cleanup();
  mocks.native=true;history.replaceState(null,'','/native-sign-in?'+new URLSearchParams({state,challenge}));renderHandoff();expect(screen.getByText('Browser game')).toBeTruthy();expect(mocks.post).not.toHaveBeenCalled();
 });
});
