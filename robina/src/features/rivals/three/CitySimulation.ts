import { cityRandom, STREET_CENTRES, trafficPhase, trafficRoute, type CityPoint } from './LivingCityPlan';
export type VehicleKind = 'sedan' | 'coupe' | 'taxi' | 'police' | 'van' | 'lorry' | 'tanker' | 'bus';
export interface CityCar { id:number; kind:VehicleKind; route:CityPoint[]; lengths:number[]; total:number; distance:number; x:number; z:number; dx:number; dz:number; speed:number; cruise:number; length:number; stopped:boolean; travelled:number; mode?:'traffic'|'parked'|'player'|'pursuit'|'disabled'; health?:number; driver?:boolean; door?:number;fire?:number }
export const carActive=(car:CityCar,active:number)=>car.id<active||Boolean(car.mode&&car.mode!=='traffic');
export const VEHICLE_LENGTH:Record<VehicleKind,number>={sedan:4.1,coupe:4.2,taxi:4.1,police:4.3,van:4.8,lorry:6.8,tanker:7.2,bus:6.8};
export function sampleRoute(car: Pick<CityCar,'route'|'lengths'|'total'>, distance:number) {
  let at=((distance%car.total)+car.total)%car.total;
  for(let i=0;i<car.route.length;i++) {
    const length=car.lengths[i];if(at>length&&i<car.route.length-1){at-=length;continue;}
    const a=car.route[i],b=car.route[(i+1)%car.route.length],dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
    return{x:a.x+dx*at,z:a.z+dz*at,dx,dz};
  }
  return{x:0,z:0,dx:1,dz:0};
}
/** Bounded local traffic, independent of combat AI. All cars use a common
 * protected signal clock. Movement is substepped by the owner at <= 1/30s. */
export class CitySimulation {
  readonly cars:CityCar[]=[];
  time=0;stops=0;
  blocked?:(car:CityCar)=>boolean;
  constructor(seed:number,count=28) {
    const random=cityRandom(seed^0xa3189),kinds:VehicleKind[]=['sedan','taxi','coupe','lorry','sedan','tanker','van','police','bus'];
    for(let i=0;i<count;i++) {
      const kind=kinds[i%kinds.length],outer=['tanker','lorry','bus'].includes(kind),route=trafficRoute(outer?0:i%3,outer?0:Math.floor(i/3)%3,outer?3:1);
      const lengths=route.map((p,j)=>Math.hypot(p.x-route[(j+1)%route.length].x,p.z-route[(j+1)%route.length].z)),total=lengths.reduce((a,b)=>a+b,0);
      // Distribute repeated routes evenly; never materialize two cars together.
      let distance=(i<9?.28:random())*total;
      const car:CityCar={id:i,kind,route,lengths,total,distance,x:0,z:0,dx:1,dz:0,speed:0,cruise:outer?4.6:5.4+random()*1.8,length:VEHICLE_LENGTH[kind],stopped:false,travelled:0,mode:'traffic',health:200,driver:true,door:0};
      for(let attempt=0;attempt<30;attempt++) {Object.assign(car,sampleRoute(car,distance));if(!this.cars.some(c=>Math.hypot(c.x-car.x,c.z-car.z)<(c.length+car.length)/2+2))break;distance=(distance+9)%total;}
      car.distance=distance;this.cars.push(car);
    }
  }
  step(dt:number,obstacles:readonly CityPoint[]=[],active=28) {
    this.time+=dt;const phase=trafficPhase(this.time);
    for(let index=0;index<this.cars.length;index++) {
      const car=this.cars[index];if(index>=active||car.mode&&car.mode!=='traffic')continue;
      let clearance=Infinity;
      const axis=Math.abs(car.dx)>.92?'x':Math.abs(car.dz)>.92?'z':null;
      if(axis&&phase[axis]!=='green')for(const x of STREET_CENTRES)for(const z of STREET_CENTRES) {
        const along=(x-car.x)*car.dx+(z-car.z)*car.dz,across=Math.abs((x-car.x)*car.dz-(z-car.z)*car.dx);
        // Once the front has crossed the stop line it clears the junction.
        const stop=6.1+car.length/2;
        if(across<3&&along>=stop-.04)clearance=Math.min(clearance,Math.max(0,along-stop));
      }
      for(let j=0;j<this.cars.length;j++) {
        const other=this.cars[j];if(other===car||!carActive(other,active))continue;
        const x=other.x-car.x,z=other.z-car.z,along=x*car.dx+z*car.dz,across=Math.abs(x*car.dz-z*car.dx);
        if(along>0&&across<1.65&&car.dx*other.dx+car.dz*other.dz>.3)clearance=Math.min(clearance,Math.max(0,along-(car.length+other.length)/2-1.3));
      }
      for(const p of obstacles) {
        const x=p.x-car.x,z=p.z-car.z,along=x*car.dx+z*car.dz,across=Math.abs(x*car.dz-z*car.dx);
        if(along>0&&across<1.65)clearance=Math.min(clearance,Math.max(0,along-car.length/2-1.25));
      }
      const target=Math.min(car.cruise,Math.sqrt(Math.max(0,2*4.5*clearance)));
      car.speed=Math.max(0,car.speed+Math.max(-6*dt,Math.min(2.2*dt,target-car.speed)));
      const travel=Math.min(car.speed*dt,clearance);car.distance=(car.distance+travel)%car.total;car.travelled+=travel;
      const stopped=car.speed<.2;if(stopped&&!car.stopped)this.stops++;car.stopped=stopped;
      const previous={x:car.x,z:car.z,dx:car.dx,dz:car.dz};Object.assign(car,sampleRoute(car,car.distance));
      if(this.blocked?.(car)){Object.assign(car,previous);car.distance=(car.distance-travel+car.total)%car.total;car.travelled-=travel;car.speed=0;car.stopped=true;}
    }
  }
  get stats(){return{clock:this.time,stops:this.stops,travelled:this.cars.reduce((n,c)=>n+c.travelled,0),signals:trafficPhase(this.time),sample:this.cars.slice(0,5).map(c=>({id:c.id,kind:c.kind,x:c.x,z:c.z,speed:c.speed}))};}
}
