import { NavigationGrid,clearSight,type Point } from '../ai/navigation';
import { driveVehicle } from './VehicleController';
import type { CityCar } from './CitySimulation';
import type { Solid3D } from './world3d';
import type { EnemySpawn } from '../ai/definitions';
import { STREET_CENTRES } from './LivingCityPlan';
interface Unit { car:CityCar; deployed:boolean; path:Point[]; repath:number }
export class PolicePursuit {
  active=false;lost=false;quiet=0;clock=0;private units:Unit[]=[];private nextDispatch=0;private contacted=false;
  constructor(private cars:CityCar[],private grid:NavigationGrid,private solids:Solid3D[],private response:number,private deploy:(spawn:EnemySpawn)=>void){}
  alert(){this.quiet=0;if(this.lost){this.lost=false;this.contacted=false;this.clock=0;for(const u of this.units)if(u.car.mode==='parked'&&(u.car.health??0)>0)u.car.mode='pursuit';}this.active=true;}
  step(dt:number,player:Point,officers:readonly (Point&{alive:boolean})[]){
    if(!this.active||this.lost)return;this.clock+=dt;
    if(this.units.length<this.response&&this.clock>=this.nextDispatch){const car=this.cars.filter(c=>c.kind==='police'&&(c.health??200)>0&&!this.units.some(u=>u.car===c)&&c.mode!=='player').sort((a,b)=>Math.hypot(a.x-player.x*.025,a.z-player.y*.025)-Math.hypot(b.x-player.x*.025,b.z-player.y*.025))[0];if(car){car.mode='pursuit';car.driver=true;this.units.push({car,deployed:false,path:[],repath:0});this.nextDispatch=this.clock+3;}}
    for(const unit of this.units){const car=unit.car;if(car.mode!=='pursuit'||(car.health??200)<=0)continue;
      const distance=Math.hypot(car.x-player.x*.025,car.z-player.y*.025);
      if(distance<18)this.contacted=true;
      if(!unit.deployed&&distance<15){car.speed=0;car.door=1;unit.deployed=true;for(let side=0;side<2;side++){let safe:Point|undefined;for(const offset of [2.1,2.8,-2.8]){const p={x:(car.x+car.dz*(side?1:-1)*2.1+car.dx*(offset===2.1?0:offset))*40,y:(car.z-car.dx*(side?1:-1)*2.1+car.dz*(offset===2.1?0:offset))*40};if(clearSight(p,p,this.grid.blockers,14)){safe=p;break;}}if(safe)this.deploy({id:'police-'+car.id+'-'+side,type:this.response>2?'enforcer':'guard',x:safe.x,y:safe.y,angle:Math.atan2(player.y-safe.y,player.x-safe.x),patrol:[safe,{...player}]});}}
      if(unit.deployed&&distance<18){car.speed=0;continue;}
      unit.repath-=dt;if(unit.repath<=0){
        // Cars stop on the nearest street; officers handle the bank interior.
        const px=player.x*.025,pz=player.y*.025,sx=STREET_CENTRES.reduce((a,b)=>Math.abs(b-px)<Math.abs(a-px)?b:a),sz=STREET_CENTRES.reduce((a,b)=>Math.abs(b-pz)<Math.abs(a-pz)?b:a);
        const goal=Math.abs(sx-px)<Math.abs(sz-pz)?{x:sx*40,y:player.y}:{x:player.x,y:sz*40};
        unit.path=this.grid.path({x:car.x*40,y:car.z*40},goal);unit.repath=.85;
      }
      while(unit.path.length&&Math.hypot(unit.path[0].x*.025-car.x,unit.path[0].y*.025-car.z)<2.4)unit.path.shift();
      const goal=unit.path[0];if(!goal){car.speed=0;continue;}
      const desired=Math.atan2(goal.x*.025-car.x,goal.y*.025-car.z),yaw=Math.atan2(car.dx,car.dz),turn=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));
      const reverse=Math.abs(turn)>2.2;
      driveVehicle(car,{throttle:reverse?-.55:Math.abs(turn)>1?.5:1,steer:Math.max(-1,Math.min(1,(reverse?-1:1)*turn*1.8)),brake:false},dt,this.solids);
    }
    const seen=officers.some(o=>o.alive&&Math.hypot(o.x-player.x,o.y-player.y)<900&&clearSight(o,player,this.grid.blockers));
    const near=this.units.some(u=>u.car.mode!=='player'&&(u.car.health??0)>0&&Math.hypot(u.car.x-player.x*.025,u.car.z-player.y*.025)<18);
    if(seen||near)this.contacted=true;
    this.quiet=this.contacted&&!seen&&!near?this.quiet+dt:0;
    if(this.units.length&&(this.quiet>=7||!this.contacted&&this.clock>=45)){this.lost=true;this.active=false;for(const u of this.units)if(u.car.mode==='pursuit'){u.car.mode='parked';u.car.speed=0;u.car.door=0;}}
  }
  get snapshot(){return{active:this.active,lost:this.lost,units:this.units.length,officers:this.units.filter(u=>u.deployed).length*2,evading:this.quiet};}
}
