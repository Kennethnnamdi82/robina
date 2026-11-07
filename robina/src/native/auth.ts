import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {NativeSession} from './platform';
let flight:{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}|undefined;
let finishing=false;
export const NATIVE_AUTH_EVENT='rivals:native-authenticated';
export function cancelNativeLogin(){if(flight){clearTimeout(flight.timer);flight.reject(Error('Sign-in cancelled'));flight=undefined;}void NativeSession.cancelLogin().catch(()=>{});}
export async function completeNativeLogin(url:string){
  let parsed:URL;try{parsed=new URL(url);}catch{return;}
  if(parsed.origin!=='https://rivals-heist.vercel.app'||parsed.pathname!=='/android/auth/callback'||finishing)return;
  finishing=true;
  try{
    const response=await NativeSession.completeLogin({url});
    if(response.status!==200)throw Error('Sign-in expired or could not be verified — please try again');
    window.dispatchEvent(new Event(NATIVE_AUTH_EVENT));
    if(flight){clearTimeout(flight.timer);flight.resolve();flight=undefined;}
  }catch(error){if(flight){clearTimeout(flight.timer);flight.reject(error instanceof Error?error:new Error('Sign-in failed'));flight=undefined;}}
  finally{finishing=false;}
}
export async function startNativeLogin(){
  if(flight)throw Error('A browser sign-in is already in progress');
  const {url}=await NativeSession.beginLogin();
  const result=new Promise<void>((resolve,reject)=>{flight={resolve,reject,timer:setTimeout(()=>{flight=undefined;void NativeSession.cancelLogin().catch(()=>{});reject(Error('Browser sign-in timed out — please try again'));},180000)};});
  try{await Browser.open({url});}catch(error){if(flight){clearTimeout(flight.timer);flight.reject(Error('Could not open the system browser'));flight=undefined;}}
  return result;
}
export async function listenForNativeLogin(){
  const listener=await App.addListener('appUrlOpen',event=>void completeNativeLogin(event.url));
  const initial=await App.getLaunchUrl();if(initial?.url)void completeNativeLogin(initial.url);
  return()=>listener.remove();
}
