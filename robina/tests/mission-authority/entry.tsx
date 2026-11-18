import {createRoot} from 'react-dom/client';
import RaidApp from '../../src/features/rivals/three/RaidApp';
import {createAssignmentOperation} from '../../src/features/rivals/three/Operations';
import {defaultHubPreferences} from '../../src/features/rivals/hub/model';
import {MissionAuthorityClient} from '../../src/services/missionAuthority';
// Test-entry instrumentation only: retain pause causes and frame positions even
// when a slow software renderer cannot publish HUD diagnostics regularly.
import {PresentationCorrection} from '../../src/features/rivals/three/PresentationCorrection';
const movementAudit={pauses:[] as {at:number;stack:string|undefined;hidden:boolean;interrupted:boolean|undefined;stalled:boolean}[],samples:[] as {at:number;z:number}[],recording:false};
Object.assign(window,{movementAudit});
const pause=MissionAuthorityClient.prototype.pause;
MissionAuthorityClient.prototype.pause=function(value){
  if(value&&!Reflect.get(this,'paused'))movementAudit.pauses.push({at:performance.now(),stack:new Error().stack,hidden:document.hidden,
    interrupted:this.latest?.movementInterrupted,stalled:Boolean(this.movementStalled)});
  return pause.call(this,value);
};
const present=PresentationCorrection.prototype.present;
PresentationCorrection.prototype.present=function(position,dt,out){
  const result=present.call(this,position,dt,out);
  if(movementAudit.recording)movementAudit.samples.push({at:performance.now(),z:result.z});
  return result;
};
createRoot(document.getElementById('root')!).render(<RaidApp operation={createAssignmentOperation(0,42)} preferences={{...defaultHubPreferences(),quality:'low',muted:true}}/>);
