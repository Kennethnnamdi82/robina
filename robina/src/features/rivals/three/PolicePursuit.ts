import { NavigationGrid,clearSight,type Point } from '../ai/navigation';
import { driveVehicle } from './VehicleController';
import type { CityCar } from './CitySimulation';
import type { Solid3D } from './world3d';
import type { EnemySpawn } from '../ai/definitions';
interface Unit { car:CityCar; deployed:boolean; path:Point[]; repath:number }
export class PolicePursuit {
  active=false;lost=false;quiet=0;clock=0;private units:Unit[]=[];private nextDispatch=0;
  constructor(private cars:CityCar[],private grid:NavigationGrid,private solids:Solid3D[],private response:number,private deploy:(spawn:EnemySpawn)=>void){}
  alert(){if(this.lost){this.lost=false;this.quiet=0;for(const u of this.units)if(u.car.mode==='parked'&&(u.car.health??0)>0)u.car.mode='pursuit';}this.active=true;}
  step(dt:number,player:Point,officers:readonly (Point&{alive:boolean})[]){
    if(!this.active||this.lost)return;this.clock+=dt;
    if(this.units.length<this.response&&this.clock>=this.nextDispatch){const car=this.cars.find(c=>c.kind==='police'&&(c.health??200)>0&&!this.units.some(u=>u.car===c)&&c.mode!=='player');if(car){car.mode='pursuit';car.driver=true;this.units.push({car,deployed:false,path:[],repath:0});this.nextDispatch=this.clock+12;}}
    for(const unit of this.units){const car=unit.car;if(car.mode!=='pursuit'||(car.health??200)<=0)continue;
      const distance=Math.hypot(car.x-player.x*.025,car.z-player.y*.025);
      if(!unit.deployed&&distance<10){car.speed=0;car.door=1;unit.deployed=true;for(let side=0;side<2;side++){const p={x:(car.x+car.dz*(side?1:-1)*1.7)*40,y:(car.z-car.dx*(side?1:-1)*1.7)*40};const path=this.grid.path(p,p),safe=path[0]??p;this.deploy({id:'police-'+car.id+'-'+side,type:this.response>2?'enforcer':'guard',x:safe.x,y:safe.y,angle:Math.atan2(player.y-safe.y,player.x-safe.x),patrol:[safe,player]});}}
      if(distance<7){car.speed=0;continue;}
      unit.repath-=dt;if(unit.repath<=0){unit.path=this.grid.path({x:car.x*40,y:car.z*40},player);unit.repath=.85;}
      while(unit.path.length&&Math.hypot(unit.path[0].x*.025-car.x,unit.path[0].y*.025-car.z)<2)unit.path.shift();
      const goal=unit.path[0];if(!goal){car.speed=0;continue;}
      const desired=Math.atan2(goal.x*.025-car.x,goal.y*.025-car.z),yaw=Math.atan2(car.dx,car.dz),turn=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));
      driveVehicle(car,{throttle:Math.abs(turn)>1.2?.25:.8,steer:Math.max(-1,Math.min(1,turn*2)),brake:distance<10||Math.abs(turn)>1.7},dt,this.solids);
    }
    const seen=officers.some(o=>o.alive&&Math.hypot(o.x-player.x,o.y-player.y)<900&&clearSight(o,player,this.grid.blockers));
    const near=this.units.some(u=>u.car.mode!=='player'&&(u.car.health??0)>0&&Math.hypot(u.car.x-player.x*.025,u.car.z-player.y*.025)<18);
    this.quiet=!seen&&!near?this.quiet+dt:0;
    if(this.units.length&&this.quiet>=7){this.lost=true;this.active=false;for(const u of this.units)if(u.car.mode==='pursuit'){u.car.mode='parked';u.car.speed=0;u.car.door=0;}}
  }
  get snapshot(){return{active:this.active,lost:this.lost,units:this.units.length,officers:this.units.filter(u=>u.deployed).length*2,evading:this.quiet};}
}
