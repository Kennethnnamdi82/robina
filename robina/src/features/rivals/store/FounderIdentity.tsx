import {BadgeCheck,Crown} from 'lucide-react';
import {useStoreAccount} from './useStoreAccount';
import './founder.css';
import {payments,refreshStore,paymentError} from '@/services/payments';
import {useState} from 'react';
export default function FounderIdentity(){
  const {data}=useStoreAccount();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  if(data?.appearance?.identity!=='founder'||!data.ownedIds.includes('founder'))return null;
  return <section className="rh-panel rs-founder-identity" aria-label="Verified founder identity"><Crown size={28}/><div><span className="rh-eyebrow">VERIFIED FOUNDER</span><h2>FOUNDING OPERATIVE</h2><p>Founder insignia / command profile border / founding title</p>{error&&<p role="alert">{error}</p>}<button className="rs-secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await payments.equip(null,'identity');refreshStore();}catch(e){setError(paymentError(e));}finally{setBusy(false);}}}>HIDE FOUNDER IDENTITY</button></div><BadgeCheck aria-label="Founder badge"/></section>;
}
