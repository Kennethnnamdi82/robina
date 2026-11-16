import {beforeEach,describe,it,expect} from 'vitest';
import {Box3,Ray,Vector3} from 'three';
import {CameraRig,POVS} from './CameraRig';
import {PresentationCorrection} from './PresentationCorrection';
import {aimNearDistance} from './CameraAim';
import {FieldItems,grenadeTarget} from './FieldItems';
import {CitySimulation,TRAFFIC_COUNT,carActive} from './CitySimulation';
import {createAssignmentOperation} from './Operations';
import {WorldState} from '../world/WorldState';
import {convertSolids} from './world3d';
import {moveKinematic} from './physics3d';
beforeEach(()=>localStorage.clear());
describe('camera and street polish',()=>{
  it.each(POVS)('keeps shooting orientation stable while translating in %s',pov=>{
    const rig=new CameraRig();rig.setPOV(pov);rig.resize(1280,720);const p=new Vector3();
    const motion={vx:4,vz:0,sprinting:false,combat:true,manual:false,vehicle:null};
    for(let i=0;i<120;i++)rig.update(p,[],1/60,false,0,undefined,motion);
    const direction=rig.camera.getWorldDirection(new Vector3());
    for(let i=0;i<120;i++){p.x+=4/60;rig.update(p,[],1/60,false,0,undefined,motion);expect(rig.camera.getWorldDirection(new Vector3()).distanceTo(direction)).toBeLessThan(1e-6);}
  });
  it('responds to manual orbit immediately without waiting for another simulation tick',()=>{
    const rig=new CameraRig();rig.setPOV('first');rig.update(new Vector3(),[],1,true);
    const before=rig.camera.quaternion.clone();rig.rotate(35,-12);expect(before.angleTo(rig.camera.quaternion)).toBeGreaterThan(.05);
  });
  it('does not snap the vehicle camera when the boom raises at close cover',()=>{
    const rig=new CameraRig();rig.setPOV('third');const p=new Vector3();
    const motion={vx:0,vz:0,sprinting:false,combat:false,manual:false,vehicle:{id:0,heading:0,speed:0,length:4}};
    for(let i=0;i<120;i++)rig.update(p,[],1/60,false,0,undefined,motion);
    const before=rig.camera.quaternion.clone();rig.update(p,[{id:'close-cover',enabled:true,kind:'wall',box:new Box3(new Vector3(-2,0,.35),new Vector3(2,4,3))}],1/60,false,0,undefined,motion);
    expect(before.angleTo(rig.camera.quaternion)).toBeLessThan(.45);
  });
  it('eases reconciliation visually without changing the authoritative position',()=>{
    const correction=new PresentationCorrection(),before=new Vector3(0,0,0),authoritative=new Vector3(2,0,0),out=new Vector3();
    correction.correct(before,authoritative);correction.present(authoritative,1/60,out);expect(out.x).toBeGreaterThan(0);expect(out.x).toBeLessThan(.5);expect(authoritative.x).toBe(2);
    for(let i=0;i<120;i++)correction.present(authoritative,1/60,out);expect(out.x).toBeCloseTo(2,4);
  });
  it('does not choose a shoulder-camera hit behind the player as a firing target',()=>{
    const ray=new Ray(new Vector3(0,1.5,3),new Vector3(0,0,-1));const near=aimNearDistance(ray,new Vector3());
    expect(near).toBeGreaterThan(3);expect(ray.at(near,new Vector3()).z).toBeLessThan(0);
  });
  it.each([0,Math.PI/2,Math.PI,-Math.PI/2])('throws forward at facing %s even if the camera target is behind',angle=>{
    const point=new Vector3(8,0,8),behind=point.clone().add(new Vector3(-Math.cos(angle)*12,1,-Math.sin(angle)*12));
    const field=new FieldItems();expect(field.throw(point,grenadeTarget(point,behind,angle,false),true)).toBe(true);
    const v=field.bombs[0].velocity;expect(v.x*Math.cos(angle)+v.z*Math.sin(angle)).toBeGreaterThan(11);
    expect(field.quantity).toBe(2);
  });
  it('respects an explicit grenade aiming direction',()=>{
    const target=grenadeTarget(new Vector3(),new Vector3(0,1,-12),0,true);expect(target.z).toBe(-12);expect(target.x).toBe(0);
  });
  it('halves live traffic without changing saved vehicle identities or hiding active pursuit cars',()=>{
    const city=new CitySimulation(42);expect(city.cars.length).toBe(28);expect(city.cars.filter(c=>carActive(c,TRAFFIC_COUNT)).length).toBe(14);
    city.cars[20].mode='pursuit';expect(carActive(city.cars[20],TRAFFIC_COUNT)).toBe(true);
  });
  it('leaves the outer avenue mouths physically open rather than invisible end walls',()=>{
    const operation=createAssignmentOperation(0,42),solids=convertSolids(new WorldState(operation.level));
    for(const x of [8,32,56,80]){const body={position:new Vector3(x,0,3),vertical:0,grounded:true};for(let i=0;i<80;i++)moveKinematic(body,0,-.08,1/60,solids);expect(body.position.z).toBeLessThan(-1);}
  });
});
