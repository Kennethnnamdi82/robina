import { describe,it,expect } from 'vitest';
import { Box3,Vector3 } from 'three';
import { BODY,horizontalContact,moveKinematic,traceSolids } from './physics3d';
import type { Solid3D } from './world3d';
import {CityTrafficArt} from './CityTrafficArt';
import {CitySimulation,TRAFFIC_COUNT,vehicleCollisionDimensions} from './CitySimulation';
const solid=(id:string,x:number,z:number,w:number,d:number):Solid3D=>({id,kind:'cover',enabled:true,box:new Box3(new Vector3(x-w/2,0,z-d/2),new Vector3(x+w/2,2,z+d/2))});
const body=(x:number,z:number)=>({position:new Vector3(x,0,z),vertical:0,grounded:true});
describe('road movement regression',()=>{
 it('refreshes traffic collision boxes from a received snapshot before any rendering',()=>{
  const simulation=new CitySimulation(42),colliders=simulation.cars.map(car=>({...solid('city-traffic-'+car.id,0,0,1,1),oriented:{center:new Vector3(),half:new Vector3(),yaw:0}}));
  const art={simulation,colliders,active:TRAFFIC_COUNT};
  const car=simulation.cars[0];Object.assign(car,{x:8,z:8,dx:1,dz:0});
  CityTrafficArt.prototype.syncColliders.call(art as unknown as CityTrafficArt,new Vector3(8,0,8));
  expect(colliders[0].oriented.center.x).toBe(8);expect(colliders[0].oriented.yaw).toBeCloseTo(Math.PI/2);
  const width=vehicleCollisionDimensions(car.kind).width;
  expect(colliders[0].box.min.x).toBeCloseTo(8-car.length/2);expect(colliders[0].box.min.z).toBeCloseTo(8-width/2);
  Object.assign(car,{x:20,z:8,dx:0,dz:1});
  CityTrafficArt.prototype.syncColliders.call(art as unknown as CityTrafficArt,new Vector3(8,0,8));
  expect(horizontalContact(8,8,BODY.radius,colliders[0])).toBeNull();
  expect(colliders[0].oriented.center.x).toBe(20);expect(colliders[0].oriented.yaw).toBe(0);
 });
 it('slides along joined wall segments without snagging on each seam',()=>{
  const walls=Array.from({length:12},(_,i)=>({...solid('wall-'+i,2,i*1.6,1.6,1.6),kind:'wall' as const}));
  const b=body(.8,-1);for(let i=0;i<480;i++)moveKinematic(b,.04,.05,1/60,walls);
  expect(b.position.z).toBeGreaterThan(20);expect(b.position.toArray().every(Number.isFinite)).toBe(true);
 });
 it('does not collide with the empty AABB corners of a turning lorry',()=>{
  const truck=solid('turning-truck',0,0,8,8);truck.oriented={center:new Vector3(0,1,0),half:new Vector3(.9,1,4.8),yaw:Math.PI/4};
  expect(horizontalContact(3,-3,BODY.radius,truck)).toBeNull();
  const b=body(3,-3);moveKinematic(b,.2,0,1/60,[truck]);expect(b.position.x).toBeCloseTo(3.2);expect(b.position.z).toBe(-3);
  expect(traceSolids(new Vector3(3,1,-3),new Vector3(1,0,0),[truck],.5)).toBe(.5);
 });
 it('recovers from an existing overlap and lets the operative walk away',()=>{
  const car=solid('moving-car',0,0,2,4),b=body(.9,0);moveKinematic(b,0,0,1/60,[car]);
  expect(horizontalContact(b.position.x,b.position.z,BODY.radius,car)).toBeNull();
  const start=b.position.x;for(let i=0;i<60;i++)moveKinematic(b,.05,0,1/60,[car]);expect(b.position.x).toBeGreaterThan(start+2.9);
 });
 it('slides around rounded corners and still blocks fast travel through a solid',()=>{
  const block=solid('block',2,0,1,2),b=body(0,.99);
  for(let i=0;i<60;i++)moveKinematic(b,.08,.03,1/60,[block]);expect(b.position.x).toBeGreaterThan(3.5);
  const sprint=body(0,0);moveKinematic(sprint,30,0,1/60,[block]);expect(sprint.position.x).toBeCloseTo(1.5-BODY.radius,4);
 });
});
