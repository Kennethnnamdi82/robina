import { Box3,Vector3 } from 'three';
import { Health,type DamageEvent } from '../combat/Health';
import type { Civilian } from './CityCrowd';
import type { Target3D } from './Projectile3D';

/** Civilian hits use the same swept projectile/damage pipeline as guards.
 * No blood or reward drops: a hit flinches, a lethal hit plays the authored fall. */
export class CivilianCombat {
  readonly targets:Target3D[];private health:Health[];private clock=0;active=0;hits=0;deaths=0;
  onCrime?:()=>void;
  constructor(readonly people:Civilian[]){
    this.health=people.map(()=>new Health(60,.04));
    this.targets=people.map((p,i)=>({id:'civilian-'+i,team:'civilian',box:new Box3(),alive:()=>i<this.active&&this.health[i].current>0,damage:event=>this.damage(i,event)}));
    this.sync(people.length);
  }
  private damage(index:number,event:DamageEvent){
    const h=this.health[index],p=this.people[index],taken=h.damage(event);if(!taken)return 0;
    this.hits++;p.health=h.current;p.hitRemaining=.24;p.panicUntil=Math.max(p.panicUntil,this.clock+8);p.idleUntil=0;
    if(h.current<=0){this.deaths++;p.deathAge=0;p.moving=false;p.motion=0;}
    if(event.team==='operative')this.onCrime?.();return taken;
  }
  step(dt:number){this.clock+=dt;for(const [i,p] of this.people.entries()){this.health[i].step(dt);p.hitRemaining=Math.max(0,(p.hitRemaining??0)-dt);if((p.health??60)<=0)p.deathAge=(p.deathAge??0)+dt;}}
  sync(active:number){this.active=active;for(const [i,p] of this.people.entries())this.targets[i].box.set(new Vector3(p.x-.27,.025,p.z-.27),new Vector3(p.x+.27,1.72,p.z+.27));}
  get snapshot(){return{hits:this.hits,deaths:this.deaths,alive:this.people.slice(0,this.active).filter(p=>(p.health??60)>0).length};}
}
