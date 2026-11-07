import {useState,type ReactNode} from 'react';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/services/api';
import {isNativeAndroid} from './platform';
const KEY='rivals_native_browser_grant_v1';
const valid=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
function readPending(){
 try{
  if(location.pathname==='/native-sign-in'){
   const query=new URLSearchParams(location.search),challenge=query.get('challenge'),state=query.get('state');
   if(valid(challenge)&&valid(state))sessionStorage.setItem(KEY,JSON.stringify({challenge,state,created:Date.now()}));
  }
  const value=JSON.parse(sessionStorage.getItem(KEY)||'null');
  if(value&&valid(value.challenge)&&valid(value.state)&&Date.now()-value.created<180000)return value as {challenge:string;state:string;created:number};
  sessionStorage.removeItem(KEY);
 }catch{/* Login remains available even if the optional handoff is invalid */}
 return null;
}
function intentFor(target:URL){return 'intent://'+target.host+target.pathname+target.search+'#Intent;scheme=https;package=com.venomee.rivalsheist;end';}
export default function NativeBrowserHandoff({children}:{children:ReactNode}){
 const {isLoggedIn}=useAuth();const [pending]=useState(()=>isNativeAndroid()?null:readPending()),[url,setUrl]=useState(()=>{
  if(isNativeAndroid()||location.pathname!=='/android/auth/callback')return '';
  const target=new URL(location.href);return target.origin==='https://rivals-heist.vercel.app'&&valid(target.searchParams.get('code'))&&valid(target.searchParams.get('state'))?intentFor(target):'';
 }),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const authorize=async()=>{
  if(!pending||busy)return;setBusy(true);setError('');
  try{
   const result=await api.post<{redirectUrl:string}>('/api/auth/native/authorize',{challenge:pending.challenge,state:pending.state}),target=new URL(result.redirectUrl);
   if(target.origin!=='https://rivals-heist.vercel.app'||target.pathname!=='/android/auth/callback'||target.searchParams.get('state')!==pending.state||!valid(target.searchParams.get('code')))throw Error('Invalid app return link');
   sessionStorage.removeItem(KEY);const intent=intentFor(target);setUrl(intent);location.assign(intent);
  }catch{setError('Could not return to the app — go back to RIVALS and try sign-in again');}finally{setBusy(false);}
 };
 if(!url&&(!pending||!isLoggedIn))return children;
 return <div className="native-return" role="dialog" aria-modal="true" aria-labelledby="native-return-title"><h1 id="native-return-title">YOUR OPERATIVE IS READY</h1><p role="status">{error||'Continue securely into the installed RIVALS Android game'}</p>{url?<a href={url}>RETURN TO RIVALS</a>:<button disabled={busy} onClick={()=>void authorize()}>{busy?'VERIFYING YOUR ACCOUNT':'AUTHORIZE AND RETURN TO APP'}</button>}<p>Only the official Android app can complete this sign-in</p></div>;
}
