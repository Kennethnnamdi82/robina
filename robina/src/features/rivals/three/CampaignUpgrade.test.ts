import {describe,it,expect,vi} from 'vitest';
import {Box3,Vector3,Matrix4} from 'three';
import {ASSIGNMENTS} from '../missions/assignments';
import {createAssignmentOperation,nextOperation} from './Operations';
import {cityPlan,buildingAt,buildingPlacement} from './LivingCityPlan';
import {campaignDistrict,cityParkPatches} from './CampaignDistrict';
import {WorldState} from '../world/WorldState';
import {addAssignmentWalls} from './AssignmentSite';
import {convertSolids} from './world3d';
import {moveKinematic} from './physics3d';
import {Projectile3D} from './Projectile3D';
import {CitySimulation} from './CitySimulation';
import {addParkedVehicles} from './VehicleController';

describe('campaign geography and combat upgrade',()=>{
  it('gives each stage its own district silhouette, insertion and accessible mission lot',()=>{
    const styles=new Set(),signatures=new Set(),entries=new Set();
    for(let i=0;i<7;i++){
      const op=createAssignmentOperation(i,321),plan=cityPlan(op.venue,op.seed),next=nextOperation(op,true),a=ASSIGNMENTS[i];
      styles.add(campaignDistrict(op.seed).style);signatures.add(plan.signature);entries.add(JSON.stringify(op.level.spawn));
      expect(buildingAt(plan,a.site.x,a.site.z)).toBeUndefined();expect(next.mission.name).not.toBe(op.mission.name);expect(next.fingerprint).not.toBe(op.fingerprint);
    }
    expect(styles.size).toBe(7);expect(signatures.size).toBe(7);expect(entries.size).toBe(7);
  });
  it('walks through the bank lobby and side passage but cannot enter a locked vault',()=>{
    const op=createAssignmentOperation(0,321),world=new WorldState(op.level);addAssignmentWalls(world,ASSIGNMENTS[0]);const solids=convertSolids(world);
    const traffic=new CitySimulation(321);addParkedVehicles(traffic.cars);const van=traffic.cars[29];solids.push({id:'parked-bank-van',kind:'cover',enabled:true,box:new Box3(new Vector3(van.x-van.length/2,0,van.z-.925),new Vector3(van.x+van.length/2,2.5,van.z+.925))});
    const body={position:new Vector3(44,0,28),vertical:0,grounded:true};
    for(let i=0;i<140;i++)moveKinematic(body,0,-.1,1/60,solids);
    expect(body.position.z).toBeLessThan(20);expect(body.position.z).toBeGreaterThan(16.8);
    const door=solids.find(s=>s.id==='mission-vault-door')!;door.enabled=false;
    for(let i=0;i<13;i++)moveKinematic(body,0,-.1,1/60,solids);expect(body.position.z).toBeLessThan(16.5);
    body.position.set(44,0,20.4);for(let i=0;i<90;i++)moveKinematic(body,.1,0,1/60,solids);expect(body.position.x).toBeGreaterThan(51);
  });
  it('keeps rectangular building art aligned with collision and park scenery out of occupied interiors',()=>{
    for(let i=0;i<7;i++){
      const op=createAssignmentOperation(i,321),plan=cityPlan(op.venue,op.seed),site=ASSIGNMENTS[i].site;
      expect(cityParkPatches(op.seed).some(p=>p.x===site.x&&p.z===site.z)).toBe(false);
      for(const b of plan.buildings){const p=buildingPlacement(b),bounds=new Box3(new Vector3(-p.width/2,0,-p.depth/2),new Vector3(p.width/2,p.height,p.depth/2));bounds.applyMatrix4(new Matrix4().makeRotationY(p.yaw));const size=bounds.getSize(new Vector3());expect(size.x).toBeCloseTo(b.width);expect(size.z).toBeCloseTo(b.depth);}
    }
  });
  it('rewards precise head-height hits while ordinary body hits retain weapon damage',()=>{
    const damage=vi.fn((event:{amount:number})=>event.amount),target={id:'guard',team:'security' as const,box:new Box3(new Vector3(3,0,-.4),new Vector3(4,1.8,.4)),alive:()=>true,damage,headshotMultiplier:1.75};
    const pool=new Projectile3D();pool.fire(new Vector3(0,1.65,0),new Vector3(1,0,0),50,1,20,20,'operative','operative');pool.step(.1,[],[target],()=>{});
    expect(damage.mock.calls[0][0].amount).toBe(35);pool.fire(new Vector3(0,.9,0),new Vector3(1,0,0),50,1,20,20,'operative','operative');pool.step(.1,[],[target],()=>{});expect(damage.mock.calls[1][0].amount).toBe(20);
  });
});
