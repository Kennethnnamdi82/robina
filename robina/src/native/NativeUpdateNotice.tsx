import {useEffect,useState} from 'react';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {isNativeAndroid} from './platform';
import {loadAndroidRelease,type AndroidRelease} from './AndroidDownload';
export default function NativeUpdateNotice(){
 const [release,setRelease]=useState<AndroidRelease|null>(null),[dismissed,dismiss]=useState(false);
 useEffect(()=>{if(!isNativeAndroid())return;let active=true;void Promise.all([App.getInfo(),loadAndroidRelease()]).then(([app,available])=>{if(active&&available.available&&Number.isFinite(Number(app.build))&&(available.versionCode||0)>Number(app.build))setRelease(available);}).catch(()=>{});return()=>{active=false;};},[]);
 if(!release||dismissed)return null;
 return <aside className="native-update" aria-label="Android update available"><div><strong>A NEW HEIST AWAITS</strong><p>RIVALS {release.version} is ready — install the official update to keep your app current</p></div><button onClick={()=>void Browser.open({url:release.url!})}>GET UPDATE</button><button aria-label="Dismiss update notification" onClick={()=>dismiss(true)}>LATER</button></aside>;
}
