import {Capacitor,registerPlugin} from '@capacitor/core';
import type {PluginListenerHandle} from '@capacitor/core';
export const isNativeAndroid=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
export const OFFICIAL_ORIGIN='https://rivals-heist.vercel.app';
export interface NativeResponse {status:number;data:unknown}
export const NativeSession=registerPlugin<{
  request(options:{path:string;method:string;body?:string;idempotencyKey?:string}):Promise<NativeResponse>;
  beginLogin():Promise<{url:string}>;
  cancelLogin():Promise<void>;
  completeLogin(options:{url:string}):Promise<NativeResponse>;
  addListener(eventName:'audioInterrupted',listener:()=>void):Promise<PluginListenerHandle>;
}>('RivalsSession');
