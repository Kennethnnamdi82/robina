import {StoreSeason,StoreSeasonClaim,StoreOrder,StoreLedger} from './storeModels.js';
import {MissionSession} from '../missions/models.js';
import {getProduct} from './catalog.js';
import {transaction,inventory,fail,storeEnvironment} from './service.js';
export const currentSeason=()=>StoreSeason.findOne({status:'published',startsAt:{$lte:new Date()},endsAt:{$gt:new Date()}}).lean();
const wins=(playerId,season,session)=>MissionSession.countDocuments({playerId,status:'verified_success',authority:true,integrity:'verified',endedAt:{$gte:season.startsAt,$lt:season.endsAt}}).session(session??null);
export async function seasonSnapshot(playerId,environment){
  const season=await currentSeason();if(!season)return null;
  const [completed,pass,claims]=await Promise.all([wins(playerId,season),StoreOrder.exists({playerId,environment,seasonId:season._id,kind:'season',status:'fulfilled'}),StoreSeasonClaim.find({playerId,environment,seasonId:season._id}).lean()]);
  return {...season,wins:completed,hasPass:Boolean(pass),free:season.free.map(r=>({...r,claimed:claims.some(c=>c.rewardId==='free:'+r.id)})),premium:season.premium.map(r=>({...r,claimed:claims.some(c=>c.rewardId==='premium:'+r.id)}))};
}
export async function publishSeason(input,actor){
  if(new Date(input.endsAt)<=new Date()||new Date(input.endsAt)<=new Date(input.startsAt))fail('invalid_season_dates',400);
  for(const track of [input.free,input.premium]){
    if(new Set(track.map(r=>r.id)).size!==track.length)fail('duplicate_season_reward',400);
    for(const r of track)if(!['character','finish','effect','weapon','grenades'].includes(getProduct(r.sku)?.kind))fail('invalid_season_reward',400);
  }
  return transaction(async session=>{
    if(await StoreSeason.exists({status:'published'}).session(session))fail('close_existing_season_first');
    const [created]=await StoreSeason.create([{...input,status:'published'}],{session});
    await StoreLedger.create([{key:'audit:season:'+input._id,playerId:'000000000000000000000000',kind:'audit',actor,detail:'season_published:'+input._id}],{session});return created;
  });
}
export async function closeSeason(id,actor){return transaction(async session=>{
  const row=await StoreSeason.findOneAndUpdate({_id:id,status:'published'},{$set:{status:'closed'}},{session,new:true});if(!row)fail('season_not_found',404);
  await StoreLedger.create([{key:'audit:season-close:'+id,playerId:'000000000000000000000000',kind:'audit',actor,detail:'season_closed:'+id}],{session});return row;
});}
export async function claimReward(playerId,seasonId,track,rewardId,environment=storeEnvironment()){
  return transaction(async session=>{
    const season=await StoreSeason.findOne({_id:seasonId,status:'published',startsAt:{$lte:new Date()},endsAt:{$gt:new Date()}}).session(session);
    if(!season)fail('season_not_active');const reward=season[track].find(r=>r.id===rewardId);if(!reward)fail('season_reward_not_found',404);
    const account=await inventory(playerId,session,environment);if(account.spendingBlocked)fail('payment_account_under_review');
    const pass=track==='premium'?await StoreOrder.findOne({playerId,environment,seasonId,kind:'season',status:'fulfilled'}).session(session):null;
    if(track==='premium'&&!pass)fail('premium_pass_required');if(await wins(playerId,season,session)<reward.wins)fail('season_progress_required');
    const key=`season:${environment}:${playerId}:${seasonId}:${track}:${rewardId}`;
    if(await StoreSeasonClaim.exists({_id:key}).session(session))return {claimed:true,duplicate:true};
    const product=getProduct(reward.sku);if(product.kind==='grenades'){if(account.grenades+product.quantity>1000000)fail('inventory_limit');account.grenades+=product.quantity;}
    else if(!account.ownedIds.includes(reward.sku))account.ownedIds.push(reward.sku);
    await StoreSeasonClaim.create([{_id:key,playerId,environment,seasonId,rewardId:track+':'+rewardId,sku:reward.sku,sourceOrderId:pass?._id??null}],{session});
    await StoreLedger.create([{key,playerId,kind:'grant',sku:reward.sku,quantity:product.quantity??1,detail:'verified_season_reward'}],{session});
    account.version++;await account.save({session});return {claimed:true};
  });
}
