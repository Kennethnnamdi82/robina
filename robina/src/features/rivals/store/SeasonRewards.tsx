import {useState} from 'react';
import {payments,paymentError,refreshStore} from '@/services/payments';
import {useStoreAccount} from './useStoreAccount';
import {findProduct,type Product} from './catalog';
import ProductArt from './ProductArt';
export default function SeasonRewards({onOpen}:{onOpen:(p:Product)=>void}){
  const {data,loading,error}=useStoreAccount();const [busy,setBusy]=useState(''),[failure,setFailure]=useState('');const season=data?.season;
  if(loading&&!data)return <p role="status">LOADING VERIFIED SEASON PROGRESS...</p>;
  if(error)return <p role="alert">{error}</p>;
  if(!season)return <section className="rs-empty"><h3>NO ACTIVE SEASON</h3><p>The owner has not published an active season. No pass can be purchased until its dates and rewards are published.</p></section>;
  return <><section className="rs-season-hero"><div><span className="rs-kicker">ACTIVE SEASON / SERVER-VERIFIED PROGRESS</span><h2>{season.name}</h2><p>{season.wins} verified mission wins / Ends {new Date(season.endsAt).toLocaleDateString()}</p>{season.hasPass?<strong>PREMIUM TRACK UNLOCKED</strong>:<button className="rs-primary" onClick={()=>onOpen(findProduct('pass')!)}>REVIEW PREMIUM PASS / $6.99</button>}<p>Only verified mission wins during this season unlock rewards. A pass does not skip the required wins.</p></div><ProductArt product={findProduct('golden')!} large/></section>
    {failure&&<p role="alert">{failure}</p>}<div className="rs-reward-tracks">{(['free','premium'] as const).map(track=><section key={track}><header><h3>{track.toUpperCase()} TRACK</h3></header><div>{season[track].map(reward=>{const p=findProduct(reward.sku);if(!p)return null;const key=track+reward.id;return <article key={reward.id}><button onClick={()=>onOpen(p)}><ProductArt product={p}/><strong>{p.name}</strong></button><p>{reward.wins} verified wins required</p><button className="rs-secondary" disabled={Boolean(busy)||reward.claimed||season.wins<reward.wins||track==='premium'&&!season.hasPass} onClick={async()=>{setBusy(key);setFailure('');try{await payments.claim(season._id,track,reward.id);refreshStore();}catch(e){setFailure(paymentError(e));}finally{setBusy('');}}}>{reward.claimed?'CLAIMED':busy===key?'CLAIMING...':track==='premium'&&!season.hasPass?'PREMIUM PASS REQUIRED':season.wins<reward.wins?'KEEP PLAYING':'CLAIM REWARD'}</button></article>;})}</div></section>)}</div></>;
}
