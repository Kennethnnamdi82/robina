import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {authApi,type ApiUser} from '@/services/api';
import {AuthContext} from '@/context/AuthContext';
import {cancelNativeLogin,listenForNativeLogin,NATIVE_AUTH_EVENT,startNativeLogin} from './auth';
import {restoreSession,sessionTemporarilyUnavailable,SESSION_RETRY_EVENT} from '@/services/sessionRestore';

export default function NativeAuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<ApiUser|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const generation=useRef(0),currentUser=useRef<ApiUser|null>(null),restoreAbort=useRef<AbortController>(),retry=useRef<ReturnType<typeof setTimeout>>();
  const refresh=useCallback(async function restoreNative(){
    clearTimeout(retry.current);restoreAbort.current?.abort();const controller=new AbortController();restoreAbort.current=controller;
    const ticket=++generation.current;let waiting=false;
    try{const result=await restoreSession(authApi.me,controller.signal);if(ticket===generation.current){currentUser.current=result.user;setUser(result.user);setError(null);}}
    catch(cause){
      if(ticket!==generation.current||controller.signal.aborted)return;
      if([401,403].includes((cause as {status?:number}).status||0)){currentUser.current=null;setUser(null);setError(null);}
      else if(sessionTemporarilyUnavailable(cause)){
        waiting=!currentUser.current;
        setError('Restoring your saved session. The server is temporarily unavailable; reconnecting automatically.');
        retry.current=setTimeout(()=>void restoreNative(),5000);
      }
    }finally{if(ticket===generation.current&&!waiting)setLoading(false);}
  },[]);
  useEffect(()=>{let remove:(()=>unknown)|undefined,cancelled=false;void listenForNativeLogin().then(clean=>{if(cancelled)void clean();else remove=clean;}).catch(()=>{if(!cancelled)setError('Could not listen for browser sign-in — restart the app and try again');});void refresh();const changed=()=>void refresh();const events=[NATIVE_AUTH_EVENT,'rivals:native-resume','online',SESSION_RETRY_EVENT];events.forEach(name=>window.addEventListener(name,changed));return()=>{cancelled=true;generation.current++;restoreAbort.current?.abort();clearTimeout(retry.current);void remove?.();events.forEach(name=>window.removeEventListener(name,changed));};},[refresh]);
  const signIn=useCallback(async()=>{setBusy(true);setError(null);try{await startNativeLogin();await refresh();}catch(cause){setError(cause instanceof Error?cause.message:'Could not sign in');throw cause;}finally{setBusy(false);}},[refresh]);
  const value=useMemo(()=>({isLoggedIn:Boolean(user),baseUser:user?{wallet:user.wallet,name:user.wallet.length>16?user.wallet.slice(0,6)+'…'+user.wallet.slice(-4):user.wallet,avatar:'',role:'user',completedTasks:user.completedTasks}:null,
    authChainType:user?.chainType||'none' as const,isAdmin:false,isConnecting:busy,isSigningIn:busy,activeLoginMethod:busy?'google' as const:null,authError:error,isAuthLoading:loading,
    signInWithGoogle:signIn,signInWithWallet:signIn,signInWithSolana:signIn,solanaAddress:null,solanaWallet:null,solanaWalletAccount:null,
    connectSolanaWallet:async()=>{throw Error('Connect your wallet through secure browser sign-in');},signInAsAdmin:async()=>({ok:false,error:'Owner administration is available on the website'}),
    signOut:async()=>{generation.current++;restoreAbort.current?.abort();clearTimeout(retry.current);cancelNativeLogin();await authApi.logout();generation.current++;currentUser.current=null;setUser(null);setError(null);setLoading(false);},
  }),[user,busy,error,loading,signIn]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
