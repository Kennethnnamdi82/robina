import { Box3,Vector3 } from 'three';
import type { CityCar } from './CitySimulation';
import { carActive, VEHICLE_LENGTH,sampleRoute } from './CitySimulation';
import type { Solid3D } from './world3d';
import { horizontalContact,traceSolids } from './physics3d';
export interface DrivingInput { throttle:number; steer:number; brake:boolean }
const width=(car:CityCar)=>['lorry','tanker','bus'].includes(car.kind)?2.35:1.85;
/** Exact horizontal SAT, not a point-sized car collision check. */
export function vehicleOverlap(car:CityCar,x:number,z:number,yaw:number,s:Solid3D){
  if(!s.enabled||s.box.max.y<.12||s.box.min.y>2.8)return false;
  const c=Math.cos(yaw),n=Math.sin(yaw),o=s.oriented,angle=o?.yaw??0,oc=Math.cos(angle),on=Math.sin(angle);
  const ax={x:c,z:-n},az={x:n,z:c},bx={x:oc,z:-on},bz={x:on,z:oc};
  const cx=o?.center.x??(s.box.min.x+s.box.max.x)/2,cz=o?.center.z??(s.box.min.z+s.box.max.z)/2;
  const hx=o?.half.x??(s.box.max.x-s.box.min.x)/2,hz=o?.half.z??(s.box.max.z-s.box.min.z)/2;
  if(Math.abs(x-cx)>Math.abs(oc)*hx+Math.abs(on)*hz+car.length/2+width(car)/2||Math.abs(z-cz)>Math.abs(on)*hx+Math.abs(oc)*hz+car.length/2+width(car)/2)return false;
  for(const axis of [ax,az,bx,bz]){const dot=(a:typeof axis,b:typeof axis)=>Math.abs(a.x*b.x+a.z*b.z);if(Math.abs((x-cx)*axis.x+(z-cz)*axis.z)>=width(car)/2*dot(ax,axis)+car.length/2*dot(az,axis)+hx*dot(bx,axis)+hz*dot(bz,axis)-.015)return false;}return true;
}
export function driveVehicle(car:CityCar,input:DrivingInput,dt:number,solids:readonly Solid3D[]){
  if(!Number.isFinite(dt)||dt<=0||dt>.2)return;
  if((car.health??200)<=0){car.speed=0;car.mode='disabled';return;}
  const heavy=['lorry','tanker','bus'].includes(car.kind),maximum=heavy?13:20;
  const throttle=Math.max(-1,Math.min(1,input.throttle||0));
  car.speed=Math.max(-5,Math.min(maximum,car.speed+throttle*(heavy?5:8)*dt));
  const deceleration=(input.brake?18:Math.abs(throttle)<.05?2.8:.25)*dt;
  car.speed=Math.sign(car.speed)*Math.max(0,Math.abs(car.speed)-deceleration);
  const steps=Math.max(1,Math.ceil(Math.abs(car.speed)*dt/.15));
  for(let i=0;i<steps;i++){
    const oldYaw=Math.atan2(car.dx,car.dz),yaw=oldYaw+Math.max(-1,Math.min(1,input.steer||0))*Math.sign(car.speed)*Math.min(1.4,Math.abs(car.speed)*.22)*dt/steps;
    const x=car.x+Math.sin(yaw)*car.speed*dt/steps,z=car.z+Math.cos(yaw)*car.speed*dt/steps;
    if(solids.some(s=>s.id!=='city-traffic-'+car.id&&vehicleOverlap(car,x,z,yaw,s))){if(Math.abs(car.speed)>3)car.health=Math.max(0,(car.health??200)-Math.abs(car.speed)*2);car.speed=0;break;}
    car.x=x;car.z=z;car.dx=Math.sin(yaw);car.dz=Math.cos(yaw);car.travelled+=Math.abs(car.speed)*dt/steps;
  }
  car.stopped=Math.abs(car.speed)<.2;
}
export function addParkedVehicles(cars:CityCar[]){
  const template=cars[0];if(!template)return;
  const parking=[{x:18,z:3.5},{x:44,z:27.3},{x:68,z:51.3},{x:68,z:75.3}];
  for(const [index,kind]of (['sedan','van','lorry','coupe'] as const).entries())cars.push({...template,id:cars.length,kind,...parking[index],dx:1,dz:0,length:VEHICLE_LENGTH[kind],speed:0,travelled:0,health:200,mode:'parked',driver:false,door:0});
  // Traffic was distributed before parking existed. Resolve conflicts before
  // any scene is shown, never by teleporting an already visible vehicle.
  for(const car of cars){if(car.mode!=='traffic')continue;for(let attempt=0;attempt<80&&cars.some(other=>other!==car&&Math.hypot(other.x-car.x,other.z-car.z)<(other.length+car.length)/2+1);attempt++){car.distance=(car.distance+8)%car.total;Object.assign(car,sampleRoute(car,car.distance));}}
}
export class VehicleController {
  current:CityCar|null=null;nearby:CityCar|null=null;message='';private doors=new Map<number,number>();
  constructor(readonly cars:CityCar[]){}
  scan(p:Vector3,active:number){let distance=4.2;this.nearby=null;for(const car of this.cars){if(!carActive(car,active)||(car.health??200)<=0||Math.abs(car.speed)>2.8)continue;const d=Math.hypot(car.x-p.x,car.z-p.z)-car.length*.35;if(d<distance){distance=d;this.nearby=car;}}return this.nearby;}
  enter(car:CityCar,p:Vector3,solids:readonly Solid3D[],eject?:(car:CityCar)=>void){
    if(this.current||(car.health??200)<=0||Math.abs(car.speed)>2.8||Math.hypot(car.x-p.x,car.z-p.z)>car.length/2+3)return false;
    // Entry requires an accessible side, never an interaction through a wall.
    const exit=this.exitPoint(car,solids);if(!exit)return false;
    const start=p.clone().add(new Vector3(0,1,0)),door=exit.clone().setY(1),direction=door.sub(start),length=direction.length();
    if(length>.01&&traceSolids(start,direction.normalize(),solids.filter(s=>s.id!=='city-traffic-'+car.id),length)<length-.02){this.message='VEHICLE DOOR IS BLOCKED';return false;}
    if(car.driver)eject?.(car);car.driver=false;car.mode='player';car.speed=0;car.door=1;this.doors.set(car.id,.8);this.current=car;this.nearby=null;this.message='VEHICLE ACQUIRED';return true;
  }
  private exitPoint(car:CityCar,solids:readonly Solid3D[]){
    for(const side of [-1,1])for(const offset of [0,-car.length*.45,car.length*.45]){const x=car.x+car.dz*side*(width(car)/2+.65)+car.dx*offset,z=car.z-car.dx*side*(width(car)/2+.65)+car.dz*offset;if(!solids.some(s=>s.enabled&&s.id!=='city-traffic-'+car.id&&s.box.min.y<1.75&&horizontalContact(x,z,.36,s)))return new Vector3(x,0,z);}return null;
  }
  exit(p:Vector3,solids:readonly Solid3D[]){const car=this.current;if(!car)return false;if(Math.abs(car.speed)>2){this.message='BRAKE BEFORE EXITING';return false;}const point=this.exitPoint(car,solids);if(!point){this.message='DOOR BLOCKED / MOVE TO AN OPEN SPACE';return false;}p.copy(point);car.mode=(car.health??0)>0?'parked':'disabled';car.speed=0;car.door=1;this.doors.set(car.id,.8);this.current=null;return true;}
  step(dt:number,input:DrivingInput,solids:readonly Solid3D[],body:Vector3){
    for(const [id,time]of this.doors){const car=this.cars.find(c=>c.id===id);if(car)car.door=Math.max(0,time/.8);if(time<=0)this.doors.delete(id);else this.doors.set(id,time-dt);}
    for(const car of this.cars)if((car.health??200)>0&&(car.health??200)<35){car.health=Math.max(0,car.health!-dt*3);if(car.health<=0){car.mode='disabled';car.speed=0;}}
    if(this.current){driveVehicle(this.current,input,dt,solids);body.set(this.current.x,.55,this.current.z);}
  }
  blast(point:Vector3,radius:number,damage=150){for(const car of this.cars){const distance=Math.max(0,Math.hypot(point.x-car.x,point.z-car.z)-car.length*.4);if(distance<=radius)this.damage(car,damage*(1-distance/radius*.8));}}
  damage(car:CityCar,amount:number){if(!Number.isFinite(amount)||amount<=0||(car.health??200)<=0)return 0;const taken=Math.min(car.health??200,amount);car.health=(car.health??200)-taken;if(car.health<=0){car.mode='disabled';car.speed=0;}return taken;}
  get snapshot(){return{driving:Boolean(this.current),id:this.current?.id??null,kind:this.current?.kind??null,speed:Math.round(Math.abs(this.current?.speed??0)*3.6),health:Math.round(this.current?.health??0),nearby:this.nearby?.kind??null,message:this.message};}
}
