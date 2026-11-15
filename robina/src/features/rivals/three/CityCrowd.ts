import * as T from 'three';
import {CityPeople,type HumanSource} from './CityPeople';
import {PedestrianSimulation} from './PedestrianSimulation';
export type {Civilian} from './PedestrianSimulation';
/** Rendering wraps the unchanged headless sidewalk/health simulation. */
export class CityCrowd extends PedestrianSimulation {
  readonly root=new T.Group();private humans:CityPeople;serverControlled=false;
  private remote:{x:number;z:number;distance:number}[]=[];
  constructor(seed:number,source:HumanSource){super(seed);this.root.name='Sidewalk civilians / authored skeletal locomotion';this.humans=new CityPeople(source);this.root.add(this.humans.root);this.draw(0);}
  applyAuthority(rows:readonly{x:number;z:number;yaw:number;motion:number;moving:boolean;distance:number;panicUntil:number;health:number;hitRemaining:number;deathAge:number}[]){this.serverControlled=true;this.active=rows.length;this.remote=rows.map(row=>({x:row.x,z:row.z,distance:row.distance}));rows.forEach(({x,z,distance,...pose},i)=>{const p=this.people[i];if(!p)return;if(Math.hypot(p.x-x,p.z-z)>2){p.x=x;p.z=z;p.distance=distance;}Object.assign(p,pose);});}
  override step(...args:Parameters<PedestrianSimulation['step']>){if(!this.serverControlled)super.step(...args);else{this.active=this.remote.length;const dt=args[0],blend=1-Math.exp(-dt*18);this.remote.forEach((p,i)=>{const person=this.people[i];person.x+=(p.x-person.x)*blend;person.z+=(p.z-person.z)*blend;person.distance+=(p.distance-person.distance)*blend;person.hitRemaining=Math.max(0,(person.hitRemaining??0)-dt);if((person.health??60)<=0)person.deathAge=(person.deathAge??0)+dt;});}}
  draw(time:number,camera?:T.Camera){this.combat.sync(this.active);this.humans.draw(this.people,this.active,time,camera);}
  setQuality(quality:import('../core/presentation').QualityId){this.humans.setQuality(quality);}
  get stats(){return{active:this.active,rendered:this.humans.rendered,animation:'authored-skeletal-walk-run',...this.combat.snapshot,fled:this.fled,walking:this.people.slice(0,this.active).reduce((n,p)=>n+p.distance,0),crossing:this.people.slice(0,this.active).filter(p=>p.crossing).length};}
  dispose(){this.humans.dispose();this.root.clear();}
}
