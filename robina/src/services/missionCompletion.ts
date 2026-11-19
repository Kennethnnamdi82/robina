import { missionsApi, type CompletionStatus } from './missions';
import type { ReplayTape, MissionPermit } from '@/features/rivals/authority/MissionReplay';
import type { MissionSnapshot } from '@/features/rivals/missions/types';
import type { VerifiedGameResult } from './missionAuthority';

export interface PendingMission {key:string;owner:string;id:string;token:string;replay:string;snapshot:MissionSnapshot;venue:number;persisted?:boolean;rejection?:string}
export function isFinalCompletionError(message:string){
  return ['invalid_mission_replay','mission_replay_not_successful','mission_version_mismatch','invalid_mission_permit',
    'impossible_mission_duration','mission_inventory_changed','no_grenades_remaining','mission_replay_conflict'].includes(message);
}
const database='rivals-successful-missions-v1';
async function db(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(database,1);request.onupgradeneeded=()=>request.result.createObjectStore('successes',{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function access<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const connection=await db();
  try{return await new Promise<T>((resolve,reject)=>{const tx=connection.transaction('successes',mode),request=work(tx.objectStore('successes'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('Mission save interrupted'));});}finally{connection.close();}
}
export const pendingMissions={
  put:(entry:PendingMission)=>access('readwrite',store=>store.put(entry)),
  remove:(key:string)=>access('readwrite',store=>store.delete(key)),
  list:async(owner:string)=>(await access<PendingMission[]>('readonly',store=>store.getAll())).filter(row=>row.owner===owner),
};
export async function prepareCompletion(owner:string,permit:MissionPermit,tape:ReplayTape,snapshot:MissionSnapshot,venue:number):Promise<PendingMission>{
  if(snapshot.state!=='SUCCESS')throw Error('Only successful missions can be saved');
  const stream=new Blob([JSON.stringify(tape)]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes=new Uint8Array(await new Response(stream).arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const entry={key:owner+':'+permit.id,owner,id:permit.id,token:permit.token,replay:btoa(binary),snapshot:{...snapshot,runId:permit.id},venue,persisted:true};
  if(entry.replay.length>24000000)throw Error('Completed mission replay is too large to upload');
  // Storage denial must not prevent an online player from saving a victory.
  try{await pendingMissions.put(entry);}catch{entry.persisted=false;}
  return entry;
}
const inFlight=new Map<string,Promise<VerifiedGameResult>>();
export function sendCompletion(entry:PendingMission):Promise<VerifiedGameResult>{
  if(entry.rejection)return Promise.reject(Error(entry.rejection));
  const existing=inFlight.get(entry.key);if(existing)return existing;
  const task=(async()=>{
    const count=Math.ceil(entry.replay.length/40000);let state:CompletionStatus={status:'missing',id:entry.id};
    const deadline=Date.now()+180000;
    while(Date.now()<deadline){
      if(state.status==='missing'||state.status==='uploading'){
        for(let index=0;index<count;index++){
          state=await missionsApi.upload({permit:entry.token,index,count,chunk:entry.replay.slice(index*40000,(index+1)*40000)});
          if(['verified','queued','verifying','rejected'].includes(state.status))break;
        }
      }
      if(state.status==='verified'&&state.result){await pendingMissions.remove(entry.key).catch(()=>{});if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('rivals:mission-saved',{detail:{owner:entry.owner}}));return state.result;}
      if(state.status==='rejected')throw Error(state.error||'Mission verification failed');
      await new Promise(resolve=>setTimeout(resolve,1000));state=await missionsApi.completion(entry.id);
    }
    throw Error('Mission verification is taking longer. Your completed run is kept on this device.');
  })().catch(async(error:unknown)=>{
    if(error instanceof Error&&isFinalCompletionError(error.message)){
      entry.rejection=error.message;
      if(entry.persisted!==false)await pendingMissions.put(entry).catch(()=>{});
    }
    throw error;
  }).finally(()=>inFlight.delete(entry.key));
  inFlight.set(entry.key,task);return task;
}
