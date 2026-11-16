import type { AuthorityInput, AuthoritySnapshot } from '../authority/MissionSimulation';

export type PredictedInput = Omit<AuthorityInput,'seq'>;
interface Step { tick:number; input:PredictedInput }

/** Bounded, movement-only rewind/replay. No shots, pickups, health changes or
 * mission events are executed again. Server labels acknowledge the input step
 * plus the number of fixed ticks for which it was held. Comparing against that
 * point (rather than today's position) removes latency-induced rubber-banding.
 * Keeping a short window also handles changing input transit times. */
export class MovementPrediction {
  private tick = 0;
  private steps:Step[]=[];
  private readonly capacity=120;
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
    const through=ack.tick===null?null:ack.tick+Math.max(0,ack.steps-1);
    const expired=through!==null&&this.steps.length>0&&through<this.steps[0].tick-1;
    restore();
    if(reset||expired){this.clear();return true;}
    // Before the first processed packet the server is still at insertion;
    // replay the initial pending movement instead of cancelling the first tap.
    if(through===null){for(const step of this.steps){replay(step.input);this.replays++;}return true;}
    this.tick=Math.max(this.tick,through);
    for(const step of this.steps)if(step.tick>through){replay(step.input);this.replays++;}
    this.corrections++;
    return true;
  }
  get size(){return this.steps.length;}
}
