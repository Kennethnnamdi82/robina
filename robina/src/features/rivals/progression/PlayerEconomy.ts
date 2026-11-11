import { z } from 'zod';

// Fictional single-player currencies. Never read or write bounty USDC/account balances.
const integer = z.number().int().nonnegative().max(2_000_000_000);
const receiptSchema = z.object({ runId:z.string(), assignment:z.number().int().nonnegative(), cash:integer, coins:integer });
const stateSchema = z.object({ version:z.literal(1), cash:integer, coins:integer, earnedCash:integer, earnedCoins:integer, rewards:z.record(receiptSchema), spends:z.array(z.string()) });
export interface MissionReward { runId:string; assignment:number; cash:number; coins:number }
export interface EconomyState { version:1; cash:number; coins:number; earnedCash:number; earnedCoins:number; rewards:Record<string,MissionReward>; spends:string[]; persisted:boolean }
export interface SocialItem { id:'wine'|'dinner'|'coffee'|'meal'|'party'; name:string; price:number; heal:number; action:'drink'|'eat'|'party'; description:string }
export const SOCIAL_MENU:readonly SocialItem[] = [
  {id:'wine',name:'HOUSE RED',price:350,heal:0,action:'drink',description:'A glass at the Amber Room. Take a moment off the street.'},
  {id:'dinner',name:'MIDNIGHT SUPPER',price:900,heal:35,action:'eat',description:'A hot meal from the bartender. Restores up to 35 health.'},
  {id:'party',name:'JOIN THE PARTY',price:1500,heal:0,action:'party',description:'Buy a round and spend a moment on the dance floor.'},
  {id:'coffee',name:'ESPRESSO',price:180,heal:5,action:'drink',description:'Fresh coffee at the waterfront restaurant. Restores up to 5 health.'},
  {id:'meal',name:'CHEF’S PLATE',price:1200,heal:50,action:'eat',description:'Dinner served by your waiter. Restores up to 50 health.'},
];
export const missionReward = (stage:number) => ({ cash:20_000+Math.max(0,stage)*7_500, coins:[1500,2500,4000,5000,6500,8000,10000,12000,15000][Math.min(8,Math.max(0,stage))] });
export const reviveCost = (stage:number) => stage>=5?5000:stage>=2?2500:1000;
export const gameMoney = (amount:number) => '$'+Math.floor(amount).toLocaleString();
export const economyKey = (identity:string) => 'rivals_campaign_economy_v1:'+encodeURIComponent(identity);
export interface PlayerEconomy {
  getSnapshot:()=>EconomyState;
  subscribe:(listener:()=>void)=>()=>void;
  award:(runId:string,assignment:number)=>MissionReward;
  purchase:(item:SocialItem['id'],transactionId:string)=>SocialItem;
  revive:(transactionId:string,assignment:number)=>boolean;
}
const empty = ():EconomyState => ({version:1,cash:0,coins:0,earnedCash:0,earnedCoins:0,rewards:{},spends:[],persisted:true});
export function createPlayerEconomy(identity:string|null, storage?:Pick<Storage,'getItem'|'setItem'>):PlayerEconomy {
  let state=empty(); const listeners=new Set<()=>void>(),key=identity?economyKey(identity):'';
  if(identity&&!storage){try{storage=window.localStorage;}catch{state.persisted=false;}}
  if(!identity)state.persisted=false;
  function read(){
    if(!storage||!state.persisted)return;
    try{const raw=storage.getItem(key);if(raw)state={...stateSchema.parse(JSON.parse(raw)),persisted:true} as EconomyState;}
    catch{state={...state,persisted:false};}
  }
  function commit(next:EconomyState){
    if(storage&&state.persisted){try{storage.setItem(key,JSON.stringify(next));}catch{next={...next,persisted:false};}}
    state=next;listeners.forEach(listener=>listener());
  }
  read();
  return {
    getSnapshot:()=>state,
    subscribe:listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    award(runId,assignment){
      if(!runId||!Number.isInteger(assignment)||assignment<0||assignment>8)throw Error('Invalid completed contract.');
      read();if(state.rewards[runId])return state.rewards[runId];
      const reward={runId,assignment,...missionReward(assignment)};
      commit({...state,cash:state.cash+reward.cash,coins:state.coins+reward.coins,earnedCash:state.earnedCash+reward.cash,earnedCoins:state.earnedCoins+reward.coins,rewards:{...state.rewards,[runId]:reward}});return reward;
    },
    purchase(itemId,transactionId){
      const item=SOCIAL_MENU.find(item=>item.id===itemId);if(!item||!transactionId)throw Error('Unknown menu item.');
      read();if(state.spends.includes(transactionId))throw Error('This order has already been served.');
      if(state.cash<item.price)throw Error('Not enough mission cash. Complete a contract to earn your share.');
      commit({...state,cash:state.cash-item.price,spends:[...state.spends,transactionId]});return item;
    },
    revive(transactionId,assignment){
      read();if(!transactionId||state.spends.includes(transactionId))return false;
      const cost=reviveCost(assignment);if(state.coins<cost)return false;
      commit({...state,coins:state.coins-cost,spends:[...state.spends,transactionId]});return true;
    },
  };
}
