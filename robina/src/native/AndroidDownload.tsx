import {useEffect,useState} from 'react';
import {Download,Smartphone,ShieldCheck} from 'lucide-react';
import {isNativeAndroid,OFFICIAL_ORIGIN} from './platform';
import './android-download.css';
export interface AndroidRelease {available:boolean;url?:string;version?:string;versionCode?:number;bytes?:number;minAndroid?:string}
export async function loadAndroidRelease(signal?:AbortSignal):Promise<AndroidRelease>{
 const response=await fetch((isNativeAndroid()?OFFICIAL_ORIGIN:'')+'/api/android-release',{signal,credentials:'omit'});if(!response.ok)return {available:false};
 const value=await response.json();
 if(value.available===true&&value.url!=='https://github.com/Kennethnnamdi82/rivals-heist-android/releases/latest/download/RIVALS-RIVAL-HEIST.apk')return {available:false};return value;
}
export default function AndroidDownload(){
 const [release,setRelease]=useState<AndroidRelease|null>(null),android=/Android/i.test(navigator.userAgent);
 useEffect(()=>{const controller=new AbortController();void loadAndroidRelease(controller.signal).then(setRelease).catch(()=>{if(!controller.signal.aborted)setRelease({available:false});});return()=>controller.abort();},[]);
 if(isNativeAndroid())return null;
 return <aside className="android-download" data-android={android} aria-label="Android game download"><div className="android-download-heading"><span className="android-download-icon"><Smartphone size={25}/></span><div><span>THE CITY / IN YOUR POCKET</span><h2>RIVALS FOR ANDROID</h2></div><span className="android-apk-label">APK</span></div><p>Install the dedicated game — keep your existing account and play in fullscreen</p>
  {release?.available?<><a className="android-download-button" href={release.url} download="RIVALS-RIVAL-HEIST.apk"><Download size={19}/><span>DOWNLOAD FOR ANDROID<small>v{release.version} · {Math.ceil((release.bytes||0)/1048576)} MB · Android {release.minAndroid}+</small></span></a><p className="android-download-safety"><ShieldCheck size={15}/> Official signed APK — Android may ask you to allow this download</p></>:<><button className="android-download-button" disabled><Download size={18}/>{release===null?'CHECKING ANDROID RELEASE':'ANDROID RELEASE NOT AVAILABLE YET'}</button><p className="android-download-safety">{release===null?'Checking the official download':'You can still sign in above and play in your browser'}</p></>}
 </aside>;
}
