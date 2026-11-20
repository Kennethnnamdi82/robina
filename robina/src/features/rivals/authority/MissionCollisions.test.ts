import {expect,it} from 'vitest';
import {emptyCommand} from '../input/InputBuffer';
import {BODY} from '../three/physics3d';
import {MissionSimulation,COLLISION_SIMULATION_VERSION,VISIBLE_VEHICLE_SIMULATION_VERSION} from './MissionSimulation';

function reserve(version?:number){
  const mission=new MissionSimulation('assignment-reserve',42,'collision-test',version);
  mission.enemies.forEach(enemy=>{enemy.health.current=0;});
  for(const car of mission.traffic.cars)Object.assign(car,{x:-200,z:-200,mode:'parked',speed:0});
  return mission;
}

function walk(mission:MissionSimulation,x:number,z:number,dx:number,dz:number){
  mission.body.position.set(x,0,z);
  mission.controller.stop();
  mission.input({...emptyCommand(),seq:mission.lastSequence+1,x:dx,y:dz,aim:[x,1,z],
    jump:false,jumpHeld:false,highJump:false,touchRepeat:false,throttle:0,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0});
  for(let tick=0;tick<42;tick++)mission.step();
  return mission.body.position.clone();
}

it('blocks the streetlight base and bank pillars while leaving the entrance open',()=>{
  const mission=reserve(COLLISION_SIMULATION_VERSION),legacy=reserve();
  expect(legacy.movementSolids.some(s=>s.id.startsWith('street-lamp-'))).toBe(false);
  const lamp=mission.movementSolids.find(s=>s.id==='street-lamp-6')!;
  const poleZ=(lamp.box.min.z+lamp.box.max.z)/2;
  expect(walk(mission,lamp.box.min.x-2,poleZ,1,0).x).toBeCloseTo(lamp.box.min.x-BODY.radius,3);
  const pillar=mission.movementSolids.find(s=>s.id==='bank-pillar-1')!;
  const pillarX=(pillar.box.min.x+pillar.box.max.x)/2;
  expect(walk(mission,pillarX,pillar.box.max.z+2,0,-1).z).toBeCloseTo(pillar.box.max.z+BODY.radius,3);
  expect(walk(mission,44,28,0,-1).z).toBeLessThan(25.5);
  const building=mission.movementSolids.find(s=>s.id==='building-city-2-0')!;
  const facadeZ=(building.box.min.z+building.box.max.z)/2;
  expect(walk(mission,building.box.min.x-2,facadeZ,1,0).x).toBeLessThanOrEqual(building.box.min.x-BODY.radius+.001);
});

it('blocks walking into the visible side of a parked street car',()=>{
  const mission=reserve(COLLISION_SIMULATION_VERSION),car=mission.traffic.cars[28];
  Object.assign(car,{x:8,z:12,dx:0,dz:1});
  expect(car.collisionWidth).toBeGreaterThan(1.85);
  expect(walk(mission,5,12,1,0).x).toBeCloseTo(car.x-car.collisionWidth!/2-BODY.radius,3);
});

it('stops a driven car on contact with another car',()=>{
  const mission=reserve(COLLISION_SIMULATION_VERSION),driven=mission.traffic.cars[28],parked=mission.traffic.cars[29];
  Object.assign(driven,{x:8,z:8,dx:0,dz:1,mode:'player'});
  Object.assign(parked,{x:8,z:16,dx:0,dz:1});
  mission.vehicles.current=driven;
  mission.body.position.set(8,.55,8);
  mission.input({...emptyCommand(),seq:0,aim:[8,1,16],jump:false,jumpHeld:false,highJump:false,touchRepeat:false,
    throttle:1,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0});
  for(let i=0;i<100;i++)mission.step();
  expect(driven.z).toBeGreaterThan(9);
  expect(driven.z).toBeLessThanOrEqual(parked.z-(driven.length+parked.length)/2+.02);
  expect(mission.vehicles.crashes).toBeGreaterThan(0);
});

it('enters the visible parked car when a closer inactive traffic car exists',()=>{
  const mission=reserve(VISIBLE_VEHICLE_SIMULATION_VERSION);
  const parked=mission.traffic.cars[28],inactive=mission.traffic.cars[14];
  mission.body.position.set(5.9,0,12);
  Object.assign(parked,{x:8,z:12,dx:0,dz:1});
  Object.assign(inactive,{x:6.6,z:12,dx:0,dz:1,mode:'traffic'});
  expect(mission.action({type:'vehicle'})).toBe(true);
  expect(mission.vehicles.current).toBe(parked);
  expect(mission.body.position.toArray()).toEqual([8,.55,12]);
});
