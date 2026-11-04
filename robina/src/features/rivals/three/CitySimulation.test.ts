import { describe,it,expect } from 'vitest';
import { CitySimulation,sampleRoute } from './CitySimulation';
import { buildingAt,cityPlan,trafficPhase,STREET_CENTRES } from './LivingCityPlan';
import { createOperation } from './Operations';
import { WorldState } from '../world/WorldState';
import { convertSolids } from './world3d';
import { Vector3 } from 'three';
import { moveKinematic } from './physics3d';

describe('playable outdoor city',()=>{
  it('uses the same reproducible buildings for art, navigation and tall collision',()=>{
    for(let seed=0;seed<9;seed++) {
      const plan=cityPlan(seed%3,seed),op=createOperation(seed),world=new WorldState(op.level),solids=convertSolids(world);
      expect(solids.some(s=>s.id.startsWith('dev-step')||s.id==='dev-platform')).toBe(false);
      expect(plan).toEqual(cityPlan(seed%3,seed));expect(op.level.width*1.6).toBe(96);
      expect(buildingAt(plan,7.2,7.2)).toBeUndefined();
      for(const b of plan.buildings.filter(b=>b.x>2&&b.z>2&&b.x<90&&b.z<90)) {
        const collision=solids.find(s=>s.box.containsPoint(new Vector3(b.x,.5,b.z)));expect(collision?.box.max.y).toBeCloseTo(b.height);
        const actor={position:new Vector3(b.x-b.width/2-1,0,b.z),vertical:0,grounded:true};
        moveKinematic(actor,5,0,1/60,solids);expect(actor.position.x).toBeLessThan(b.x-b.width/2);
      }
    }
  });
  it('never allows conflicting greens and protects pedestrian crossing time',()=>{
    for(let t=0;t<102;t+=.1){const s=trafficPhase(t);expect(s.x==='green'&&s.z==='green').toBe(false);if(s.crossing)expect([s.x,s.z]).toEqual(['red','red']);}
  });
  it('keeps old utility props and the east relay out of the live traffic lanes',()=>{
    const level=createOperation(0).level;
    for(const p of level.props.filter(p=>p.solid&&!p.id.includes('console')&&p.id!=='vault'))for(const centre of STREET_CENTRES){expect(Math.abs(p.x*.025-centre)).toBeGreaterThanOrEqual(6.39);expect(Math.abs(p.y*.025-centre)).toBeGreaterThanOrEqual(6.39);}
    const relay=level.objects.find(o=>o.id==='relay-b')!;expect(Math.abs(relay.y*.025-8)).toBeGreaterThan(6);
  });
  it('moves a mixed fleet on asphalt and keeps its route outside every building',()=>{
    const sim=new CitySimulation(42),plan=cityPlan(0,42);
    expect(new Set(sim.cars.map(c=>c.kind)).size).toBe(8);
    for(const c of sim.cars)for(let distance=0;distance<c.total;distance+=.25){const p=sampleRoute(c,distance);expect(buildingAt(plan,p.x,p.z)).toBeUndefined();}
    for(let i=0;i<60*90;i++)sim.step(1/60);
    expect(sim.stats.travelled).toBeGreaterThan(300);expect(sim.stats.stops).toBeGreaterThan(5);
    expect(sim.cars.every(c=>Number.isFinite(c.x+c.z+c.speed))).toBe(true);
  });
  it('holds a car at a red stop line then releases it on green',()=>{
    const sim=new CitySimulation(2,1),car=sim.cars[0];
    // Find the eastbound approach, before its first right turn at x=32.
    for(let d=0;d<car.total;d+=.01){const p=sampleRoute(car,d);if(p.dx>.99&&Math.abs(p.x-20)<.01){car.distance=d;Object.assign(car,p);break;}}
    sim.time=16;for(let i=0;i<120;i++)sim.step(1/60);
    expect(car.x+car.length/2).toBeLessThanOrEqual(32-6.1+.03);
    const stoppedAt=car.distance;sim.time=34;for(let i=0;i<180;i++)sim.step(1/60);expect(car.distance).toBeGreaterThan(stoppedAt+1);
  });
  it('keeps traffic circulating through repeated signal cycles with actual mission furniture',()=>{
    const world=new WorldState(createOperation(0).level),sim=new CitySimulation(0,18);
    const obstacles=world.blockers.filter(b=>!b.id.startsWith('wall-')&&!['transit-door','vault-gate'].includes(b.id)).map(b=>({x:b.x*.025,z:b.y*.025}));
    for(let i=0;i<90*30;i++)sim.step(1/30,obstacles,18);
    for(const car of sim.cars)expect(car.travelled,car.kind+' '+car.id).toBeGreaterThan(25);
  });
  it('brakes for a person in its lane',()=>{
    const sim=new CitySimulation(3,1),car=sim.cars[0];sim.time=0;
    for(let d=0;d<car.total;d+=.01){const p=sampleRoute(car,d);if(p.dx>.99&&Math.abs(p.x-16)<.01){car.distance=d;Object.assign(car,p);break;}}
    const obstacle={x:21,z:car.z};for(let i=0;i<200;i++)sim.step(1/60,[obstacle]);
    expect(car.x+car.length/2).toBeLessThan(obstacle.x-1);
  });
});
