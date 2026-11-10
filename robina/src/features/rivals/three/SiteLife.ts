import * as T from 'three';
import {CityPeople,type HumanSource} from './CityPeople';
import type {Civilian} from './CityCrowd';
import {CivilianCombat} from './CivilianCombat';
import type {Assignment} from '../missions/assignments';
import type {NavigationGrid} from '../ai/navigation';
import type {QualityId} from '../core/presentation';

/** Cashiers remain behind the counters; customers queue and flee through real
 * side exits when the alarm sounds. One instanced skeleton atlas owns the cast. */
export class SiteLife {
  readonly root=new T.Group();readonly people:Civilian[]=[];readonly combat:CivilianCombat;private humans:CityPeople;
  constructor(a:Assignment,source:HumanSource,private navigation:NavigationGrid){
    this.humans=new CityPeople(source);this.root.add(this.humans.root);this.root.name=a.id==='reserve'?'Bank / cashiers and customers':'Site / personnel';
    const positions=a.id==='reserve'?[[-3,-2],[3,-2],[-2.8,1.2],[2.8,1.2],[-2.8,3],[2.8,3],[0,3.5]]:a.id==='reactor'?[[-1,2],[1,2]]:[];
    positions.forEach(([dx,dz],i)=>{const x=a.site.x+dx,z=a.site.z+dz,side=i%2?1:-1;this.people.push({x,z,route:[{x:a.site.x+side*5.3,z},{x:a.site.x+side*5.3,z:a.site.z},{x:a.site.x+side*9,z:a.site.z}],target:0,speed:1.8,yaw:i<2?0:Math.PI,panicUntil:0,idleUntil:0,distance:0,moving:false,motion:0,crossing:false,health:60});});
    this.combat=new CivilianCombat(this.people,'site-person');
  }
  update(dt:number,time:number,alarm:boolean,camera:T.Camera){
    this.combat.step(dt);
    this.people.forEach(p=>{p.moving=false;if((p.health??60)<=0)return;if(alarm)p.panicUntil=Math.max(p.panicUntil,time+8);if(p.panicUntil>time&&p.target<p.route.length){const goal=p.route[p.target],dx=goal.x-p.x,dz=goal.z-p.z,length=Math.hypot(dx,dz);if(length<.25){p.target++;return;}const next={x:p.x*40,y:p.z*40},distance=Math.min(length,p.speed*dt);this.navigation.move(next,dx/length*distance*40,dz/length*distance*40);const travel=Math.hypot(next.x*.025-p.x,next.y*.025-p.z);p.x=next.x*.025;p.z=next.y*.025;p.yaw=Math.atan2(dx,dz);p.distance+=travel;p.moving=travel>.001;}p.motion=T.MathUtils.damp(p.motion,p.moving?1:0,9,dt);});
    this.combat.sync(this.people.length);this.humans.draw(this.people,this.people.length,time,camera);
  }
  setQuality(quality:QualityId){this.humans.setQuality(quality);}
  dispose(){this.humans.dispose();this.root.clear();}
}
