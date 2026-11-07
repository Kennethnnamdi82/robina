import {useEffect} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {App} from '@capacitor/app';
import {ScreenOrientation} from '@capacitor/screen-orientation';
import {registerPlugin} from '@capacitor/core';
import {isNativeAndroid,NativeSession} from './platform';
import './native.css';
const Immersive=registerPlugin<{setGameplay(options:{active:boolean;playing:boolean}):Promise<void>}>('RivalsSession');
export default function NativeShell(){
 const location=useLocation(),navigate=useNavigate();
 useEffect(()=>{
  if(!isNativeAndroid())return;document.documentElement.dataset.native='android';let disposed=false;const listeners:{remove:()=>Promise<void>}[]=[];
  void NativeSession.addListener('audioInterrupted',()=>window.dispatchEvent(new Event('rivals:native-pause'))).then(l=>{if(disposed)void l.remove();else listeners.push(l);});
  void App.addListener('appStateChange',({isActive})=>{if(!isActive){window.dispatchEvent(new Event('rivals:native-pause'));window.dispatchEvent(new Event('blur'));}else window.dispatchEvent(new Event('rivals:native-resume'));}).then(l=>{if(disposed)void l.remove();else listeners.push(l);});
  void App.addListener('backButton',()=>{
   const gameplay=document.querySelector('.r3-game');
   if(gameplay){if(gameplay.getAttribute('data-status')==='playing')window.dispatchEvent(new Event('rivals:native-pause'));else{const dialog=document.querySelector('[role=dialog]');if(dialog)dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));}return;}
   const dialog=document.querySelector('[role=dialog]');if(dialog){dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return;}
   if(window.location.pathname!=='/'){navigate('/');return;}void App.minimizeApp();
  }).then(l=>{if(disposed)void l.remove();else listeners.push(l);});
  return()=>{disposed=true;listeners.forEach(l=>void l.remove());};
 },[navigate]);
 useEffect(()=>{
  if(!isNativeAndroid())return;
  // Only a mounted game locks landscape; menus remain usable in portrait
  let previous='';
  const apply=()=>{const game=document.querySelector('.r3-game'),active=Boolean(game),playing=game?.getAttribute('data-status')==='playing',signature=active+':'+playing;if(previous===signature)return;const wasActive=previous.startsWith('true:');previous=signature;void Immersive.setGameplay({active,playing}).catch(()=>{});if(active!==wasActive){if(active)void ScreenOrientation.lock({orientation:'landscape'}).catch(()=>{});else void ScreenOrientation.unlock().catch(()=>{});}};
  const observer=new MutationObserver(apply);observer.observe(document.getElementById('root')||document.body,{childList:true,attributes:true,attributeFilter:['data-status'],subtree:true});apply();return()=>observer.disconnect();
 },[location.pathname]);
 return null;
}
