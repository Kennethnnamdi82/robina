import {useEffect,useMemo,useState} from 'react';
export const UNPAID_ORDER_STATES=new Set(['initializing','pending','failed','expired','cancelled']);
export function deadline(order:{createdAt?:string;expiresAt?:string}){
  const created=Date.parse(order.createdAt??'');const expires=Date.parse(order.expiresAt??'');
  return Number.isFinite(expires)?expires:Number.isFinite(created)?created+600000:Infinity;
}
export function useOrderClock(serverTime?:string){
  const anchor=useMemo(()=>({server:Date.parse(serverTime??'')||Date.now(),client:Date.now()}),[serverTime]);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  return anchor.server+Math.max(0,now-anchor.client);
}
export function checkoutCountdown(end:number,now:number){
  const seconds=Math.max(0,Math.ceil((end-now)/1000));
  return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
}
