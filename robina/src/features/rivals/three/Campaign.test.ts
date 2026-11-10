import { describe,it,expect,vi } from 'vitest';
import { Box3,Vector3 } from 'three';
import { ASSIGNMENTS,assignmentMission } from '../missions/assignments';
import { MissionEngine } from '../missions/MissionEngine';
import { createAssignmentOperation,nextOperation } from './Operations';
import { WorldState } from '../world/WorldState';
import { NavigationGrid } from '../ai/navigation';
import { addAssignmentWalls } from './AssignmentSite';
import { convertSolids } from './world3d';
import { CitySimulation } from './CitySimulation';
import { VehicleController,addParkedVehicles,driveVehicle,vehicleOverlap } from './VehicleController';
import { PolicePursuit } from './PolicePursuit';
import { CampaignGameplay } from './CampaignGameplay';
import { moveKinematic } from './physics3d';
function setup(index=0){const operation=createAssignmentOperation(index,43),world=new WorldState(operation.level);addAssignmentWalls(world,ASSIGNMENTS[index]);const solids=convertSolids(world),grid=new NavigationGrid(world.level.width*2,world.level.height*2,32,world.blockers),traffic=new CitySimulation(44);addParkedVehicles(traffic.cars);const vehicles=new VehicleController(traffic.cars),deploy=vi.fn(),police=new PolicePursuit(traffic.cars,grid,solids,ASSIGNMENTS[index].response,deploy),mission=new MissionEngine(operation.mission,'campaign-test-'+index);mission.prepare();mission.start();const game=new CampaignGameplay(index,mission,world,vehicles,police,grid);return{operation,world,solids,grid,vehicles,deploy,police,mission,game};}
function finishTasks(s:ReturnType<typeof setup>){
  const a=ASSIGNMENTS[s.operation.assignment!];
  s.game.step(.1,new Vector3(a.site.x,0,a.site.z+5),0);
  for(let i=0;i<a.tasks.length;i++){
    const object=s.world.level.objects.find(o=>o.id==='task-'+i)!;
    const at=new Vector3(object.x*.025,0,object.y*.025);
    if(a.convoy){const car=s.vehicles.cars[3];s.vehicles.current=car;car.mode='player';s.game.step(.1,new Vector3(car.x,0,car.z),0);}
    else{
      expect(s.game.interact(at)).toBe(true);
      if(a.holdTask===i){expect(s.mission.completed.has('task-'+i)).toBe(false);for(let tick=0;tick<(a.holdSeconds??12)*2+2;tick++)s.game.step(.5,at,0);}
    }
    expect(s.mission.completed.has('task-'+i)).toBe(true);
  }
  s.grid.rebuild();
}
describe('continuous 3D campaign',()=>{
  it('gives seven named contracts increasing security and distinct insertion points',()=>{
    expect(ASSIGNMENTS).toHaveLength(7);expect(new Set(ASSIGNMENTS.map(a=>a.name)).size).toBe(7);
    expect(new Set(ASSIGNMENTS.map(a=>JSON.stringify(a.entry))).size).toBe(7);
    for(let i=1;i<ASSIGNMENTS.length;i++){expect(ASSIGNMENTS[i].security).toBeGreaterThan(ASSIGNMENTS[i-1].security);expect(ASSIGNMENTS[i].response).toBeGreaterThanOrEqual(ASSIGNMENTS[i-1].response);}
    for(const a of ASSIGNMENTS){const mission=assignmentMission(a);expect(mission.timer.seconds).toBeNull();expect(mission.success).toEqual(['extract']);}
  });
  it.each(ASSIGNMENTS.map((a,i)=>[a.id,i] as const))('%s has reachable devices and extraction after its access requirements',(_,index)=>{
    const s=setup(index),vault=s.world.blockers.find(b=>b.id==='mission-vault-door');if(vault)vault.enabled=false;s.grid.rebuild();
    for(const objective of s.operation.mission.objectives){const route=s.grid.path(s.world.level.spawn,objective.marker);expect(route.length,objective.id).toBeGreaterThan(0);expect(Math.hypot(route.at(-1)!.x-objective.marker.x,route.at(-1)!.y-objective.marker.y),objective.id).toBeLessThan(110);}
    if(ASSIGNMENTS[index].convoy)expect(s.solids.filter(s=>s.id.startsWith('mission-wall-'))).toHaveLength(0);
  });
  it('keeps the bank vault physically closed until the drill finishes, and pauses the drill when leaving',()=>{
    const s=setup(),a=ASSIGNMENTS[0],door=s.world.blockers.find(b=>b.id==='mission-vault-door')!;
    s.game.step(.1,new Vector3(a.site.x,0,a.site.z+5),3);
    const key=s.world.level.objects.find(o=>o.id==='task-0')!,drill=s.world.level.objects.find(o=>o.id==='task-1')!;
    expect(s.game.interact(new Vector3(key.x*.025,0,key.y*.025))).toBe(true);
    const at=new Vector3(drill.x*.025,0,drill.y*.025);expect(s.game.interact(at)).toBe(true);
    s.game.step(2,at,3);const progress=s.game.holdProgress;expect(progress).toBeGreaterThan(0);expect(door.enabled).toBe(true);
    s.game.step(5,new Vector3(8,0,8),3);expect(s.game.holdProgress).toBe(progress);
    for(let i=0;i<30;i++)s.game.step(.5,at,3);
    expect(door.enabled).toBe(false);expect(s.mission.snapshot().activeId).toBe('recover');
    expect(s.game.carrying).toBe(false);
  });
  it('allows bypassing an access panel while guards are alive instead of requiring every kill',()=>{
    const s=setup(1),a=ASSIGNMENTS[1];s.game.step(.1,new Vector3(a.site.x,0,a.site.z+5),4);
    expect(s.mission.snapshot().activeId).toBe('security');const panel=s.world.level.objects.find(o=>o.id==='site-secured')!;
    expect(s.game.interact(new Vector3(panel.x*.025,0,panel.y*.025))).toBe(true);expect(s.mission.snapshot().activeId).toBe('task-0');
  });
  it('killing guards alone never completes a mission or grants the objective',()=>{const s=setup(),p=new Vector3(44,0,24);s.game.step(.1,p,0);expect(s.mission.state).toBe('ACTIVE');expect(s.game.carrying).toBe(false);s.game.interact(new Vector3(136,0,32));expect(s.mission.state).toBe('ACTIVE');});
  it.each(ASSIGNMENTS.map((a,i)=>[a.id,i] as const))('%s completes its full task, transport/escort, evasion and extraction sequence',(_,index)=>{
    const s=setup(index),a=ASSIGNMENTS[index];finishTasks(s);
    const recovery=s.world.level.objects.find(o=>o.id==='cargo-recovered')!,at=new Vector3(recovery.x*.025,0,recovery.y*.025);
    expect(s.game.interact(at)).toBe(true);expect(s.game.carrying).toBe(true);
    if(a.vehicleDelivery&&!a.convoy){s.vehicles.current=s.vehicles.cars[29];s.game.step(.1,at,0);}
    if(a.hostage){s.vehicles.current=s.vehicles.cars[28];s.game.step(.1,at,0);expect(s.game.witnessBoarded).toBe(true);}
    const extraction=new Vector3(a.extraction.x,0,a.extraction.z);s.game.step(.1,extraction,0);s.game.interact(extraction);expect(s.mission.state).toBe('ACTIVE');
    s.police.end();s.police.lost=true;s.game.step(.1,extraction,0);expect(s.game.interact(extraction)).toBe(true);expect(s.mission.state).toBe('SUCCESS');
  });
  it('does not intercept a convoy by pressing interact without commandeering it',()=>{const index=ASSIGNMENTS.findIndex(a=>a.convoy),s=setup(index),a=ASSIGNMENTS[index],car=s.vehicles.cars[3];s.game.step(.1,new Vector3(a.site.x,0,a.site.z+5),0);s.game.interact(new Vector3(car.x,0,car.z));expect(s.mission.completed.has('task-0')).toBe(false);});
  it('retries the same assignment/seed and advances only after success',()=>{const op=createAssignmentOperation(4,79);expect(nextOperation(op).assignment).toBe(4);expect(nextOperation(op).seed).toBe(op.seed);expect(nextOperation(op).fingerprint).toBe(op.fingerprint);expect(nextOperation(op,true).assignment).toBe(5);const s=setup();s.game.carrying=true;s.mission.fail('down');s.game.interact(new Vector3(136,0,32));expect(s.mission.state).toBe('FAILED');});
  it('dispatches real traffic vehicles and deploys officers through the existing NPC adapter',()=>{const s=setup(),car=s.vehicles.cars.find(c=>c.kind==='police')!;s.police.alert();s.police.step(.1,{x:car.x*40,y:car.z*40},[]);expect(car.mode).toBe('pursuit');expect(s.deploy).toHaveBeenCalledTimes(2);});
  it('does not lose contact while an officer has a clear nearby sightline',()=>{const s=setup();s.police.alert();for(let i=0;i<100;i++)s.police.step(.1,{x:288,y:288},[{x:300,y:300,alive:true}]);expect(s.police.lost).toBe(false);});
  it('can escape a valuable-cargo pursuit after breaking sight, rather than being tracked forever',()=>{
    const blockers=[{id:'warehouse',x:1200,y:1600,width:80,height:3200,enabled:true}],grid=new NavigationGrid(100,100,40,blockers),police=new PolicePursuit([],grid,[],1,vi.fn());
    police.alert(true);police.step(.1,{x:400,y:400},[{x:440,y:400,alive:true}]);
    for(let i=0;i<180;i++)police.step(.1,{x:2000,y:400},[{x:440,y:400,alive:true}]);
    expect(police.lost).toBe(true);expect(police.active).toBe(false);
  });
});
describe('driving, collision and traversal',()=>{
  it('keeps parked spawn footprints out of live traffic over repeated city seeds',()=>{for(let seed=0;seed<60;seed++){const traffic=new CitySimulation(seed);addParkedVehicles(traffic.cars);for(const parked of traffic.cars.filter(c=>c.mode==='parked')){const solid={id:'parking',kind:'cover' as const,enabled:true,box:new Box3(),oriented:{center:new Vector3(parked.x,1,parked.z),half:new Vector3(['lorry','tanker','bus'].includes(parked.kind)?1.175:.925,1,parked.length/2),yaw:Math.atan2(parked.dx,parked.dz)}};solid.box.setFromCenterAndSize(solid.oriented.center,new Vector3(parked.length,2,2.35));for(const car of traffic.cars.filter(c=>c.mode==='traffic'))expect(vehicleOverlap(car,car.x,car.z,Math.atan2(car.dx,car.dz),solid),`seed ${seed} vehicle ${car.id}`).toBe(false);}}});
  it('enters and exits actual cars, clears their driver and rejects high-speed/blocked exits',()=>{const s=setup(),car=s.vehicles.cars[28],p=new Vector3(car.x,0,car.z+2),eject=vi.fn();car.driver=true;expect(s.vehicles.enter(car,p,[],eject)).toBe(true);expect(eject).toHaveBeenCalledOnce();expect(car.driver).toBe(false);car.speed=9;expect(s.vehicles.exit(p,[])).toBe(false);car.speed=0;expect(s.vehicles.exit(p,[])).toBe(true);expect(car.mode).toBe('parked');});
  it('sweeps the whole vehicle footprint instead of tunnelling through walls',()=>{const s=setup(),car=s.vehicles.cars[28];car.x=8;car.z=8;car.dx=1;car.dz=0;car.speed=19;const wall={id:'test-wall',kind:'wall' as const,enabled:true,box:new Box3(new Vector3(12,0,0),new Vector3(13,4,20))};for(let i=0;i<100;i++)driveVehicle(car,{throttle:1,steer:0,brake:false},1/60,[wall]);expect(car.x+car.length/2).toBeLessThan(12.1);expect(vehicleOverlap(car,car.x,car.z,Math.PI/2,wall)).toBe(false);});
  it('applies distance-based blast damage and disables destroyed vehicles',()=>{const s=setup(),near=s.vehicles.cars[28],far=s.vehicles.cars[29];near.x=near.z=8;far.x=far.z=70;s.vehicles.blast(new Vector3(8,0,8),7,300);expect(near.health).toBe(0);expect(near.mode).toBe('disabled');expect(far.health).toBe(200);expect(s.vehicles.enter(near,new Vector3(8,0,8),[])).toBe(false);});
  it('normal jump lands, while rapid second jump reaches a car roof',()=>{const car={id:'roof',kind:'cover' as const,enabled:true,box:new Box3(new Vector3(1,0,-1),new Vector3(4,1.45,1))};const body={position:new Vector3(0,0,0),vertical:0,grounded:true,jumpTime:0};let high=0;for(let i=0;i<150;i++){moveKinematic(body,i<95?.035:0,0,1/60,[car],i===0||i===10,false,i===10);high=Math.max(high,body.position.y);}expect(high).toBeGreaterThan(1.6);expect(body.grounded).toBe(true);expect(body.position.y).toBeCloseTo(1.45);});
});
