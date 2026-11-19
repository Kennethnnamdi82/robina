import crypto from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Worker } from 'node:worker_threads';
import { env } from '../config/env.js';
import { MissionSession, VerifiedMissionResult } from './models.js';
import { StoreInventory, StoreLedger } from '../payments/storeModels.js';
import { appearance } from '../payments/entitlements.js';
import { inventory, storeEnvironment, transaction, fail } from '../payments/service.js';
import { REPLAY_SCORE_VERSION, scoreVerifiedRun } from './score.js';
import { SIMULATION_VERSION } from '../../generated/missionSimulation.mjs';

const audience='rivals-mission-replay-v1';
const CHUNK_SIZE=40000,MAX_CHUNKS=600;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
export class MissionCompletions {
  jobs=new Map(); workers=new Set();closing=false;
  async permit(playerId,{missionId,seed}) {
    // Launch authorization is stateless: no mission/session/checkpoint is saved.
    const account=await StoreInventory.findOne({playerId,environment:storeEnvironment()}).lean();
    const initial={grenades:account?.spendingBlocked?0:account?.grenades??5,ownedIds:account?.spendingBlocked?[]:account?.ownedIds??[],
      weapon:account?.spendingBlocked?null:account?.equippedWeapon??null,appearance:appearance(account??{ownedIds:[]})};
    const permit={id:new mongoose.Types.ObjectId().toString(),missionId,seed:seed??crypto.randomInt(0,4294967296),
      simulationVersion:SIMULATION_VERSION,issuedAt:Date.now(),maxTicks:432000,initial};
    const token=jwt.sign(permit,env.jwtSecret,{algorithm:'HS256',audience,issuer:'rivals',subject:String(playerId),expiresIn:'7d'});
    return {...permit,token};
  }
  authorize(playerId,token) {
    try {
      const permit=jwt.verify(token,env.jwtSecret,{algorithms:['HS256'],audience,issuer:'rivals'});
      if(permit.sub!==String(playerId)||permit.simulationVersion!==SIMULATION_VERSION||!mongoose.isValidObjectId(permit.id))throw Error();
      return permit;
    }catch{fail('invalid_mission_permit',403);}
  }
  async status(playerId,id) {
    const result=await VerifiedMissionResult.findOne({sessionId:id,playerId}).lean();
    if(result)return {status:'verified',id,result};
    const job=this.jobs.get(id);
    if(!job||job.playerId!==String(playerId))return {status:'missing',id};
    return {status:job.status,id,error:job.error,received:job.chunks?.filter(Boolean).length??job.count,total:job.count};
  }
  async receive(playerId,{permit:token,index,count,chunk}) {
    const permit=this.authorize(playerId,token),id=permit.id;
    if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||count>MAX_CHUNKS||index<0||index>=count||
      typeof chunk!=='string'||chunk.length<1||chunk.length>CHUNK_SIZE||chunk.length%4||
      index<count-1&&(chunk.length!==CHUNK_SIZE||chunk.includes('='))||!/^[A-Za-z0-9+/]+={0,2}$/.test(chunk))fail('invalid_mission_replay',400);
    const existing=await VerifiedMissionResult.findOne({sessionId:id,playerId}).lean();
    if(existing)return {status:'verified',id,result:existing};
    for(const [key,row]of this.jobs)if(Date.now()-row.touched>(row.status==='uploading'?2:15)*60000&&row.status!=='verifying')this.jobs.delete(key);
    let job=this.jobs.get(id);
    if(job?.status==='rejected'&&job.error==='mission_verification_failed'){this.jobs.delete(id);job=undefined;}
    if(!job){
      const active=[...this.jobs.values()].filter(row=>row.status!=='rejected');
      if(active.length>=8||active.filter(row=>row.playerId===String(playerId)).length>=2)fail('mission_verifier_busy',503);
      // Rejected proofs must not occupy the verification queue for other players.
      if(this.jobs.size>=256){const rejected=[...this.jobs].find(([,row])=>row.status==='rejected');if(rejected)this.jobs.delete(rejected[0]);}
      job={playerId:String(playerId),permit,tokenDigest:digest(token),count,chunks:Array(count).fill(null),status:'uploading',touched:Date.now()};this.jobs.set(id,job);
    }
    if(job.playerId!==String(playerId)||job.count!==count||job.tokenDigest!==digest(token))fail('mission_replay_conflict',409);
    if(job.status==='rejected')fail(job.error,422);
    if(['verifying','queued'].includes(job.status))return {status:job.status,id};
    if(job.chunks[index]&&job.chunks[index]!==chunk)fail('mission_replay_conflict',409);
    const buffered=[...this.jobs.values()].reduce((size,row)=>size+(row.buffered??0),0);
    if(!job.chunks[index]&&buffered+chunk.length>24000000)fail('mission_verifier_busy',503);
    if(!job.chunks[index])job.buffered=(job.buffered??0)+chunk.length;
    job.chunks[index]=chunk;job.touched=Date.now();
    if(job.chunks.every(Boolean)){
      job.status='queued';this.pump();
    }
    return {status:job.status,id,received:job.chunks?.filter(Boolean).length??count,total:count};
  }
  pump(){
    if(this.closing||this.workers.size)return;
    const job=[...this.jobs.values()].find(row=>row.status==='queued');if(!job)return;
    const replay=job.chunks.join('');job.chunks=null;job.status='verifying';
    void this.verify(job,replay).catch(error=>{
      job.buffered=0;job.status='rejected';job.error=['invalid_mission_replay','mission_replay_not_successful','mission_version_mismatch','impossible_mission_duration','mission_inventory_changed','no_grenades_remaining'].includes(error.message)?error.message:'mission_verification_failed';job.touched=Date.now();
      if(job.error==='mission_verification_failed')console.error('[missions] Completed-run verification failed',error.code??error.message);
    }).finally(()=>this.pump());
  }
  async verify(job,replay) {
    const worker=new Worker(new URL('./replayWorker.js',import.meta.url),{workerData:{permit:job.permit,replay},resourceLimits:{maxOldGenerationSizeMb:256}});
    this.workers.add(worker);
    try {
      const proof=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{void worker.terminate();reject(new Error('mission_verification_timeout'));},120000);timer.unref();
        let settled=false;
        const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
        worker.once('message',message=>finish(message.ok?null:new Error(message.error),message.proof));
        worker.once('error',error=>finish(error));worker.once('exit',()=>finish(new Error('mission_verification_failed')));
      });
      if(proof.durationSeconds>(Date.now()-job.permit.issuedAt)/1000+2)fail('impossible_mission_duration',422);
      const proofDigest=digest(replay);
      await this.settle(job.playerId,job.permit,proof,proofDigest);
      this.jobs.delete(job.permit.id);
    }finally{this.workers.delete(worker);await worker.terminate();}
  }
  async settle(playerId,permit,proof,proofDigest) {
    for(let attempt=0;attempt<3;attempt++){
      try{return await transaction(async session=>{
        const existing=await VerifiedMissionResult.findOne({sessionId:permit.id,playerId}).session(session);if(existing)return existing;
        const account=await inventory(playerId,session);
        if(account.spendingBlocked||permit.initial.weapon&&!account.ownedIds.includes(permit.initial.weapon))fail('mission_inventory_changed');
        const delta=proof.grenadeBalance-permit.initial.grenades;
        if(account.grenades+delta<0)fail('no_grenades_remaining');
        const firstCompletion=!await VerifiedMissionResult.exists({playerId,missionId:permit.missionId,firstCompletion:true}).session(session);
        const endedAt=new Date(),durationSeconds=proof.durationSeconds;
        const score=scoreVerifiedRun({...proof.metrics,durationSeconds,remainingHealth:proof.health,maxHealth:proof.maxHealth});
        // All durable mission writes happen together, after successful replay.
        await MissionSession.create([{_id:permit.id,playerId,missionId:permit.missionId,seed:permit.seed,configVersion:SIMULATION_VERSION,
          authority:true,verificationSource:'replay',proofDigest,startedAt:new Date(permit.issuedAt),endedAt,reconnectDeadline:endedAt,
          status:'verified_success',verifiedOutcome:'success',integrity:'verified',health:proof.health,maxHealth:proof.maxHealth,grenadesSpent:proof.grenadesSpent}],{session});
        const [result]=await VerifiedMissionResult.create([{playerId,sessionId:permit.id,missionId:permit.missionId,outcome:'success',
          score,scoreVersion:REPLAY_SCORE_VERSION,durationSeconds,remainingHealth:proof.health,enemiesDefeated:proof.metrics.enemiesDefeated,
          shotsFired:proof.metrics.shotsFired,successfulHits:proof.metrics.successfulHits,optionalCompleted:proof.metrics.optionalCompleted,
          firstCompletion,rewardEligible:firstCompletion,verifiedAt:endedAt}],{session});
        account.grenades+=delta;account.version++;await account.save({session});
        if(proof.grenadesSpent)await StoreLedger.create([{key:`replay-spent:${permit.id}`,playerId,kind:'grenade_spent',quantity:proof.grenadesSpent}],{session});
        const pickups=delta+proof.grenadesSpent;
        if(pickups)await StoreLedger.create([{key:`replay-pickup:${permit.id}`,playerId,kind:'grant',sku:'field-grenade',quantity:pickups}],{session});
        return result;
      });}catch(error){if(error.code!==11000||attempt===2)throw error;}
    }
  }
  async close(){this.closing=true;await Promise.allSettled([...this.workers].map(worker=>worker.terminate()));this.jobs.clear();}
}
