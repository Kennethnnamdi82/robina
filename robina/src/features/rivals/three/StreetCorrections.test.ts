import { describe,it,expect,vi } from 'vitest';
import { Box3,Vector3 } from 'three';
import { NavigationGrid,clearSight } from '../ai/navigation';
import { MissionNavigation } from './MissionNavigation';
import { RoadGuide,routeBearing } from './RoadGuide';
import { CameraRig } from './CameraRig';
import { CitySimulation } from './CitySimulation';
import { VehicleController } from './VehicleController';
import { PolicePursuit } from './PolicePursuit';
import { Projectile3D } from './Projectile3D';
import { RaidRuntime } from './RaidRuntime';
import { TacticalEnemy } from './TacticalEnemy';

describe('street guidance, collision and rolling pursuit corrections',()=>{
  it('responding officers advance while shooting instead of standing at maximum range',()=>{
    const grid=new NavigationGrid(80,80,64,[]),officer=new TacticalEnemy({id:'police-response-0',type:'guard',x:500,y:500,angle:0,patrol:[{x:500,y:500}]},grid),shoot=vi.fn();
    const player={x:1200,y:500};for(let i=0;i<150;i++)officer.step(.02,{player,alive:true,permitted:true,wanted:true},shoot);
    expect(shoot).toHaveBeenCalled();expect(officer.x).toBeGreaterThan(650);expect(officer.lastKnown).toEqual(player);
  });
  it('reinforcement cars fire controlled bursts, keep physical cover and do not teleport',()=>{
    const cars=new CitySimulation(8,3).cars;cars.forEach((c,i)=>Object.assign(c,{kind:'police',x:20+i*5,z:30,dx:1,dz:0,health:200}));
    const shoot=vi.fn(),police=new PolicePursuit(cars,new NavigationGrid(80,80,64,[],46),[],1,()=>{},shoot);police.alert(true);
    for(let i=0;i<90;i++)police.step(.02,{x:40*40,y:30*40},[]);
    expect(police.snapshot.units).toBe(2);expect(shoot.mock.calls.length).toBeGreaterThanOrEqual(3);
    for(const car of cars)expect(car.x).toBeLessThan(65);
    const wall=[{id:'street-wall',enabled:true,x:30*40,y:30*40,width:4*40,height:50*40}],blocked=vi.fn(),car=cars[0];Object.assign(car,{x:20,z:30,dx:0,dz:1,mode:'parked',speed:0});
    const cover=new PolicePursuit([car],new NavigationGrid(80,80,64,wall,46),[],1,()=>{},blocked);cover.alert(true);
    for(let i=0;i<70;i++)cover.step(.02,{x:40*40,y:30*40},[]);expect(blocked).not.toHaveBeenCalled();
  });
  it('keeps a stable forward corridor while moving and never points back to a passed grid cell',()=>{
    const grid=new NavigationGrid(80,80,32,[]),gps=new MissionNavigation(grid,grid),goal={x:2000,y:1200};
    for(let i=0;i<100;i++){const player={x:200+i*12,y:200+i*5};gps.update(.03,player,goal,false);expect(gps.route).toHaveLength(1);expect(gps.next).toEqual(goal);expect(gps.distance).toBeGreaterThan(0);}
    expect(grid.searches).toBe(0);
    const before=gps.route;for(let i=0;i<4;i++)gps.update(0,{x:1400,y:700},goal,false);expect(gps.route).toBe(before);
  });
  it('keeps turns clear of walls and advances waypoints on every movement update',()=>{
    const blockers=[{id:'block',enabled:true,x:700,y:700,width:400,height:400}],grid=new NavigationGrid(70,70,32,blockers),gps=new MissionNavigation(grid,grid),player={x:250,y:700};gps.update(.1,player,{x:1300,y:700},false);
    expect(gps.route.length).toBeGreaterThan(1);let previous=player;for(const point of gps.route){expect(clearSight(previous,point,blockers,18)).toBe(true);previous=point;}
    const waypoint={...gps.route[0]},remaining=gps.route.length;gps.update(.01,waypoint,{x:1300,y:700},false);expect(gps.route.length).toBeLessThan(remaining);
  });
  it('one world arrow survives all camera changes and its screen bearing follows the actual camera',()=>{
    const rig=new CameraRig(),guide=new RoadGuide(),player=new Vector3(20,0,20),goal={x:40*40,y:20*40};rig.resize(390,844);
    for(const pov of ['tactical','first','side','third'] as const){rig.setPOV(pov);rig.yaw=1;rig.update(player,[],.1);guide.update(player,[goal],goal,1);expect(guide.count).toBe(1);expect(Number.isFinite(routeBearing(player,goal,rig.camera))).toBe(true);}
    guide.dispose();
  });
  it('a real hard impact damages both cars and produces one crash followed by a timed explosion',()=>{
    const cars=new CitySimulation(2,2).cars;Object.assign(cars[0],{x:20,z:20,dx:1,dz:0,speed:12,mode:'player'});Object.assign(cars[1],{x:25,z:20,speed:0,mode:'parked'});
    const vehicles=new VehicleController(cars);vehicles.current=cars[0];const body=new Vector3(),solid={id:'city-traffic-'+cars[1].id,enabled:true,kind:'cover' as const,box:new Box3(new Vector3(23,0,19),new Vector3(27,2,21))};
    for(let i=0;i<10;i++)vehicles.step(.1,{throttle:0,steer:0,brake:false},[solid],body);
    expect(vehicles.crashes).toBe(1);expect(cars.every(c=>(c.health??200)<200)).toBe(true);expect(cars[0].fire).toBeGreaterThan(0);expect(vehicles.drainEvents().filter(e=>e.kind==='crash')).toHaveLength(1);
    for(let i=0;i<55;i++)vehicles.step(.1,{throttle:0,steer:0,brake:true},[],body);expect(vehicles.explosions).toBe(2);expect(cars[0].health).toBe(0);expect(vehicles.drainEvents().filter(e=>e.kind==='explosion')).toHaveLength(2);
    vehicles.step(.1,{throttle:0,steer:0,brake:true},[],body);expect(vehicles.drainEvents()).toHaveLength(0);
  });
  it('parking bumps do not explode a healthy car and a burning driver can exit before detonation',()=>{
    const cars=new CitySimulation(3,1).cars,vehicles=new VehicleController(cars),car=cars[0],solid={id:'wall',enabled:true,kind:'wall' as const,box:new Box3()};vehicles.current=car;
    vehicles.collision(car,solid,1);expect(car.health).toBe(200);expect(car.fire).toBeUndefined();vehicles.collision(car,solid,9);expect(car.fuse).toBe(4.5);car.speed=0;const p=new Vector3();expect(vehicles.exit(p,[])).toBe(true);for(let i=0;i<50;i++)vehicles.step(.1,{throttle:0,steer:0,brake:true},[],p);expect(car.exploded).toBe(true);expect(vehicles.current).toBeNull();
  });
  it('a trapped occupant is killed by the actual vehicle explosion, not a camera effect',()=>{
    const car=new CitySimulation(1,1).cars[0],vehicles=new VehicleController([car]);vehicles.current=car;vehicles.damage(car,500);
    const damage=vi.fn(),runtime={vehicles,body:{position:new Vector3(car.x,.55,car.z)},controller:{vitality:{invulnerable:1}},spatial:()=>({distance:0,pan:0}),effects:{blast:vi.fn()},fires:{blast:vi.fn()},combatAudio:{blast:vi.fn()},art:{},solids:[],damage,vehicleEventSerial:0,vehicleBurnAge:0};
    (RaidRuntime.prototype as unknown as {vehicleFeedback(this:unknown,dt:number):void}).vehicleFeedback.call(runtime,.1);expect(damage).toHaveBeenCalledWith(expect.objectContaining({amount:200}));expect(runtime.controller.vitality.invulnerable).toBe(0);expect(runtime.fires.blast).toHaveBeenCalled();
  });
  it('pursues stolen valuables beyond the former timeout and fires from the car while moving',()=>{
    const cars=new CitySimulation(4,1).cars;Object.assign(cars[0],{kind:'police',x:20,z:32,dx:1,dz:0,speed:0});const shoot=vi.fn(),police=new PolicePursuit(cars,new NavigationGrid(60,60,64,[],46),[],1,()=>{},shoot);police.alert(true);
    for(let i=0;i<90;i++)police.step(.1,{x:(32+i*.08)*40,y:32*40},[]);expect(shoot).toHaveBeenCalled();expect(police.snapshot.shots).toBeGreaterThan(2);expect(cars[0].travelled).toBeGreaterThan(5);
    for(let i=0;i<600;i++)police.step(.1,{x:95*40,y:95*40},[]);expect(police.active).toBe(true);expect(police.lost).toBe(false);police.end();expect(police.active).toBe(false);
  });
  it('a police window bullet clears only its own car and is stopped by another car',()=>{
    const pool=new Projectile3D(),own={id:'city-traffic-7',enabled:true,kind:'cover' as const,box:new Box3(new Vector3(-2,0,-2),new Vector3(2,2,2))},cover={id:'city-traffic-9',enabled:true,kind:'cover' as const,box:new Box3(new Vector3(4,0,-2),new Vector3(6,2,2))},hurt=vi.fn(()=>6),target={id:'operative',team:'operative' as const,box:new Box3(new Vector3(8,0,-1),new Vector3(9,2,1)),alive:()=>true,damage:hurt};
    pool.fire(new Vector3(0,1,0),new Vector3(1,0,0),90,1,40,6,'police-car-7','security');pool.step(.2,[own,cover],[target],()=>{});expect(hurt).not.toHaveBeenCalled();
    pool.fire(new Vector3(0,1,0),new Vector3(1,0,0),90,1,40,6,'police-car-7','security');pool.step(.2,[own],[target],()=>{});expect(hurt).toHaveBeenCalledOnce();
  });
});
