import {describe,it,expect,vi} from 'vitest';
import {Box3,Vector3} from 'three';
import {CameraRig} from './CameraRig';
import {directionalDriving,driveVehicle} from './VehicleController';
import {CitySimulation} from './CitySimulation';
import {CharacterController,MOVEMENT} from '../characters/CharacterController';
import {emptyCommand} from '../input/InputBuffer';
import {composeHeistScore} from './HeistScore';
import {RaidRuntime} from './RaidRuntime';
import {PolicePursuit} from './PolicePursuit';
import {NavigationGrid} from '../ai/navigation';
import {frameTiming} from './frameTiming';

describe('second-pass control and pursuit regressions',()=>{
  it.each([5,8,10,15,30,60,120])('keeps a second of game movement at %s FPS with at most six bounded physics steps',fps=>{
    let accumulator=0,elapsed=0;for(let i=0;i<fps;i++){const {delta,step}=frameTiming(1/fps);accumulator+=delta;let count=0;while(accumulator+1e-9>=step&&count<6){elapsed+=step;accumulator=Math.max(0,accumulator-step);count++;}expect(count).toBeLessThanOrEqual(6);}expect(elapsed+accumulator).toBeCloseTo(1,5);expect(frameTiming(60).delta).toBe(.2);
  });
  it('never moves a perspective camera under the road at extreme drag, zoom or wall recovery',()=>{
    const rig=new CameraRig(),player=new Vector3(12,0,12),wall={id:'wall',enabled:true,kind:'wall' as const,box:new Box3(new Vector3(8,0,13),new Vector3(16,8,15))};rig.resize(320,568);
    for(const pov of ['third','first'] as const){rig.setPOV(pov);for(const zoom of [.7,1,1.4]){rig.setZoom(zoom);for(let i=0;i<120;i++){rig.rotate(18,i%40<20?-120:120);rig.update(player,[wall],1/30);expect(rig.camera.position.y).toBeGreaterThanOrEqual(.42);expect(rig.camera.position.toArray().every(Number.isFinite)).toBe(true);}}}
  });
  it.each([-1,1])('a sideways stick both accelerates and turns screen-relative (%s)',side=>{
    const car=new CitySimulation(2,1).cars[0];Object.assign(car,{x:40,z:40,dx:0,dz:-1,speed:0});
    for(let i=0;i<90;i++)driveVehicle(car,directionalDriving({throttle:0,steer:0,brake:false,stickX:side,stickY:0,cameraYaw:0}),1/60,[]);
    expect(car.x*side).toBeGreaterThan(40*side+3);expect(car.dx*side).toBeGreaterThan(.9);expect(car.speed).toBeGreaterThan(4);
  });
  it('pulling the stick back reverses without flipping the car, and release brakes',()=>{
    const car=new CitySimulation(2,1).cars[0];Object.assign(car,{x:40,z:40,dx:0,dz:-1,speed:0});
    const reverse=directionalDriving({throttle:0,steer:0,brake:false,stickX:0,stickY:1});for(let i=0;i<60;i++)driveVehicle(car,reverse,1/60,[]);
    expect(car.z).toBeGreaterThan(42);expect(car.dz).toBe(-1);expect(car.speed).toBeLessThan(0);
    for(let i=0;i<60;i++)driveVehicle(car,directionalDriving({throttle:0,steer:0,brake:false,stickX:0,stickY:0}),1/60,[]);expect(car.speed).toBe(0);
  });
  it('snaps up to movement speed and does not rubber-band the 3D operative on every nonlethal hit',()=>{
    const soldier=new CharacterController(true),command={...emptyCommand(),x:1,sprint:true};for(let i=0;i<4;i++)soldier.step(command,1/60);expect(soldier.vx).toBeGreaterThan(MOVEMENT.walkSpeed*1.45);
    soldier.damage(5);const before=soldier.vx;soldier.step(command,1/60);expect(soldier.vx).toBeGreaterThanOrEqual(before);expect(soldier.sprinting).toBe(true);
    soldier.step(emptyCommand(),.1);expect(soldier.vx).toBeLessThan(1);
    const classic=new CharacterController();classic.step(command,.1);classic.damage(5);classic.step(command,1/60);expect(classic.vx).toBe(0);
  });
  it('Collect takes the shown loose pickup, never the nearby car',()=>{
    const pickup={id:'medkit'},take=vi.fn(()=>true),vehicleInteract=vi.fn(),publish=vi.fn();
    const runtime={campaign:null,vehicles:{nearby:{id:28}},body:{position:new Vector3()},solids:[],field:{nearby:()=>pickup,take,pending:null},loadout:{start:vi.fn()},controller:{vitality:{},health:50},audio:{effect:vi.fn()},equip:vi.fn(),publish,vehicleInteract};
    (RaidRuntime.prototype as unknown as {interact(this:unknown):void}).interact.call(runtime);expect(take).toHaveBeenCalled();expect(vehicleInteract).not.toHaveBeenCalled();expect(publish).toHaveBeenCalled();
  });
  it('keeps the lead police car moving after deployment when valuable cargo is stolen',()=>{
    const cars=new CitySimulation(3,1).cars;Object.assign(cars[0],{kind:'police',x:20,z:32,dx:1,dz:0,speed:0});const deploy=vi.fn(),police=new PolicePursuit(cars,new NavigationGrid(60,60,64,[],46),[],1,deploy),player={x:32*40,y:32*40};
    police.alert();police.step(.1,player,[]);expect(deploy).toHaveBeenCalledTimes(2);const start=cars[0].x;police.alert(true);for(let i=0;i<25;i++)police.step(.1,player,[]);expect(cars[0].x).toBeGreaterThan(start+3);expect(police.snapshot.hunting).toBe(true);expect(police.lost).toBe(false);
  });
  it('reroutes a responding police car around a stopped vehicle instead of permanently ramming it',()=>{
    const cars=new CitySimulation(3,1).cars;Object.assign(cars[0],{kind:'police',x:20,z:32,dx:1,dz:0,speed:0});const obstruction={id:'city-traffic-100',enabled:true,kind:'cover' as const,box:new Box3(new Vector3(23.6,0,31),new Vector3(28.4,2,33))},deploy=vi.fn(),police=new PolicePursuit(cars,new NavigationGrid(60,60,64,[],46),[obstruction],1,deploy);
    police.alert();for(let i=0;i<400&&!deploy.mock.calls.length;i++)police.step(.1,{x:44*40,y:32*40},[]);expect(cars[0].x).toBeGreaterThan(29);expect(deploy).toHaveBeenCalledTimes(2);
  });
  it('composes a deterministic stereo heist score with headroom and a separate pursuit layer',()=>{
    const a=composeHeistScore(8000),b=composeHeistScore(8000);expect(a.seconds).toBeGreaterThan(8);expect(a.left).toEqual(b.left);let peak=0,energy=0,alert=0,difference=0;for(let i=0;i<a.left.length;i++){peak=Math.max(peak,Math.abs(a.left[i]));energy+=a.left[i]**2;alert+=a.tension[i]**2;difference+=Math.abs(a.left[i]-a.right[i]);}expect(peak).toBeLessThan(.9);expect(Math.sqrt(energy/a.left.length)).toBeGreaterThan(.06);expect(alert).toBeGreaterThan(1);expect(difference).toBeGreaterThan(1);expect(a.left.at(-1)).toBeCloseTo(0,2);
  });
});
