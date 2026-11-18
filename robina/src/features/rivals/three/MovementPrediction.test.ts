import {describe,expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {MovementPrediction,type PredictedInput} from './MovementPrediction';
import {PresentationCorrection} from './PresentationCorrection';
import {CameraRig,POVS} from './CameraRig';
import {emptyCommand} from '../input/InputBuffer';
import {MissionSimulation,type AuthoritySnapshot} from '../authority/MissionSimulation';
import {CharacterController} from '../characters/CharacterController';
import {RaidRuntime} from './RaidRuntime';
import {VehicleController,type DrivingInput,driveVehicle} from './VehicleController';
import type {Body3D} from './physics3d';
import type {Solid3D} from './world3d';

const input=(x=1):PredictedInput=>({...emptyCommand(),x,aim:[0,1,20],jump:false,jumpHeld:false,highJump:false,touchRepeat:false,throttle:0,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0});
const snapshot=(tick:number|null,steps=1)=>({prediction:{tick,steps}} as AuthoritySnapshot);

describe('movement acknowledgement and replay',()=>{
  it('restarts the movement timeline after a server generation change without replaying stale inputs',()=>{
    const prediction=new MovementPrediction(),replayed:number[]=[];
    const state=(epoch:number,ack:number|null)=>({prediction:{tick:999,steps:99,stream:{version:1,active:true,epoch,ack}}} as AuthoritySnapshot);
    for(let i=0;i<12;i++)prediction.record(input());
    prediction.reconcile(state(0,4),()=>{},cmd=>replayed.push(cmd.tick!));expect(replayed).toEqual([5,6,7,8,9,10,11,12]);
    replayed.length=0;prediction.reconcile(state(1,null),()=>{},cmd=>replayed.push(cmd.tick!));
    expect(replayed).toEqual([]);expect(prediction.size).toBe(0);expect(prediction.record(input()).tick).toBe(1);
  });
  it('acknowledges simulated movement, not a packet that has only just arrived',()=>{
    const sim=new MissionSimulation('assignment-reserve',42,'prediction');
    sim.input({...input(),tick:20,seq:1});expect(sim.snapshot().prediction.tick).toBeNull();
    sim.step();expect(sim.snapshot().prediction).toMatchObject({tick:20,steps:1});
    sim.step();expect(sim.snapshot().prediction).toMatchObject({tick:20,steps:2});
    sim.input({...input(),tick:30,seq:2});expect(sim.snapshot().prediction).toMatchObject({tick:20,steps:2});
    sim.step();expect(sim.snapshot().prediction).toMatchObject({tick:30,steps:1});
    sim.neutral();sim.step();expect(sim.snapshot().prediction).toMatchObject({tick:30,steps:1});
  });
  it('replays only steps newer than the last movement actually acknowledged',()=>{
    const prediction=new MovementPrediction(),replayed:number[]=[];
    for(let i=0;i<12;i++)prediction.record(input());
    let restored=false;
    prediction.reconcile(snapshot(4,3),()=>{restored=true;},cmd=>replayed.push(cmd.tick!));
    expect(restored).toBe(true);expect(replayed).toEqual([7,8,9,10,11,12]);
  });
  it('does not cancel the initial movement while the first input is in transit',()=>{
    const prediction=new MovementPrediction();for(let i=0;i<8;i++)prediction.record(input());
    let position=8;prediction.reconcile(snapshot(null,0),()=>{position=0;},()=>position++);
    expect(position).toBe(8);
  });
  it('retains the original world movement, aim and driving basis when the camera changes before acknowledgement',()=>{
    const prediction=new MovementPrediction(),command={...input(),cameraYaw:0};prediction.record(command);
    command.x=-1;command.cameraYaw=2;command.aim[0]=50;prediction.record(command);
    const replayed:PredictedInput[]=[];prediction.reconcile(snapshot(0),()=>{},cmd=>replayed.push(cmd));
    expect(replayed[0]).toMatchObject({x:1,cameraYaw:0,aim:[0,1,20]});expect(replayed[1]).toMatchObject({x:-1,cameraYaw:2,aim:[50,1,20]});
  });
  it.each([6,12,24])('does not rubber-band walking or driving with %s delayed fixed ticks and jitter',delay=>{
    for(const speed of [5.875,9.10625,20]){
      const prediction=new MovementPrediction(),correction=new PresentationCorrection(),position=new Vector3(),presented=new Vector3();
      let previous=0,largestJump=0;
      for(let tick=1;tick<=240;tick++){
        prediction.record(input());position.x+=speed/60;
        if(tick>delay&&tick%6===0){
          const through=tick-delay-(tick%12===0?2:0),before=position.clone();
          prediction.reconcile(snapshot(through),()=>{position.x=through*speed/60;},()=>{position.x+=speed/60;});
          correction.correct(before,position);
        }
        correction.present(position,1/60,presented);
        expect(presented.x).toBeGreaterThanOrEqual(previous-1e-7);
        largestJump=Math.max(largestJump,presented.x-previous);previous=presented.x;
        expect(position.x).toBeCloseTo(tick*speed/60,7);
      }
      expect(largestJump).toBeLessThanOrEqual(speed/60+1e-6);
    }
  });
  it.each(POVS)('keeps camera direction and player-relative framing stable through delayed corrections in %s',pov=>{
    const prediction=new MovementPrediction(),rig=new CameraRig(),position=new Vector3(),direction=new Vector3();rig.setPOV(pov);rig.resize(1600,720);
    for(let i=0;i<120;i++)rig.update(position,[],1/60);
    rig.camera.getWorldDirection(direction);const relative=rig.camera.position.clone().sub(position);
    for(let tick=1;tick<=150;tick++){
      prediction.record(input());position.x+=.1;
      if(tick>12&&tick%6===0)prediction.reconcile(snapshot(tick-12),()=>{position.x=(tick-12)*.1;},()=>{position.x+=.1;});
      rig.update(position,[],1/60);
      expect(rig.camera.getWorldDirection(new Vector3()).distanceTo(direction)).toBeLessThan(1e-6);
      expect(rig.camera.position.clone().sub(position).distanceTo(relative)).toBeLessThan(1e-6);
    }
  });
  it('bounds retained history and discards it on death, vehicle transitions and stale recovery',()=>{
    const prediction=new MovementPrediction();for(let i=0;i<1000;i++)prediction.record(input());expect(prediction.size).toBe(120);
    let restored=0,replayed=0;
    prediction.reconcile(snapshot(2),()=>restored++,()=>replayed++);expect(restored).toBe(1);expect(replayed).toBe(0);expect(prediction.size).toBe(0);
    prediction.record(input());prediction.reconcile(snapshot(1001),()=>restored++,()=>replayed++,true);expect(prediction.size).toBe(0);expect(replayed).toBe(0);
    prediction.record(input());prediction.clear();expect(prediction.size).toBe(0);
  });
  it('restores movement without granting health or changing damage history',()=>{
    const controller=new CharacterController(true),state=controller.captureMotion();controller.damage(30);controller.restoreMotion(state);
    expect(controller.health).toBe(70);expect(state).not.toHaveProperty('health');expect(state).not.toHaveProperty('vitality');
  });
  it.each([false,true])('keeps real controller/vehicle physics continuous through 300ms RTT and delivery jitter (driving=%s)',driving=>{
    const server=new MissionSimulation('assignment-reserve',42,'delayed-physics');server.solids.length=0;
    server.enemies.forEach(e=>{e.health.current=0;});
    if(driving){server.vehicles.current=server.traffic.cars[28];Object.assign(server.vehicles.current,{mode:'player',dx:1,dz:0});server.body.position.set(server.vehicles.current.x,.55,server.vehicles.current.z);}
    const client={controller:new CharacterController(true),body:{position:server.body.position.clone(),grounded:true,vertical:0} as Body3D,
      vehicles:new VehicleController(server.traffic.cars.map(c=>({...c}))),solids:[] as Solid3D[],occupants:[] as Solid3D[],nearbySolids:[] as Solid3D[]};
    if(driving)client.vehicles.current=client.vehicles.cars[28];
    const advance=(RaidRuntime.prototype as unknown as {predictMotion(this:unknown,input:PredictedInput,dt:number,replay?:boolean):void}).predictMotion;
    const prediction=new MovementPrediction(),correction=new PresentationCorrection(),presented=client.body.position.clone();
    const commands:{due:number;value:PredictedInput&{seq:number}}[]=[],states:{due:number;state:AuthoritySnapshot}[]=[];
    let seq=0,commandDue=0,stateDue=0,previous=presented.x,worst=0;
    for(let tick=1;tick<=240;tick++){
      while(commands[0]?.due<=tick)server.input(commands.shift()!.value);
      server.step();
      if(tick%6===0){stateDue=Math.max(stateDue,tick+9+(tick%18===0?4:0));states.push({due:stateDue,state:server.snapshot()});}
      while(states[0]?.due<=tick){
        const state=states.shift()!.state,before=client.body.position.clone();
        prediction.reconcile(state,()=>{
          client.body.position.fromArray(state.position);client.body.vertical=state.vertical;client.body.grounded=state.grounded;client.body.jumpTime=state.prediction.jumpTime;
          client.controller.restoreMotion(state.prediction.controller);
          if(driving)Object.assign(client.vehicles.current!,state.cars[28]);
        },cmd=>advance.call(client,cmd,1/60,true));
        correction.correct(before,client.body.position);
      }
      const command=prediction.record({...input(),sprint:true,throttle:driving?1:0});
      if(tick%3===0){commandDue=Math.max(commandDue,tick+9+(tick%15===0?3:0));commands.push({due:commandDue,value:{...command,seq:++seq}});}
      advance.call(client,command,1/60);correction.present(client.body.position,1/60,presented);
      if(tick>60)worst=Math.min(worst,presented.x-previous);previous=presented.x;
      expect(Number.isFinite(presented.x)).toBe(true);
    }
    expect(worst).toBeGreaterThan(-1e-6);expect(prediction.replays).toBeGreaterThan(50);
    expect(client.controller.health).toBe(100);expect(server.controller.health).toBe(100);
  });
  it('bounds touch steering by speed and vehicle class rather than snapping to the stick heading',()=>{
    const sim=new MissionSimulation('assignment-reserve',42,'steering'),car=sim.traffic.cars[28];Object.assign(car,{mode:'player',speed:10,dx:0,dz:1});
    const input:DrivingInput={throttle:1,steer:0,brake:false,heading:Math.PI/2};
    for(let i=0;i<20;i++){const before=Math.atan2(car.dx,car.dz);driveVehicle(car,input,1/60,[]);const delta=Math.atan2(Math.sin(Math.atan2(car.dx,car.dz)-before),Math.cos(Math.atan2(car.dx,car.dz)-before));expect(delta).toBeGreaterThanOrEqual(0);expect(delta).toBeLessThanOrEqual(1.8/60+1e-6);}
    expect(Math.atan2(car.dx,car.dz)).toBeLessThan(.61);
  });
  it('replays a blocked driving step without replaying crash damage, fires or collision events',()=>{
    const sim=new MissionSimulation('assignment-reserve',42,'replayed-crash'),car=sim.traffic.cars[28];Object.assign(car,{x:0,z:0,dx:1,dz:0,speed:10,mode:'player'});sim.vehicles.current=car;
    const client={controller:new CharacterController(true),body:{position:new Vector3(0,.55,0),grounded:true,vertical:0},vehicles:sim.vehicles,
      solids:[{id:'wall',kind:'wall',enabled:true,box:new Box3(new Vector3(2,0,-5),new Vector3(3,3,5))}],occupants:[],nearbySolids:[]};
    const advance=(RaidRuntime.prototype as unknown as {predictMotion(this:unknown,input:PredictedInput,dt:number,replay?:boolean):void}).predictMotion;
    advance.call(client,{...input(),throttle:1},1/60,true);
    expect(car.speed).toBe(0);expect(car.health).toBe(200);expect(car.fire??0).toBe(0);expect(sim.vehicles.drainEvents()).toEqual([]);expect(client.controller.health).toBe(100);
  });
});
