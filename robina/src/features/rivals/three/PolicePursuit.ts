import { NavigationGrid,clearSight,type Point } from '../ai/navigation';
import { driveVehicle } from './VehicleController';
import type { CityCar } from './CitySimulation';
import type { Solid3D } from './world3d';
import type { EnemySpawn } from '../ai/definitions';
import { STREET_CENTRES } from './LivingCityPlan';
interface Unit { car:CityCar; deployed:boolean; path:Point[]; repath:number;stuck:number;reverse:number;detour:number;fireAt:number;burst:number }
export class PolicePursuit {
  active=false;lost=false;quiet=0;clock=0;private units:Unit[]=[];private nextDispatch=0;private contacted=false;
  private hunting=false;private previous?:Point;private velocity={x:0,y:0};
  shots=0;
  get pursuingValuables(){return this.active&&this.hunting&&!this.lost;}
  constructor(private cars:CityCar[],private grid:NavigationGrid,private solids:Solid3D[],private response:number,private deploy:(spawn:EnemySpawn)=>void,private shoot?:(window:Point,car:CityCar)=>void,private impact?:(car:CityCar,solid:Solid3D,speed:number)=>void){}
  end(){this.active=false;for(const u of this.units)if(u.car.mode==='pursuit'){u.car.mode='parked';u.car.speed=0;}}
  alert(valuable=false){this.quiet=0;if(valuable){this.hunting=true;this.clock=0;this.contacted=false;for(const u of this.units)u.repath=0;}if(this.lost){this.lost=false;this.contacted=false;this.clock=0;for(const u of this.units)if(u.car.mode==='parked'&&(u.car.health??0)>0)u.car.mode='pursuit';}this.active=true;}
  step(dt:number,player:Point,officers:readonly (Point&{alive:boolean})[]){
    if(!Number.isFinite(dt)||dt<=0||!this.active||this.lost)return;this.clock+=dt;
    if(this.previous){this.velocity.x=Math.max(-400,Math.min(400,(player.x-this.previous.x)/dt));this.velocity.y=Math.max(-400,Math.min(400,(player.y-this.previous.y)/dt));}this.previous={...player};
    this.units=this.units.filter(u=>(u.car.health??200)>0&&u.car.mode!=='player');
    const response=this.hunting?Math.min(4,Math.max(2,this.response+1)):this.response;
    if(this.units.length<response&&this.clock>=this.nextDispatch){const car=this.cars.filter(c=>c.kind==='police'&&(c.health??200)>0&&!this.units.some(u=>u.car===c)&&c.mode!=='player').sort((a,b)=>Math.hypot(a.x-player.x*.025,a.z-player.y*.025)-Math.hypot(b.x-player.x*.025,b.z-player.y*.025))[0];if(car){car.mode='pursuit';car.driver=true;this.units.push({car,deployed:false,path:[],repath:0,stuck:0,reverse:0,detour:0,fireAt:this.clock+.45,burst:0});this.nextDispatch=this.clock+(this.hunting?1.25:2);}}
    for(const unit of this.units){const car=unit.car;if(car.mode==='parked'&&this.hunting)car.mode='pursuit';if(car.mode!=='pursuit'||(car.health??200)<=0)continue;
      const distance=Math.hypot(car.x-player.x*.025,car.z-player.y*.025);
      if(this.shoot&&distance>3&&distance<44&&this.clock>=unit.fireAt){
        const side=((player.x*.025-car.x)*car.dz-(player.y*.025-car.z)*car.dx)>=0?1:-1;
        const window={x:(car.x+car.dz*side*1.05+car.dx*.35)*40,y:(car.z-car.dx*side*1.05+car.dz*.35)*40};
        if(clearSight(window,player,this.grid.blockers)){this.shoot(window,car);this.shots++;unit.burst++;unit.fireAt=this.clock+(unit.burst<3?.14:1.3);if(unit.burst===3)unit.burst=0;}else{unit.fireAt=this.clock+.12;unit.burst=0;}
      }
      if(distance<18)this.contacted=true;
      if(!unit.deployed&&distance<15){car.speed=0;car.door=1;unit.deployed=true;for(let side=0;side<2;side++){let safe:Point|undefined;for(const offset of [2.1,2.8,-2.8]){const p={x:(car.x+car.dz*(side?1:-1)*2.1+car.dx*(offset===2.1?0:offset))*40,y:(car.z-car.dx*(side?1:-1)*2.1+car.dz*(offset===2.1?0:offset))*40};if(clearSight(p,p,this.grid.blockers,14)){safe=p;break;}}if(safe)this.deploy({id:'police-'+car.id+'-'+side,type:this.response>2?'enforcer':'guard',x:safe.x,y:safe.y,angle:Math.atan2(player.y-safe.y,player.x-safe.x),patrol:[safe,{...player}]});}}
      // The lead unit stays mobile once the cargo is stolen. Support units
      // dismount for the interior; neither role requires teleporting cars.
      if(unit.deployed&&distance<(this.hunting?5.5:18)){car.speed=0;continue;}
      unit.repath-=dt;unit.detour=Math.max(0,unit.detour-dt);if(unit.repath<=0){
        // Cars stop on the nearest street; officers handle the bank interior.
        const lead=this.hunting?.55:0,px=Math.max(3,Math.min(93,(player.x+this.velocity.x*lead)*.025)),pz=Math.max(3,Math.min(93,(player.y+this.velocity.y*lead)*.025)),sx=STREET_CENTRES.reduce((a,b)=>Math.abs(b-px)<Math.abs(a-px)?b:a),sz=STREET_CENTRES.reduce((a,b)=>Math.abs(b-pz)<Math.abs(a-pz)?b:a);
        const goal=Math.abs(sx-px)<Math.abs(sz-pz)?{x:sx*40,y:pz*40}:{x:px*40,y:sz*40};
        // A blocked car must not repeatedly replan through the same traffic
        // queue. Rebuild a local vehicle-aware detour only after a real stall.
        const traffic=unit.detour>0?this.solids.filter(s=>s.enabled&&s.id.startsWith('city-traffic-')&&s.id!=='city-traffic-'+car.id&&Math.hypot((s.box.min.x+s.box.max.x)/2-car.x,(s.box.min.z+s.box.max.z)/2-car.z)<18).slice(0,12).map(s=>({id:s.id,enabled:true,x:(s.box.min.x+s.box.max.x)*20,y:(s.box.min.z+s.box.max.z)*20,width:(s.box.max.x-s.box.min.x)*40,height:(s.box.max.z-s.box.min.z)*40})):[];
        const navigation=traffic.length?new NavigationGrid(this.grid.width,this.grid.height,this.grid.tile,[...this.grid.blockers,...traffic],92):this.grid;
        unit.path=navigation.path({x:car.x*40,y:car.z*40},goal);unit.repath=.85;
      }
      while(unit.path.length&&Math.hypot(unit.path[0].x*.025-car.x,unit.path[0].y*.025-car.z)<2.4)unit.path.shift();
      const goal=unit.path[0];if(!goal){car.speed=0;continue;}
      const desired=Math.atan2(goal.x*.025-car.x,goal.y*.025-car.z),yaw=Math.atan2(car.dx,car.dz),turn=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));
      unit.reverse=Math.max(0,unit.reverse-dt);const reverse=unit.reverse>0||Math.abs(turn)>2.2,startX=car.x,startZ=car.z;
      driveVehicle(car,{throttle:reverse?-.65:Math.abs(turn)>1?.6:1,steer:Math.max(-1,Math.min(1,(reverse?-1:1)*turn*1.8)),heading:reverse?undefined:desired,brake:false},dt,this.solids,this.impact);
      unit.stuck=Math.hypot(car.x-startX,car.z-startZ)<.002?unit.stuck+dt:0;
      if(unit.stuck>.8){unit.reverse=.7;unit.detour=8;unit.repath=0;unit.stuck=0;}
    }
    const seen=officers.some(o=>o.alive&&Math.hypot(o.x-player.x,o.y-player.y)<1200&&clearSight(o,player,this.grid.blockers));
    const near=this.units.some(u=>u.car.mode!=='player'&&(u.car.health??0)>0&&Math.hypot(u.car.x-player.x*.025,u.car.z-player.y*.025)<18);
    if(seen||near)this.contacted=true;
    this.quiet=this.contacted&&!seen&&!near?this.quiet+dt:0;
    if(!this.hunting&&(this.units.length||this.clock>15)&&(this.quiet>=7||!this.contacted&&this.clock>=45)){this.lost=true;this.active=false;for(const u of this.units)if(u.car.mode==='pursuit'){u.car.mode='parked';u.car.speed=0;u.car.door=0;}}
  }
  get snapshot(){return{active:this.active,lost:this.lost,hunting:this.hunting,shots:this.shots,units:this.units.length,officers:this.units.filter(u=>u.deployed).length*2,evading:this.hunting?0:this.quiet,cars:this.units.map(u=>({id:u.car.id,x:u.car.x,z:u.car.z,speed:u.car.speed,deployed:u.deployed}))};}
}
