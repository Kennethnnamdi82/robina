import { EnemyController,type Perception } from '../ai/EnemyController';
import { clearSight,NavigationGrid,type Point } from '../ai/navigation';
import type { EnemySpawn } from '../ai/definitions';
import type { DamageEvent } from '../combat/Health';

/** 3D-only tactical layer. Cover is actual occluding geometry, not immunity. */
export class TacticalEnemy extends EnemyController {
  tactic:'patrol'|'pursuit'|'evade'|'seek-cover'|'cover'='patrol';
  evasions=0; covers=0; sprinting=false;
  private clock=0; private evadeUntil=0; private nextEvade=0; private coverUntil=0; private reconsider=0;
  private strafe:Point={x:0,y:0}; private coverGoal:Point|null=null; private pending:Point|null=null; private reactAt=Infinity;
  private coverPath:Point[]=[];
  constructor(spawn:EnemySpawn,private grid:NavigationGrid,stagger=0){super(spawn,grid,stagger);}
  threat(origin:Point,direction:Point) {
    if(!this.alive||this.clock<this.nextEvade||!clearSight(this,origin,this.grid.blockers))return;
    const dx=this.x-origin.x,dy=this.y-origin.y,along=dx*direction.x+dy*direction.y;
    if(along<0||along>680||Math.abs(dx*direction.y-dy*direction.x)>48)return;
    if(!this.pending){this.pending={...origin};this.reactAt=this.clock+.16+(this.spawn.type==='heavy'?.18:0);}
  }
  override damage(event:DamageEvent){const taken=super.damage(event);if(taken&&this.alive){this.pending={x:this.x-Math.cos(event.angle)*180,y:this.y-Math.sin(event.angle)*180};this.reactAt=this.clock+.2;}return taken;}
  private evade(from:Point){
    const angle=Math.atan2(this.y-from.y,this.x-from.x),side=this.evasions%2?1:-1;
    this.strafe={x:Math.cos(angle+side*Math.PI/2),y:Math.sin(angle+side*Math.PI/2)};
    if(!clearSight(this,{x:this.x+this.strafe.x*64,y:this.y+this.strafe.y*64},this.grid.blockers,this.grid.radius)){this.strafe.x*=-1;this.strafe.y*=-1;}
    this.evadeUntil=this.clock+.32;this.nextEvade=this.clock+3.2;this.evasions++;this.coverGoal=null;this.coverPath=[];
  }
  private findCover(player:Point){
    let best:Point|null=null,score=Infinity;
    for(const b of this.grid.blockers){if(!b.enabled||Math.hypot(b.x-this.x,b.y-this.y)>260)continue;
      const dx=b.x-player.x,dy=b.y-player.y,length=Math.hypot(dx,dy)||1;
      for(const side of [-1,0,1]){
        const p={x:b.x+dx/length*(b.width/2+this.grid.radius+14)-dy/length*side*48,y:b.y+dy/length*(b.height/2+this.grid.radius+14)+dx/length*side*48};
        const distance=Math.hypot(p.x-this.x,p.y-this.y);if(distance<16||distance>230||p.x<64||p.y<64||p.x>(this.grid.width-1)*64||p.y>(this.grid.height-1)*64)continue;
        if(clearSight(player,p,this.grid.blockers)||!clearSight(p,p,this.grid.blockers,this.grid.radius))continue;
        const path=this.grid.path(this,p);if(!path.length)continue;
        if(distance<score){best=p;score=distance;this.coverPath=path;}
      }
    }return best;
  }
  override step(dt:number,context:Perception,shoot:(enemy:EnemyController,angle:number)=>void){
    this.clock+=dt;const start={x:this.x,y:this.y};this.sprinting=false;
    if(!this.alive){super.step(dt,context,shoot);return;}
    if(this.pending&&this.clock>=this.reactAt&&this.clock>=this.nextEvade){this.evade(this.pending);this.pending=null;}
    const evading=this.clock<this.evadeUntil,covering=!!this.coverGoal||this.clock<this.coverUntil;
    super.step(dt,{...context,permitted:context.permitted&&!evading&&!covering},shoot);
    if(!this.alive||this.hurt>0){this.vx=this.vy=0;return;}
    if(evading){this.x=start.x;this.y=start.y;this.grid.move(this,this.strafe.x*340*dt,this.strafe.y*340*dt);this.tactic='evade';}
    else{
      if(this.evasions&&this.clock>this.reconsider&&!this.coverGoal&&this.clock>=this.coverUntil){this.reconsider=this.clock+5;this.coverGoal=this.findCover(context.player);}
      if(this.coverGoal){this.x=start.x;this.y=start.y;while(this.coverPath.length&&Math.hypot(this.coverPath[0].x-this.x,this.coverPath[0].y-this.y)<10)this.coverPath.shift();const goal=this.coverPath[0]??this.coverGoal,dx=goal.x-this.x,dy=goal.y-this.y,d=Math.hypot(dx,dy);if(Math.hypot(this.coverGoal.x-this.x,this.coverGoal.y-this.y)<12){this.coverUntil=this.clock+1.3;this.coverGoal=null;this.covers++;this.tactic='cover';}else if(d>0){this.grid.move(this,dx/d*Math.min(d,155*dt),dy/d*Math.min(d,155*dt));this.tactic='seek-cover';this.sprinting=true;this.angle=Math.atan2(dy,dx);}}
      else if(this.clock<this.coverUntil){this.x=start.x;this.y=start.y;this.tactic='cover';this.angle=Math.atan2(context.player.y-this.y,context.player.x-this.x);}
      else if(['CHASE','INVESTIGATE','RETURN_TO_PATROL'].includes(this.state)&&Math.hypot(this.x-start.x,this.y-start.y)>.01){const dx=this.x-start.x,dy=this.y-start.y;this.grid.move(this,dx*.65,dy*.65);this.sprinting=true;this.tactic='pursuit';}
      else this.tactic='patrol';
    }
    this.vx=(this.x-start.x)/dt;this.vy=(this.y-start.y)/dt;
  }
}
