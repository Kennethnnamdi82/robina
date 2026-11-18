import type { AuthorityInput, AuthoritySnapshot } from '../authority/MissionSimulation';

export type PredictedInput = Omit<AuthorityInput,'seq'>;
interface Step { tick:number; input:PredictedInput }

/** Bounded, movement-only rewind/replay. No shots, pickups, health changes or
 * mission events are executed again. New servers acknowledge exact consumed
 * movement ticks; older servers use the input label plus held-step count.
 * Pending inputs are replayed from that historical state, never from the
 * current rendered position. */
export class MovementPrediction {
  private tick = 0;
  private steps:Step[]=[];
  private readonly capacity=120;
  private streamEpoch?:number;
  corrections=0; replays=0;
  record(input:PredictedInput) {
    const tick=++this.tick;
    const saved={...input,aim:[...input.aim] as [number,number,number],tick};
    this.steps.push({tick,input:saved});
    if(this.steps.length>this.capacity)this.steps.shift();
    return saved;
  }
  clear(){this.steps.length=0;}
  reconcile(state:AuthoritySnapshot,restore:()=>void,replay:(input:PredictedInput)=>void,reset=false){
    const ack=state.prediction;
    if(!ack)return false; // Compatible with an older backend during rollout.
    const stream=ack.stream?.active?ack.stream:undefined;
    if(stream){
      if(this.streamEpoch!==undefined&&this.streamEpoch!==stream.epoch){reset=true;this.tick=stream.ack??0;}
      this.streamEpoch=stream.epoch;
    }
    const through=stream?stream.ack:ack.tick===null?null:ack.tick+Math.max(0,ack.steps-1);
    const expired=through!==null&&this.steps.length>0&&through<this.steps[0].tick-1;
    restore();
    if(reset||expired){this.clear();return true;}
    // Before the first processed packet the server is still at insertion;
    // replay the initial pending movement instead of cancelling the first tap.
    if(through===null){for(const step of this.steps){replay(step.input);this.replays++;}return true;}
    this.tick=Math.max(this.tick,through);
    for(const step of this.steps)if(step.tick>through){replay(step.input);this.replays++;}
    this.steps=this.steps.filter(step=>step.tick>through);
    this.corrections++;
    return true;
  }
  get size(){return this.steps.length;}
}
