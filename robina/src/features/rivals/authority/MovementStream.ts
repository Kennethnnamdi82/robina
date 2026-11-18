/** Fixed-step locomotion transport. Combat commands deliberately stay outside
 * this queue. A packet never grants simulation time: only step() consumes time. */
export type MovementFrame = [tick:number,x:number,y:number,aimX:number,aimY:number,flags:number,
  throttle:number,steer:number,stickX:number,stickY:number,cameraYaw:number];
export interface MovementBatch { epoch:number; frames:MovementFrame[] }
export interface MovementCommand {
  x:number;y:number;aimX:number;aimY:number;aiming:boolean;sprint:boolean;dodge:boolean;
  jump:boolean;jumpHeld:boolean;highJump:boolean;throttle:number;steer:number;brake:boolean;
  stickX:number;stickY:number;cameraYaw:number;
}
export function packMovement(tick:number,c:MovementCommand):MovementFrame {
  return [tick,c.x,c.y,c.aimX,c.aimY,Number(c.aiming)|Number(c.sprint)<<1|Number(c.dodge)<<2|
    Number(c.jump)<<3|Number(c.jumpHeld)<<4|Number(c.highJump)<<5|Number(c.brake)<<6,
    c.throttle,c.steer,c.stickX,c.stickY,c.cameraYaw];
}
function unpackMovement(f:MovementFrame):MovementCommand {
  const [,x,y,aimX,aimY,bits,throttle,steer,stickX,stickY,cameraYaw]=f;
  return {x,y,aimX,aimY,aiming:!!(bits&1),sprint:!!(bits&2),dodge:!!(bits&4),jump:!!(bits&8),
    jumpHeld:!!(bits&16),highJump:!!(bits&32),brake:!!(bits&64),throttle,steer,stickX,stickY,cameraYaw};
}
const neutral=():MovementCommand=>({x:0,y:0,aimX:0,aimY:1,aiming:false,sprint:false,dodge:false,
  jump:false,jumpHeld:false,highJump:false,throttle:0,steer:0,brake:true,stickX:0,stickY:0,cameraYaw:0});
export class MovementStream {
  enabled=false;
  private epoch=0;
  private ack:number|null=null;
  private next:number|null=null;
  private waiting=0;
  private cushion=6;
  private queue=new Map<number,MovementFrame>();
  private held=neutral();
  get snapshot(){return {version:1 as const,epoch:this.epoch,ack:this.ack,active:this.enabled};}
  accept(batch:MovementBatch){
    if(batch.epoch!==this.epoch||!batch.frames.length)return;
    this.enabled=true;
    if(this.ack===null)this.cushion=Math.min(18,Math.max(this.cushion,batch.frames.length+3));
    for(const frame of batch.frames){
      const tick=frame[0];
      if(this.next===null)this.next=tick;
      // Duplicates/late inputs cannot replay actions; future labels cannot
      // allocate unbounded memory or accelerate the authoritative clock.
      if(tick<this.next||tick>=this.next+120||this.queue.has(tick))continue;
      this.queue.set(tick,frame);
    }
  }
  step():MovementCommand {
    if(this.next===null)return neutral();
    // Small initial cushion absorbs the 20Hz transport and uneven rendering.
    // Prediction remains immediate on the client, including the first press.
    if(this.ack===null&&this.queue.size<this.cushion&&this.waiting++<this.cushion)return neutral();
    const frame=this.queue.get(this.next);
    if(frame){this.held=unpackMovement(frame);this.queue.delete(this.next);}
    else this.held={...this.held,dodge:false,jump:false,highJump:false};
    this.ack=this.next++;
    return this.held;
  }
  reset(){
    if(this.next!==null)this.epoch++;
    this.ack=this.next=null;this.waiting=0;this.cushion=6;this.queue.clear();this.held=neutral();
  }
}
