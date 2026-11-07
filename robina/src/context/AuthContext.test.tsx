import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({me:vi.fn(),google:vi.fn(),logout:vi.fn(),token:vi.fn(),init:vi.fn(),authenticated:false,callbacks:{} as {onComplete?:()=>void;onError?:()=>void}}));
vi.mock('wagmi',()=>({useAccount:()=>({isConnected:false}),useDisconnect:()=>({disconnectAsync:vi.fn()})}));
vi.mock('@privy-io/react-auth',()=>({usePrivy:()=>({ready:true,authenticated:mocks.authenticated,getAccessToken:mocks.token,logout:mocks.logout}),useLoginWithOAuth:(callbacks:typeof mocks.callbacks)=>{mocks.callbacks=callbacks;return{initOAuth:mocks.init};}}));
vi.mock('@wallet-standard/app',()=>({getWallets:()=>({on:()=>()=>{}})}));
vi.mock('@/lib/phantomWallet',()=>({getPhantomWallet:()=>null}));
vi.mock('@/lib/backend',()=>({HAS_BACKEND:true}));
vi.mock('@/services/api',()=>({authApi:{me:mocks.me,google:mocks.google,logout:mocks.logout},adminApi:{me:vi.fn()}}));
import {AuthProvider,useAuth} from './AuthContext';
function Probe(){const a=useAuth();return <><output>{a.isLoggedIn?'VERIFIED':a.isAuthLoading?'VERIFYING':'SIGNED OUT'}</output><p>{a.authError}</p><button onClick={()=>void a.signInWithGoogle()}>LOGIN</button><button onClick={()=>void a.signOut()}>LOGOUT</button></>;}
beforeEach(()=>{vi.stubEnv('VITE_PRIVY_APP_ID','test-public-app');vi.clearAllMocks();mocks.authenticated=false;sessionStorage.clear();localStorage.clear();mocks.token.mockResolvedValue('test-token');mocks.init.mockResolvedValue(undefined);mocks.me.mockRejectedValue({status:401});mocks.google.mockResolvedValue({user:{wallet:'google-user',chainType:'none'}});mocks.logout.mockResolvedValue(undefined);});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllEnvs();});
describe('Google session synchronization',()=>{
  it('restores a known cookie after a temporary backend wake-up failure without asking for Google again',async()=>{
    vi.useFakeTimers();localStorage.setItem('rivals_session_seen','1');mocks.me.mockRejectedValueOnce({status:503}).mockResolvedValueOnce({user:{wallet:'returning-user'}});
    render(<AuthProvider><Probe/></AuthProvider>);await act(async()=>{await vi.advanceTimersByTimeAsync(800);});expect(screen.getByText('VERIFIED')).toBeTruthy();expect(mocks.me).toHaveBeenCalledTimes(2);expect(mocks.google).not.toHaveBeenCalled();
  });
  it('never treats an expired or revoked cookie as authenticated or retries a definitive 401',async()=>{
    localStorage.setItem('rivals_session_seen','1');render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('SIGNED OUT');expect(mocks.me).toHaveBeenCalledOnce();expect(localStorage.getItem('rivals_session_seen')).toBeNull();
  });
  it('coalesces duplicate callbacks and ignores late startup 401 responses',async()=>{let stale!:(reason:unknown)=>void;mocks.me.mockImplementationOnce(()=>new Promise((_,reject)=>{stale=reject;}));render(<AuthProvider><Probe/></AuthProvider>);fireEvent.click(screen.getByText('LOGIN'));await act(async()=>{mocks.callbacks.onComplete?.();mocks.callbacks.onComplete?.();});await screen.findByText('VERIFIED');await act(async()=>stale({status:401}));expect(mocks.google).toHaveBeenCalledOnce();expect(screen.getByText('VERIFIED')).toBeTruthy();expect(screen.queryByText(/could not be completed/)).toBeNull();});
  it('reconciles an exchange error with the already-established HttpOnly backend session',async()=>{render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('SIGNED OUT');mocks.google.mockRejectedValue(new Error('network response lost'));mocks.me.mockResolvedValue({user:{wallet:'committed-session'}});fireEvent.click(screen.getByText('LOGIN'));await act(async()=>mocks.callbacks.onComplete?.());await screen.findByText('VERIFIED');expect(screen.queryByText(/could not be completed/)).toBeNull();});
  it('finishes a redirected Google callback after the SDK becomes authenticated',async()=>{sessionStorage.setItem('robina_google_oauth_pending',String(Date.now()));mocks.authenticated=true;render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('VERIFIED');expect(mocks.google).toHaveBeenCalledOnce();expect(sessionStorage.getItem('robina_google_oauth_pending')).toBeNull();});
  it('does not show a stale cancellation error after successful verification',async()=>{render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('SIGNED OUT');fireEvent.click(screen.getByText('LOGIN'));await act(async()=>mocks.callbacks.onComplete?.());await screen.findByText('VERIFIED');await act(async()=>mocks.callbacks.onError?.());expect(screen.queryByText(/cancelled/)).toBeNull();});
  it('does not restore a late login after the user signs out',async()=>{let finish!:(v:unknown)=>void;mocks.google.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('SIGNED OUT');fireEvent.click(screen.getByText('LOGIN'));await act(async()=>mocks.callbacks.onComplete?.());await waitFor(()=>expect(mocks.google).toHaveBeenCalledOnce());await act(async()=>fireEvent.click(screen.getByText('LOGOUT')));await act(async()=>finish({user:{wallet:'stale-user'}}));expect(screen.queryByText('VERIFIED')).toBeNull();});
});
