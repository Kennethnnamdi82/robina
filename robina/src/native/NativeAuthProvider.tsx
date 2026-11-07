import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {authApi,type ApiUser} from '@/services/api';
import {AuthContext} from '@/context/AuthContext';
import {cancelNativeLogin,listenForNativeLogin,NATIVE_AUTH_EVENT,startNativeLogin} from './auth';

export default function NativeAuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<ApiUser|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const generation=useRef(0);
  const refresh=useCallback(async()=>{const ticket=++generation.current;try{const result=await authApi.me({timeoutMs:65000,retries:1});if(ticket===generation.current)setUser(result.user);}catch(cause){if(ticket===generation.current&&(cause as {status?:number}).status===401)setUser(null);}finally{if(ticket===generation.current)setLoading(false);}},[]);
  useEffect(()=>{let remove:(()=>unknown)|undefined,cancelled=false;void listenForNativeLogin().then(clean=>{if(cancelled)void clean();else remove=clean;});void refresh();const changed=()=>void refresh();window.addEventListener(NATIVE_AUTH_EVENT,changed);return()=>{cancelled=true;void remove?.();window.removeEventListener(NATIVE_AUTH_EVENT,changed);};},[refresh]);
  const signIn=useCallback(async()=>{setBusy(true);setError(null);try{await startNativeLogin();await refresh();}catch(cause){setError(cause instanceof Error?cause.message:'Could not sign in');throw cause;}finally{setBusy(false);}},[refresh]);
  const value=useMemo(()=>({isLoggedIn:Boolean(user),baseUser:user?{wallet:user.wallet,name:user.wallet.length>16?user.wallet.slice(0,6)+'…'+user.wallet.slice(-4):user.wallet,avatar:'',role:'user',completedTasks:user.completedTasks}:null,
    authChainType:user?.chainType||'none' as const,isAdmin:false,isConnecting:busy,isSigningIn:busy,activeLoginMethod:busy?'google' as const:null,authError:error,isAuthLoading:loading,
    signInWithGoogle:signIn,signInWithWallet:signIn,signInWithSolana:signIn,solanaAddress:null,solanaWallet:null,solanaWalletAccount:null,
    connectSolanaWallet:async()=>{throw Error('Connect your wallet through secure browser sign-in');},signInAsAdmin:async()=>({ok:false,error:'Owner administration is available on the website'}),
    signOut:async()=>{generation.current++;cancelNativeLogin();await authApi.logout();generation.current++;setUser(null);setError(null);},
  }),[user,busy,error,loading,signIn]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
