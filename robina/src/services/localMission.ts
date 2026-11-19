import { MissionAuthorityClient } from './missionAuthority';
import { initializeReplay, MAX_REPLAY_TICKS, MissionRecorder, type MissionPermit } from '@/features/rivals/authority/MissionReplay';
import type { AuthorityAction, AuthorityInput } from '@/features/rivals/authority/MissionSimulation';
import { isFinalCompletionError, pendingMissions, prepareCompletion, sendCompletion, type PendingMission } from './missionCompletion';

/** One local gameplay clock. No WebSocket, heartbeat, position correction or
 * mission persistence runs while this simulation is active. */
export class LocalMission extends MissionAuthorityClient {
  declare readonly localSimulation:ReturnType<typeof initializeReplay>;
  readonly recorder=new MissionRecorder();
  saving:'idle'|'saving'|'pending'|'verified'|'rejected'='idle';saveError='';
  private localPaused=false;private localReady=false;private inactive=false;private dirty=false;
  private pendingCompletion?:PendingMission;private finishing=false;
  private saveRetry?:ReturnType<typeof setTimeout>;private saveAttempts=0;
  private online=()=>{if(this.saving==='pending')void this.retrySave();};
  constructor(readonly permit:MissionPermit,private owner:string){super(permit.id);this.localSimulation=initializeReplay(permit);this.latest=this.localSimulation.snapshot();this.connection='connected';if(typeof window!=='undefined')window.addEventListener('online',this.online);}
  override async connect() { /* Launch permit already authorizes this local run. */ }
  override get movementStalled(){return false;}
  override ready(){this.localReady=true;}
  override pause(value:boolean){this.localPaused=value;}
  override submit(frame:Omit<AuthorityInput,'seq'>){
    if(this.inactive||!this.localReady||this.localPaused||this.localSimulation.mission.state!=='ACTIVE')return;
    if(this.recorder.tape.ticks>=Math.min(this.permit.maxTicks,MAX_REPLAY_TICKS)){this.localSimulation.mission.fail('Mission recording time limit reached. Return to the briefing to start again.');this.dirty=true;return;}
    this.localSimulation.input(this.recorder.input(frame));this.localSimulation.step();this.dirty=true;this.events();
  }
  private events(){
    for(const event of this.localSimulation.drainEvents()){
      if(event.type==='shot')this.onShot?.(event);
      else if(event.type==='impact'||event.type==='blast')this.onEffect?.(event);
      else if(event.type==='health'&&event.kind==='damage')this.onDamage?.(event.amount,event.angle??0);
    }
  }
  override action(action:AuthorityAction){
    if(this.inactive||!this.localReady||this.localSimulation.mission.state!=='ACTIVE')return;
    // Handoff/pickup choices deliberately block movement while their menu is open.
    if(this.localPaused&&['weapon','vehicle','grenade'].includes(action.type))return;
    if(this.recorder.tape.actions.length>=20000){this.localSimulation.mission.fail('Mission action limit reached. Return to the briefing to start again.');this.dirty=true;this.flushMovement();return;}
    this.recorder.action(action);this.localSimulation.action(action);this.events();this.dirty=true;this.flushMovement();
  }
  override flushMovement(){
    if(this.dirty){this.latest=this.localSimulation.snapshot();this.dirty=false;this.notify();}
    if(this.localSimulation.mission.state==='SUCCESS'&&this.saving==='idle')void this.retrySave();
  }
  retrySave=async()=>{
    if(this.finishing||this.saving==='verified'||this.saving==='rejected'||this.localSimulation.mission.state!=='SUCCESS')return;
    clearTimeout(this.saveRetry);
    this.finishing=true;this.saving='saving';this.saveError='';this.notify();
    try{
      this.pendingCompletion??=await prepareCompletion(this.owner,this.permit,this.recorder.tape,this.localSimulation.mission.snapshot(),this.localSimulation.operation.assignment!);
      if(this.pendingCompletion.persisted===false){try{this.pendingCompletion.persisted=true;await pendingMissions.put(this.pendingCompletion);}catch{this.pendingCompletion.persisted=false;}}
      this.result=await sendCompletion(this.pendingCompletion);this.saving='verified';this.saveAttempts=0;
      this.latest=this.localSimulation.snapshot();
    }catch(error){
      const message=error instanceof Error?error.message:'';
      const rejected=isFinalCompletionError(message);
      this.saving=rejected?'rejected':'pending';
      this.saveError=rejected?'The server could not verify this run.':({request_timeout:'Your connection timed out. Please retry.',mission_verifier_busy:'Verification is busy. Your completed run can be retried shortly.',mission_verification_failed:'Verification was interrupted. Please retry your saved run.'} as Record<string,string>)[message]||message||'Saving will retry when you return to base.';
      if(!rejected&&this.pendingCompletion?.persisted===false)this.saveError+=' Device storage is unavailable. Keep this screen open until saving finishes.';
      if(!this.inactive&&!rejected)this.saveRetry=setTimeout(()=>void this.retrySave(),Math.min(5000,1000*2**Math.min(this.saveAttempts++,3)));
    }
    finally{this.finishing=false;this.notify();}
  };
  override dispose(){this.inactive=true;clearTimeout(this.saveRetry);if(typeof window!=='undefined')window.removeEventListener('online',this.online);this.localSimulation.onProjectileTravelled=undefined;super.dispose();}
}
