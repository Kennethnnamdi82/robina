import {beforeEach,describe,expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {CameraRig,POVS} from './CameraRig';
import {CharacterController,MOVEMENT} from '../characters/CharacterController';
import {emptyCommand} from '../input/InputBuffer';
import {frameTiming} from './frameTiming';
import {moveKinematic,nearbyMovementSolids} from './physics3d';
import type {Solid3D} from './world3d';
import {METRES} from './world3d';

beforeEach(()=>localStorage.clear());
describe('uninterrupted locomotion and manual views',()=>{
  it.each(POVS)('tracks the character without trailing or steering in %s',pov=>{
    const rig=new CameraRig(),position=new Vector3(8,0,8);rig.setPOV(pov);rig.resize(844,390);
    rig.update(position,[],0,true);const eye=rig.camera.position.clone(),start=position.clone();
    const motion={vx:0,vz:0,sprinting:false,combat:false,manual:false,vehicle:null};
    for(let i=0;i<240;i++){
      const dt=[1/120,1/60,1/30,.1][i%4];position.x+=5*dt;position.z-=2*dt;
      motion.vx=5;motion.vz=-2;motion.sprinting=i%2===0;motion.combat=i%3===0;
      rig.update(position,[],dt,false,0,{x:i%2?1:-1,y:-1},motion);
      expect(rig.camera.position.clone().sub(eye).distanceTo(position.clone().sub(start))).toBeLessThan(1e-6);
      expect(rig.yaw).toBe(0);expect(rig.perspective.fov).toBe(pov==='first'?72:57);
    }
  });
  it.each([15,30,60,120])('continues sprinting under repeated nonlethal fire at %s FPS',fps=>{
    const controller=new CharacterController(true),body={position:new Vector3(8,0,8),vertical:0,grounded:true};
    const input={...emptyCommand(),x:1,sprint:true},rig=new CameraRig();rig.setPOV('third');rig.update(body.position,[],0,true);
    let accumulator=0;const start=body.position.x;
    for(let frame=0;frame<fps*2;frame++){
      if(frame%Math.max(1,Math.round(fps/4))===0)controller.damage(1);
      const {delta,step}=frameTiming(1/fps);accumulator+=delta;
      while(accumulator+1e-9>=step){controller.step(input,step);moveKinematic(body,controller.vx*METRES*step,0,step,[]);accumulator-=step;}
      rig.update(body.position,[],delta,false,0,undefined,{vx:controller.vx*METRES,vz:0,sprinting:controller.sprinting,combat:true,manual:false,vehicle:null});
      // At 120Hz the first render precedes the first 60Hz physics tick.
      if(frame>0)expect(controller.sprinting).toBe(true);expect(rig.yaw).toBe(0);
    }
    const expected=MOVEMENT.walkSpeed*MOVEMENT.sprintMultiplier*METRES*2;
    expect(body.position.x-start).toBeGreaterThan(expected-.3);expect(body.position.x-start).toBeLessThanOrEqual(expected);
  });
  it('keeps aiming and movement in the same basis before and after releasing combat',()=>{
    const rig=new CameraRig();rig.setPOV('third');rig.yaw=.9;rig.update(new Vector3(),[],0,true);
    const held=rig.movement(0,-1,true),motion={vx:4,vz:0,sprinting:true,combat:true,manual:false,vehicle:null};
    for(let i=0;i<360;i++){motion.combat=i<60;rig.update(new Vector3(),[],1/60,false,0,undefined,motion);expect(rig.movement(0,-1,true)).toEqual(held);}
    rig.rotate(40,0);expect(rig.movement(0,-1,true)).not.toEqual(held);
  });
  it('honours manual aiming immediately during a POV blend',()=>{
    const rig=new CameraRig();rig.update(new Vector3(),[],0,true);rig.setPOV('first');rig.rotate(50,-10);
    const motion={vx:0,vz:0,sprinting:false,combat:true,manual:true,vehicle:null};
    rig.update(new Vector3(),[],1/60,false,0,undefined,motion);
    const direction=rig.camera.getWorldDirection(new Vector3());
    expect(Math.atan2(-direction.x,-direction.z)).toBeCloseTo(rig.yaw,6);
  });
});

describe('local movement collision workload',()=>{
  const wall=(id:string,x:number,z:number):Solid3D=>({id,enabled:true,kind:'cover',box:new Box3(new Vector3(x,0,z),new Vector3(x+1,2,z+1))});
  it('reuses one query buffer and excludes distant and disabled solids, not nearby people or vehicles',()=>{
    const far=Array.from({length:2000},(_,i)=>wall('far-'+i,50+i*2,50)),near=wall('city-traffic-1',1,0),person=wall('person',-1,0),disabled={...wall('disabled',0,0),enabled:false};
    const output:Solid3D[]=[];
    expect(nearbyMovementSolids(new Vector3(),[...far,near,disabled],[person],output)).toBe(output);
    expect(output).toEqual([near,person]);
    nearbyMovementSolids(new Vector3(20,0,20),[near],[person],output);expect(output).toEqual([]);
  });
  it('preserves movement and wall collision results compared with the complete solid list',()=>{
    const solids=[wall('near',1.3,-.5),...Array.from({length:100},(_,i)=>wall('distant-'+i,20+i*2,30))],out:Solid3D[]=[];
    const full={position:new Vector3(),vertical:0,grounded:true},filtered={position:new Vector3(),vertical:0,grounded:true};
    for(let i=0;i<90;i++){
      moveKinematic(full,.1,0,1/60,solids);
      moveKinematic(filtered,.1,0,1/60,nearbyMovementSolids(filtered.position,solids,[],out));
      expect(filtered.position.distanceTo(full.position)).toBeLessThan(1e-8);
    }
    expect(filtered.position.x).toBeLessThan(1);
  });
});
