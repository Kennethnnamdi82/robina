import * as T from 'three';
import { cityRandom, ROAD_HALF, STREET_CENTRES, trafficPhase, type CityPoint } from './LivingCityPlan';
import { CityPeople, type HumanSource } from './CityPeople';
export interface Civilian extends CityPoint { route:CityPoint[]; target:number; speed:number; yaw:number; crossing:boolean; panicUntil:number; idleUntil:number; distance:number;moving:boolean;motion:number }
/** Sidewalk navigation and crowd reactions are independent of the enemy AI. */
export class CityCrowd {
  readonly root=new T.Group();readonly people:Civilian[]=[];
  private humans:CityPeople;
  active=36;fled=0;
  constructor(seed:number,source:HumanSource) {
    this.root.name='Sidewalk civilians / authored skeletal locomotion';this.humans=new CityPeople(source);this.root.add(this.humans.root);
    const random=cityRandom(seed^0x8bcef);
    for(let i=0;i<48;i++) {
      const col=i%3,row=Math.floor(i/3)%3,x=8+col*24,z=8+row*24,long=i%7===0&&row<2;
      const route=[{x:x+5.9,z:z+5.9},{x:x+18.1,z:z+5.9},{x:x+18.1,z:z+(long?42.1:18.1)},{x:x+5.9,z:z+(long?42.1:18.1)}];
      const edge=i%4,p=route[edge],next=route[(edge+1)%4],t=random();
      this.people.push({x:T.MathUtils.lerp(p.x,next.x,t),z:T.MathUtils.lerp(p.z,next.z,t),route,target:(edge+1)%4,speed:.72+random()*.52,yaw:Math.atan2(next.x-p.x,next.z-p.z),crossing:false,panicUntil:0,idleUntil:i%9===0?2+random()*4:0,distance:0,moving:false,motion:0});
      const person=this.people[this.people.length-1];if(long)for(const centre of STREET_CENTRES)if(Math.abs(person.z-centre)<5.6)person.z=centre+(person.z<centre?-5.9:5.9);
    }
    this.draw(0);
  }
  threat(point:CityPoint,time:number) {
    for(const p of this.people)if(Math.hypot(point.x-p.x,point.z-p.z)<22){if(p.panicUntil<time)this.fled++;p.panicUntil=time+7;p.idleUntil=0;}
  }
  ejectDriver(car:CityPoint&{dx:number;dz:number}){const p=this.people[this.active-1];if(!p)return;p.x=car.x-car.dz*1.8;p.z=car.z+car.dx*1.8;p.route=[{x:p.x-car.dz*6,z:p.z+car.dx*6},{x:p.x-car.dz*8,z:p.z+car.dx*8}];p.target=0;p.idleUntil=0;p.panicUntil=this.people.reduce((n,p)=>Math.max(n,p.panicUntil),0)+8;p.speed=1.4;p.moving=true;}
  step(dt:number,time:number,cars:readonly (CityPoint&{length:number})[],player:CityPoint,obstacles:readonly {enabled:boolean;box:T.Box3}[]=[]) {
    const phase=trafficPhase(time);
    for(let i=0;i<this.active;i++) {
      const p=this.people[i];p.motion=T.MathUtils.damp(p.motion,p.moving?1:0,10,dt);p.moving=false;
      const target=p.route[p.target],x=target.x-p.x,z=target.z-p.z,d=Math.hypot(x,z);if(d<.12){p.target=(p.target+1)%p.route.length;if((i+Math.floor(time))%23===0&&p.panicUntil<time)p.idleUntil=time+1.8;continue;}
      if(p.idleUntil>time)continue;
      const pace=p.speed*(p.panicUntil>time?2.6:1),travel=Math.min(d,pace*dt),dx=x/d,dz=z/d;
      let nx=p.x+dx*travel,nz=p.z+dz*travel;
      const blocked=(x:number,z:number)=>obstacles.some(s=>s.enabled&&x>s.box.min.x-.22&&x<s.box.max.x+.22&&z>s.box.min.z-.22&&z<s.box.max.z+.22);
      if(blocked(nx,nz)){
        let clear=false;for(const sign of [i%2?1:-1,i%2?-1:1]){const x=p.x+dz*travel*sign,z=p.z-dx*travel*sign;if(!blocked(x,z)){nx=x;nz=z;clear=true;break;}}if(!clear)continue;
      }
      const road=STREET_CENTRES.some(c=>Math.abs((Math.abs(dx)>.5?nx:nz)-c)<ROAD_HALF+.65);
      if(road&&!p.crossing) {
        if(!phase.crossing||cars.some(c=>Math.hypot(c.x-p.x,c.z-p.z)<c.length/2+3))continue;
        p.crossing=true;
      }
      if(!road)p.crossing=false;
      if(Math.hypot(nx-player.x,nz-player.z)<.85)continue;
      const desired=Math.atan2(nx-p.x,nz-p.z);p.yaw+=Math.atan2(Math.sin(desired-p.yaw),Math.cos(desired-p.yaw))*Math.min(1,dt*10);
      p.x=nx;p.z=nz;p.distance+=travel;p.moving=true;
    }
  }
  draw(time:number,camera?:T.Camera) {this.humans.draw(this.people,this.active,time,camera);}
  setQuality(quality:import('../core/presentation').QualityId){this.humans.setQuality(quality);}
  get stats(){return{active:this.active,rendered:this.humans.rendered,animation:'authored-skeletal-walk-run',fled:this.fled,walking:this.people.slice(0,this.active).reduce((n,p)=>n+p.distance,0),crossing:this.people.slice(0,this.active).filter(p=>p.crossing).length};}
  dispose(){this.humans.dispose();this.root.clear();}
}
