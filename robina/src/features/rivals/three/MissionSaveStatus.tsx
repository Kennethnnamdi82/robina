import { useSyncExternalStore } from 'react';
import { LocalMission } from '@/services/localMission';
import type {SandboxSession} from './SandboxSession';
const emptySubscribe=()=>()=>{};
export function MissionSaveStatus({session}:{session:SandboxSession}){
  const local=session.authority instanceof LocalMission?session.authority:undefined;
  useSyncExternalStore(local?listener=>local.subscribe(listener):emptySubscribe,()=>local?local.saving+local.saveError:'idle');
  if(!local||local.saving==='idle'||local.saving==='verified'||local.saving==='rejected')return null;
  return <aside className="r3-life-status" role="status">{local.saving==='saving'?'Mission completed. Verifying and saving your result…':<>Your completed mission is waiting to sync. {local.saveError} <button onClick={()=>void local.retrySave()}>RETRY SAVE</button></>}</aside>;
}
