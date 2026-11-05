import {describe,it,expect,vi} from 'vitest';
import {Box3,Vector3,Texture,PerspectiveCamera,Scene,type WebGLRenderer} from 'three';
import {createAssignmentOperation} from './Operations';
import {WorldState} from '../world/WorldState';
import {addAssignmentWalls} from './AssignmentSite';
import {assignmentAt} from '../missions/assignments';
import {convertSolids} from './world3d';
import {NavigationGrid} from '../ai/navigation';
import {CitySimulation} from './CitySimulation';
import {VehicleController} from './VehicleController';
import {PolicePursuit} from './PolicePursuit';
import {MissionEngine} from '../missions/MissionEngine';
import {CampaignGameplay} from './CampaignGameplay';
import {CivilianCombat} from './CivilianCombat';
import type {Civilian} from './CityCrowd';
import {Projectile3D} from './Projectile3D';
import {WorldFires} from './WorldFires';
import {CityPostProcess} from './CityPostProcess';
import {TacticalEnemy} from './TacticalEnemy';
import {ENEMY_TYPES} from '../ai/definitions';

function bank(){
  const operation=createAssignmentOperation(0,43),world=new WorldState(operation.level);addAssignmentWalls(world,assignmentAt(0));
  const solids=convertSolids(world),foot=new NavigationGrid(world.level.width*2,world.level.height*2,32,world.blockers),road=new NavigationGrid(world.level.width,world.level.height,64,world.blockers,46),cars=new CitySimulation(44).cars,vehicles=new VehicleController(cars),deploy=vi.fn(),police=new PolicePursuit(cars,road,solids,2,deploy),mission=new MissionEngine(operation.mission,'repair');mission.prepare();mission.start();const game=new CampaignGameplay(0,mission,world,vehicles,police,foot);return{world,solids,foot,road,cars,vehicles,police,mission,game,deploy};
}
describe('requested playable heist repairs',()=>{
  it('alerts police on bank entry and lets Collect take the actual case without killing every guard',()=>{
    const s=bank();s.game.step(.1,new Vector3(44,0,25),3);expect(s.police.active).toBe(true);expect(s.mission.snapshot().activeId).toBe('recover');
    expect(s.game.interact(new Vector3(44,0,18))).toBe(true);expect(s.game.carrying).toBe(true);expect(s.world.active.has('cargo-recovered')).toBe(true);
    s.game.interact(new Vector3(8,0,80));expect(s.mission.state).toBe('ACTIVE');s.police.lost=true;s.game.step(.1,new Vector3(8,0,80),3);s.game.interact(new Vector3(8,0,80));expect(s.mission.state).toBe('SUCCESS');
  });
  it('does not award the case from outside its reachable pickup range',()=>{
    const s=bank();s.game.step(.1,new Vector3(44,0,25),3);expect(s.game.interact(new Vector3(8,0,8))).toBe(false);expect(s.game.carrying).toBe(false);
  });
  it('keeps an inbound response alive instead of losing pursuit before the cars arrive',()=>{
    const s=bank();s.police.alert();for(let i=0;i<80;i++)s.police.step(.1,{x:3800,y:3800},[]);expect(s.police.lost).toBe(false);expect(s.police.snapshot.units).toBe(2);
  });
  it('physically drives a responding car from a street to the bank and deploys officers',()=>{
    const s=bank(),car=s.cars.find(c=>c.kind==='police')!;for(const other of s.cars)if(other!==car&&other.kind==='police')other.health=0;
    Object.assign(car,{x:8,z:8,dx:1,dz:0,speed:0});s.police.alert();
    for(let i=0;i<400&&!s.deploy.mock.calls.length;i++)s.police.step(.1,{x:1760,y:800},[]);
    expect(car.travelled).toBeGreaterThan(15);expect(s.deploy).toHaveBeenCalledTimes(2);expect(Math.hypot(car.x-44,car.z-20)).toBeLessThan(15);
  });
  it('gives responding officers an aggressive profile without changing shared guards or shooting through walls',()=>{
    const grid=new NavigationGrid(60,60,64,[]),spawn={id:'police-7-0',type:'guard' as const,x:320,y:320,angle:0,patrol:[{x:320,y:320}]},officer=new TacticalEnemy(spawn,grid),shoot=vi.fn();
    for(let i=0;i<120;i++)officer.step(1/60,{player:{x:700,y:320},alive:true,permitted:true},shoot);
    expect(shoot.mock.calls.length).toBeGreaterThanOrEqual(2);expect(ENEMY_TYPES.guard.interval).toBe(1.8);
  });
  it('sweeps real bullets into civilians, flinches once, and stops locomotion on a lethal hit',()=>{
    const person:Civilian={x:0,z:0,route:[],target:0,speed:1,yaw:0,crossing:false,panicUntil:0,idleUntil:0,distance:0,moving:true,motion:1},combat=new CivilianCombat([person]),pool=new Projectile3D(),crime=vi.fn();combat.onCrime=crime;
    pool.fire(new Vector3(-2,1,0),new Vector3(1,0,0),100,1,10,35,'operative','operative');pool.step(.1,[],combat.targets,()=>{});expect(person.health).toBe(25);expect(person.hitRemaining).toBeGreaterThan(0);combat.step(.1);
    pool.fire(new Vector3(-2,1,0),new Vector3(1,0,0),100,1,10,35,'operative','operative');pool.step(.1,[],combat.targets,()=>{});expect(person.health).toBe(0);expect(person.moving).toBe(false);expect(combat.targets[0].alive()).toBe(false);combat.step(.5);expect(person.deathAge).toBeCloseTo(.5);expect(crime).toHaveBeenCalledTimes(2);
  });
  it('a wall stops a bullet before it reaches a pedestrian',()=>{
    const person={x:0,z:0,route:[],target:0,speed:1,yaw:0,crossing:false,panicUntil:0,idleUntil:0,distance:0,moving:true,motion:1} as Civilian,combat=new CivilianCombat([person]),pool=new Projectile3D();
    pool.fire(new Vector3(-2,1,0),new Vector3(1,0,0),100,1,10,100,'operative','operative');pool.step(.1,[{id:'wall',enabled:true,kind:'wall',box:new Box3(new Vector3(-1,0,-2),new Vector3(-.5,3,2))}],combat.targets,()=>{});expect(combat.deaths).toBe(0);expect(combat.hits).toBe(0);
  });
  it('one nearby grenade ignites a healthy car and sustained fire eventually disables it',()=>{
    const cars=new CitySimulation(3,1).cars,car=cars[0],vehicles=new VehicleController(cars);car.mode='parked';vehicles.blast(new Vector3(car.x,0,car.z),7);expect(car.health).toBe(50);expect(car.fire).toBe(24);for(let i=0;i<80;i++)vehicles.step(.1,{throttle:0,steer:0,brake:false},[],new Vector3());expect(car.health).toBe(0);expect(car.fire).toBeGreaterThan(0);
  });
  it('keeps building and vehicle fires persistent but bounded, with two batched draws',()=>{
    const textures={blast:new Texture(),smoke:new Texture()},fires=new WorldFires(textures),wall={id:'building',kind:'wall' as const,enabled:true,box:new Box3(new Vector3(1,0,-2),new Vector3(3,10,2))};fires.blast(new Vector3(),7,[wall]);fires.step(2,[]);expect(fires.snapshot.buildings).toBe(1);expect(fires.snapshot.aftermath).toBe(1);fires.draw(new PerspectiveCamera(),2,new Vector3());expect(fires.root.children).toHaveLength(3);fires.step(30,[]);expect(fires.snapshot.active).toBe(0);fires.dispose();textures.blast.dispose();textures.smoke.dispose();
  });
  it('renders mobile High in one native scene pass instead of allocating the HDR bloom chain',()=>{
    const previous=Object.getOwnPropertyDescriptor(navigator,'maxTouchPoints');Object.defineProperty(navigator,'maxTouchPoints',{value:5,configurable:true});
    try{const renderer={render:vi.fn()} as unknown as WebGLRenderer,camera=new PerspectiveCamera(),post=new CityPostProcess(renderer,new Scene(),camera);post.quality('high');post.render(camera,0);expect(renderer.render).toHaveBeenCalledTimes(1);post.dispose();}finally{if(previous)Object.defineProperty(navigator,'maxTouchPoints',previous);else Reflect.deleteProperty(navigator,'maxTouchPoints');}
  });
});
