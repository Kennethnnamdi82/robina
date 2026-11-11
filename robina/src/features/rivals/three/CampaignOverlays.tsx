import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Coins, UtensilsCrossed, Wine, X } from 'lucide-react';
import { gameMoney, missionReward, reviveCost, SOCIAL_MENU } from '../progression/PlayerEconomy';
import { usePlayerEconomy } from '../progression/usePlayerEconomy';
import { ASSIGNMENTS } from '../missions/assignments';
import { SOCIAL_VENUES, venueAt } from './SocialVenues';
import type { SandboxSession } from './SandboxSession';
import type { Diagnostics3D, RaidRuntime } from './RaidRuntime';
import './social.css';

export function CampaignOverlays({session,runtime,metrics,guideOpen,onCloseGuide}:{session:SandboxSession;runtime?:RaidRuntime;metrics?:Diagnostics3D;guideOpen:boolean;onCloseGuide:()=>void}){
  const balance=usePlayerEconomy(session.economy),[error,setError]=useState('');
  const stage=session.operation.assignment??0,down=session.revivePending,handoff=metrics?.campaign?.handoff==='waiting';
  const venue=metrics?.social?.venue?venueAt(metrics.social.venue):null;
  const open=down||handoff||Boolean(venue)||guideOpen;
  const close=()=>{setError('');if(down)runtime?.declineRevive();else if(handoff)runtime?.cancelHandoff();else if(venue)runtime?.closeSocial();else onCloseGuide();};
  const title=down?'BACK IN THE FIGHT':handoff?'THE BROKER’S CUT':venue?.name??'A MOMENT OFF THE STREET';
  const description=down?'Spend achievement coins to recover here with health and a short protection window.':handoff?'The bag is secure. Hand it over to your boss to finish the contract and collect your share.':venue?'Your waiter is ready. Mission cash only; no USDC or real-money purchases.':'Set a waterfront detour on your GPS. Your mission remains active. Lose the police before ordering.';
  return <Dialog.Root open={open} onOpenChange={value=>{if(!value)close();}}><Dialog.Portal><Dialog.Overlay className="r3-story-backdrop"/><Dialog.Content className="r3-story" onEscapeKeyDown={event=>{if(down)event.preventDefault();}} onPointerDownOutside={event=>event.preventDefault()}>
    <span className="r3-story-kicker">{down?'OPERATIVE DOWN':handoff?'PRIVATE TABLE / EXTRACTION':venue?.subtitle??'WATERFRONT / CITY LIFE'}</span>
    <Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description>
    {!down&&<Dialog.Close className="r3-story-close" aria-label="Return to mission"><X size={20}/></Dialog.Close>}
    {down?<><div className="r3-story-balance"><Coins/><span>REVIVE COINS<strong>{balance.coins.toLocaleString()}</strong></span><span>THIS REVIVE<strong>{reviveCost(stage).toLocaleString()}</strong></span></div><button className="rivals-primary" disabled={!runtime||balance.coins<reviveCost(stage)} onClick={()=>{if(!runtime?.revive())setError('Revive unavailable. Your coins have not been spent.');}}>SPEND {reviveCost(stage).toLocaleString()} COINS / REVIVE</button>{balance.coins<reviveCost(stage)&&<p>Not enough coins. Successful contracts earn achievement coins for future runs.</p>}<button className="rivals-secondary" onClick={close}>END THIS RUN</button></>:handoff?<><div className="r3-story-receipt"><Wine/><span>YOUR SHARE<strong>{gameMoney(missionReward(stage).cash)}</strong></span><span>ACHIEVEMENT<strong>+{missionReward(stage).coins.toLocaleString()} COINS</strong></span></div><p>Cash is for meals, drinks and nightlife. Coins are for revives. Neither has real-money value.</p><button className="rivals-primary" onClick={()=>{if(!runtime?.confirmHandoff())setError('The handoff is not safe yet. Lose the police and return with the bag.');}}>HAND OVER THE BAG <ArrowUpRight size={18}/></button></>:venue?<><div className="r3-story-balance"><UtensilsCrossed/><span>MISSION CASH<strong>{gameMoney(balance.cash)}</strong></span></div><div className="r3-social-menu">{SOCIAL_MENU.filter(item=>(venue.menu as readonly string[]).includes(item.id)).map(item=><article key={item.id}><div><h3>{item.name}</h3><p>{item.description}</p></div><button className="rivals-secondary" disabled={!runtime||balance.cash<item.price} onClick={()=>{try{runtime?.purchaseSocial(item.id);setError('');}catch(failure){setError(failure instanceof Error?failure.message:'Your order could not be served.');}}}>ORDER / {gameMoney(item.price)}</button></article>)}</div>{balance.cash===0&&<p>Complete your first contract to earn spending cash. You can still explore the venue.</p>}</>:<div className="r3-social-menu">{SOCIAL_VENUES.map(place=><article key={place.id}><div><h3>{place.name}</h3><p>{place.subtitle}</p><small>Open doors, seated guests and waiter service.</small></div><button className="rivals-secondary" onClick={()=>{runtime?.routeToVenue(place.id);onCloseGuide();session.resume();}}>SET GPS DETOUR <ArrowUpRight size={15}/></button></article>)}{metrics?.social?.destination&&<button className="rivals-secondary" onClick={()=>{runtime?.routeToVenue(null);onCloseGuide();session.resume();}}>RETURN GPS TO MISSION</button>}</div>}
    {error&&<p role="alert">{error}</p>}<small className="r3-story-footnote">{balance.persisted?'Campaign balances saved on this device.':'Session-only balances: storage is unavailable.'} Fictional game currency, separate from Bounty & Earn.</small>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function MissionRewardReceipt({session}:{session:SandboxSession}){
  const balance=usePlayerEconomy(session.economy),reward=balance.rewards[session.mission.runId];
  if(!reward)return null;
  return <div className="r3-earned" role="status"><span>{ASSIGNMENTS[reward.assignment]?.bossHandoff?'THE BOSS PAID YOUR SHARE':'CONTRACT PAYMENT RECEIVED'}</span><strong>{gameMoney(reward.cash)} <small>MISSION CASH</small></strong><strong><Coins size={17}/> +{reward.coins.toLocaleString()} <small>ACHIEVEMENT COINS</small></strong><p>Cash buys food and drinks. Coins fund revives.</p></div>;
}
