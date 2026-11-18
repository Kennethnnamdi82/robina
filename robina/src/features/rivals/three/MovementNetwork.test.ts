import {describe,expect,it,vi} from 'vitest';
import {Box3,Vector3} from 'three';
import {MissionSimulation,type AuthorityInput,type AuthoritySnapshot} from '../authority/MissionSimulation';
import {MovementPrediction,type PredictedInput} from './MovementPrediction';
import {PresentationCorrection} from './PresentationCorrection';
import {CharacterController} from '../characters/CharacterController';
import {RaidRuntime} from './RaidRuntime';
import {VehicleController} from './VehicleController';
import type {Body3D} from './physics3d';
import type {Solid3D} from './world3d';
import {MissionAuthorityClient} from '@/services/missionAuthority';
import {emptyCommand} from '../input/InputBuffer';
import {simulationBudget} from '../../../../../backend/src/missions/simulationClock.js';

interface Scenario {fps:number;rtt:number;jitter?:boolean;irregular?:boolean;serverStalls?:boolean;turns?:boolean;wall?:boolean;actions?:boolean;driving?:boolean}
const scenarios:Scenario[]=[{fps:120,rtt:0},{fps:60,rtt:0},{fps:60,rtt:200},{fps:60,rtt:400,jitter:true},
  {fps:30,rtt:200},{fps:15,rtt:400},{fps:8,rtt:200},{fps:60,rtt:400,irregular:true},
  {fps:60,rtt:400,serverStalls:true},{fps:15,rtt:200,turns:true},{fps:8,rtt:400,turns:true},
  {fps:30,rtt:200,wall:true},{fps:30,rtt:400,actions:true},
  {fps:30,rtt:400,driving:true},{fps:8,rtt:400,driving:true,jitter:true}];
describe('real movement transport, physics and reconciliation',()=>{
  for(const sprint of [false,true])for(const scenario of scenarios){
    it(`${sprint?'running':'walking'} stays consistent: ${JSON.stringify(scenario)}`,()=>{
      const server=new MissionSimulation('assignment-reserve',42,'movement-network');
      server.solids.length=0;server.enemies.forEach(e=>e.health.current=0);server.body.position.set(8,0,8);
      if(scenario.driving){server.vehicles.current=server.traffic.cars[28];Object.assign(server.vehicles.current,{x:8,z:8,dx:1,dz:0,speed:0,mode:'player'});server.body.position.y=.55;}
      if(scenario.wall)server.solids.push({id:'movement-test-wall',kind:'wall',enabled:true,box:new Box3(new Vector3(13,0,5),new Vector3(14,5,11))});
      const createBody=()=>({controller:new CharacterController(true),body:{position:server.body.position.clone(),grounded:true,vertical:0} as Body3D,
        vehicles:new VehicleController(server.traffic.cars.map(c=>({...c}))),solids:server.solids,occupants:[] as Solid3D[],nearbySolids:[] as Solid3D[]});
      const client=createBody(),reference=createBody();
      if(scenario.driving){client.vehicles.current=client.vehicles.cars[28];reference.vehicles.current=reference.vehicles.cars[28];}
      const advance=(RaidRuntime.prototype as unknown as {predictMotion(this:unknown,input:PredictedInput,dt:number,replay?:boolean):void}).predictMotion;
      const prediction=new MovementPrediction(),correction=new PresentationCorrection(),authority=new MissionAuthorityClient('test');
      authority.connection='connected';authority.latest=server.snapshot();
      const commands:{due:number;value:AuthorityInput}[]=[],states:{due:number;state:AuthoritySnapshot}[]=[];
      let now=0,nextFrame=0,lastFrame=0,nextServer=0,lastServer=0,accumulator=0,serverDebt=0,frameIndex=0,packetIndex=0;
      let lastCommandDue=0,lastStateDue=0,lastSnapshot=-100,latest:AuthoritySnapshot|null=null,ack=-1;
      let maxError=0,maxCorrection=0,minSpeed=Infinity,maxSpeed=0,backwards=0,previousX=8,inputTick=0;
      const previous=server.body.position.clone(),render=previous.clone();
      Object.assign(authority,{socket:{emit(event:string,value:AuthorityInput){if(event==='mission:input'){
        const jitter=scenario.jitter?[0,25,10,35][packetIndex++%4]:0;
        lastCommandDue=Math.max(lastCommandDue,now+scenario.rtt/2+jitter);commands.push({due:lastCommandDue,value});
      }}}});
      const clock=vi.spyOn(performance,'now').mockImplementation(()=>now);
      try{
        for(now=0;now<=4000;now+=5){
          if(now>=nextServer){
            // Deliver ordered TCP packets when the server event loop resumes.
            while(commands[0]?.due<=now)server.input(commands.shift()!.value);
            let budget=simulationBudget(serverDebt,(now-lastServer)/1000,1/60);lastServer=now;
            do{
              expect(budget.interrupted).toBe(false);expect(budget.steps).toBeLessThanOrEqual(6);
              for(let i=0;i<budget.steps;i++)server.step();serverDebt=budget.remaining;
              budget=simulationBudget(serverDebt,0,1/60);
            }while(budget.steps);
            if(now-lastSnapshot>=100){lastStateDue=Math.max(lastStateDue,now+scenario.rtt/2+(scenario.jitter?now%35:0));
              states.push({due:lastStateDue,state:server.snapshot()});lastSnapshot=now;}
            nextServer=now+(scenario.serverStalls&&now%1000===500?250:50);
          }
          while(states[0]?.due<=now){latest=states.shift()!.state;authority.latest=latest;}
          if(now+1e-6<nextFrame)continue;
          const dt=(now-lastFrame)/1000;lastFrame=now;
          if(latest){
            const state=latest;latest=null;const before=client.body.position.clone();
            const through=state.prediction.stream.ack;
            if(through!==null){expect(through).toBeGreaterThanOrEqual(ack);ack=through;}
            prediction.reconcile(state,()=>{client.body.position.fromArray(state.position);client.body.vertical=state.vertical;
              client.body.grounded=state.grounded;client.body.jumpTime=state.prediction.jumpTime;client.controller.restoreMotion(state.prediction.controller);
              if(scenario.driving)Object.assign(client.vehicles.current!,state.cars[28]);
            },input=>advance.call(client,input,1/60,true));
            maxCorrection=Math.max(maxCorrection,before.distanceTo(client.body.position));
            previous.add(client.body.position).sub(before);correction.correct(before,client.body.position);
          }
          accumulator+=dt;
          while(accumulator+1e-9>=1/60){
            inputTick++;
            const turning=scenario.turns&&now>=1500&&now<2500;
            const stopped=scenario.actions&&inputTick>=150&&inputTick<180;
            const cmd=prediction.record({...emptyCommand(),x:turning||stopped?0:1,y:turning?1:0,sprint,dodge:!!scenario.actions&&inputTick===120,
              aim:[100,1,8],jump:!!scenario.actions&&inputTick===60,jumpHeld:!!scenario.actions&&inputTick>=60&&inputTick<75,highJump:false,touchRepeat:false,throttle:scenario.driving?1:0,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0});
            authority.submit(cmd);previous.copy(client.body.position);advance.call(client,cmd,1/60);advance.call(reference,cmd,1/60);
            accumulator=Math.max(0,accumulator-1/60);
          }
          authority.flushMovement();
          maxError=Math.max(maxError,client.body.position.distanceTo(reference.body.position));
          render.copy(previous).lerp(client.body.position,Math.min(1,accumulator*60));correction.present(render,dt,render);
          if(now>1000&&dt>0){const speed=(render.x-previousX)/dt;minSpeed=Math.min(minSpeed,speed);maxSpeed=Math.max(maxSpeed,speed);if(speed<-.00001)backwards++;}
          previousX=render.x;
          nextFrame+=scenario.irregular?[1000/60,50,125,1000/60,50][frameIndex++%5]:1000/scenario.fps;
        }
        expect(maxError).toBeLessThan(.001);expect(maxCorrection).toBeLessThan(.001);
        // The existing evasive dodge intentionally steps backward; it must
        // match the reference exactly, rather than count as a network rewind.
        if(!scenario.actions)expect(backwards).toBe(0);
        else{expect(client.controller.dodgeSerial).toBe(1);expect(server.controller.dodgeSerial).toBe(1);}
        expect(prediction.size).toBeLessThanOrEqual(120);
        if(!scenario.turns&&!scenario.wall&&!scenario.actions&&!scenario.driving){const speed=5.875*(sprint?1.55:1);expect(minSpeed).toBeCloseTo(speed,5);expect(maxSpeed).toBeCloseTo(speed,5);}
        expect(server.firearmShots).toBe(0);expect(client.controller.health).toBe(100);
        expect(server.controller.health).toBe(100);
      }finally{clock.mockRestore();}
    },15000);
  }
});
