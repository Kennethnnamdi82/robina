import {describe,it,expect,vi} from 'vitest';
import {Group,Vector3} from 'three';
import {RaidRuntime} from './RaidRuntime';
import {frameTiming} from './frameTiming';
import {CharacterController} from '../characters/CharacterController';
import {emptyCommand} from '../input/InputBuffer';
import {moveKinematic} from './physics3d';
import {createAssignmentOperation,nextOperation} from './Operations';
import {WorldState} from '../world/WorldState';
import {convertSolids} from './world3d';
import {STREET_CENTRES,waterfrontRails,cityPlan} from './LivingCityPlan';
import {isAssignmentUnlocked,emptyDossier,OPERATIONS} from '../hub/model';
import {CitySimulation} from './CitySimulation';
import {driveVehicle,drivenVehiclePose} from './VehicleController';
import {CombatAudio} from './CombatAudio';
import {defaultSettings} from '../core/settings';
import {addAssignmentWalls} from './AssignmentSite';
import {ASSIGNMENTS} from '../missions/assignments';

describe('open world motion and continuous operations',()=>{
 it('continues damage-immunity and hurt timers while driving rather than making occupants invulnerable',()=>{
  const controller=new CharacterController(true);expect(controller.damage(10)).toBeGreaterThan(0);for(let i=0;i<60;i++)controller.stepMounted(1/60);
  expect(controller.vitality.invulnerable).toBe(0);expect(controller.damage(10)).toBeGreaterThan(0);expect(controller.vx).toBe(0);expect(controller.vy).toBe(0);
 });
 it('does not advance a walking or shooting pose while mounted in a car',()=>{
  const update=vi.fn(),runtime={player:{root:new Group()},vehicles:{current:{}},humanoidFrame:{vx:4,vz:2},humanoid:{update}};
  (RaidRuntime.prototype as unknown as {animatePlayer(this:unknown,dt:number,p:Vector3):void}).animatePlayer.call(runtime,1/60,new Vector3(20,.55,32));
  expect(runtime.player.root.position.toArray()).toEqual([20,.55,32]);expect(runtime.humanoidFrame).toEqual({vx:0,vz:0});expect(update).not.toHaveBeenCalled();
 });
 it.each([false,true])('never pulls the presented player backwards through uneven frames (sprint=%s)',sprint=>{
  const controller=new CharacterController(true),command={...emptyCommand(),x:1,sprint},body={position:new Vector3(10,0,10),vertical:0,grounded:true};let accumulator=0,previous=10,presented=10;
  for(let i=0;i<120;i++){const {delta,step}=frameTiming([1/60,.075,.09,1/30,.13][i%5]);expect(step).toBe(1/60);accumulator+=delta;let ticks=0;while(accumulator+1e-9>=step&&ticks++<12){previous=body.position.x;controller.step(command,step);moveKinematic(body,controller.vx*.025*step,0,step,[]);accumulator=Math.max(0,accumulator-step);}const x=previous+(body.position.x-previous)*Math.min(1,accumulator/step);expect(x).toBeGreaterThanOrEqual(presented-.000001);presented=x;}
 });
 it('interpolates steering and wheel travel together instead of adding render-only heading lag',()=>{
  const car=new CitySimulation(1).cars[0];Object.assign(car,{x:30,z:30,dx:0,dz:1,speed:10,travelled:0,mode:'player'});driveVehicle(car,{throttle:1,steer:1,brake:false},1/60,[]);
  const a=drivenVehiclePose(car,0),b=drivenVehiclePose(car,.5),c=drivenVehiclePose(car,1);expect(b.yaw).toBeCloseTo((a.yaw+c.yaw)/2);expect(b.travelled).toBeCloseTo(car.travelled/2);expect(c.yaw).toBeCloseTo(Math.atan2(car.dx,car.dz));
 });
 it('opens every former east street closure and crosses all four bridges on foot and by car',()=>{
  const operation=createAssignmentOperation(0,31),world=new WorldState(operation.level);addAssignmentWalls(world,ASSIGNMENTS[0]);const solids=convertSolids(world);
  for(const z of STREET_CENTRES){const b={position:new Vector3(88,0,z),vertical:0,grounded:true};for(let i=0;i<550;i++)moveKinematic(b,.075,0,1/60,solids);expect(b.position.x).toBeGreaterThan(128);
   const car=new CitySimulation(1).cars[0];Object.assign(car,{x:88,z,dx:1,dz:0,speed:8,mode:'player',health:200});for(let i=0;i<400;i++)driveVehicle(car,{throttle:1,steer:0,brake:false},1/60,solids);expect(car.x).toBeGreaterThan(128);}
  const buildings=cityPlan(operation.venue,operation.seed).buildings;expect(buildings.some(b=>b.name==='HOTEL MERIDIAN')).toBe(true);expect(buildings.some(b=>b.name?.includes('/ BAR'))).toBe(true);
  for(const rail of waterfrontRails())for(const z of STREET_CENTRES)expect(Math.abs(rail.z-z)).toBeGreaterThanOrEqual(rail.depth/2+5.79);
 });
 it('does not insert a new roadblock when any mission site is installed',()=>{
  for(let index=0;index<ASSIGNMENTS.length;index++){const operation=createAssignmentOperation(index,31),world=new WorldState(operation.level);addAssignmentWalls(world,ASSIGNMENTS[index]);expect(world.blockers.some(b=>b.id==='mission-roadblock')).toBe(false);
   const solids=convertSolids(world);for(const z of STREET_CENTRES){const body={position:new Vector3(10,0,z),vertical:0,grounded:true};for(let i=0;i<1250;i++)moveKinematic(body,.1,0,1/60,solids);expect(body.position.x,`contract ${index} avenue ${z}`).toBeGreaterThan(134);}
  }
 });
 it('has no level locks and continues well beyond the last authored contract',()=>{
  const dossier=emptyDossier();for(let i=0;i<OPERATIONS.length;i++)expect(isAssignmentUnlocked(dossier,i)).toBe(true);
  let operation=createAssignmentOperation(6,123);for(let i=0;i<30;i++){const before=operation;operation=nextOperation(operation,true);expect(operation.ordinal).toBe(before.ordinal+1);expect(operation.seed).not.toBe(before.seed);expect(operation.assignment).toBe((before.assignment!+1)%OPERATIONS.length);expect(nextOperation(operation,false).ordinal).toBe(operation.ordinal);}
 });
 it('uses alternating human death vocals with a separate physical collapse and respects mute',()=>{
  const bus=new CombatAudio(defaultSettings()),play=vi.spyOn(bus as unknown as {play:(...args:unknown[])=>void},'play');bus.death(4,.2);bus.death(4,.2);
  expect(play.mock.calls.map(c=>c[0])).toEqual(['vocal-death-0','collapse','vocal-death-1','collapse']);expect(bus.snapshot().state).toBe('locked');bus.dispose();
 });
});
