import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Clock3,HeartPulse} from 'lucide-react';
import {useStoreAccount} from './useStoreAccount';
import RecoveryPreview from './RecoveryPreview';
import PurchaseDialog from './PurchaseDialog';
import {findProduct} from './catalog';
export {RECOVERY_STATES} from './RecoveryPreview';
export default function RecoveryPanel({review=false}:{review?:boolean}){return review?<RecoveryPreview review/>:<LiveRecovery/>;}
function LiveRecovery(){
  const {data,error,loading,refresh}=useStoreAccount(),[purchase,setPurchase]=useState(false),[now,setNow]=useState(Date.now());
  const [received,setReceived]=useState(Date.now());
  useEffect(()=>{setReceived(Date.now());},[data?.serverTime]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const serverNow=data?new Date(data.serverTime).getTime()+now-received:now;
  const seconds=data?.recoveryUntil?Math.max(0,Math.ceil((new Date(data.recoveryUntil).getTime()-serverNow)/1000)):0;
  const clock=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
  useEffect(()=>{if(data?.recoveryUntil&&seconds===0)void refresh();},[data?.recoveryUntil,seconds,refresh]);
  return <section className="rs-recovery-options"><span className="rs-kicker">SERVER-CONTROLLED / OPERATIVE CARE</span><HeartPulse size={40}/><h2>{seconds?'OPERATIVE RECOVERING':'READY FOR YOUR NEXT MISSION'}</h2>{loading&&!data&&<p role="status">Checking recovery status…</p>}{error&&<p role="alert">{error}</p>}
    <p>Field first-aid restores 25 HP while you are alive. Death starts a two-hour recovery. Your next deployment starts at 100 HP once recovery is cleared by the server.</p>
    {seconds>0?<><div className="rs-recovery-clock"><Clock3/><span>{clock}</span><small>FREE RECOVERY COUNTDOWN</small></div><p>Wait for free recovery, or purchase instant recovery for $2.00. Closing checkout or an unverified payment does not clear this timer.</p><button className="rs-primary" disabled={!data?.configured||data.spendingBlocked} onClick={()=>setPurchase(true)}>INSTANT RECOVERY / $2.00</button></>:<Link className="rs-primary" to="/">RETURN TO LOBBY</Link>}
    {purchase&&<PurchaseDialog product={findProduct('revive')!} environment={data?.environment??undefined} onClose={()=>setPurchase(false)}/>}
  </section>;
}
