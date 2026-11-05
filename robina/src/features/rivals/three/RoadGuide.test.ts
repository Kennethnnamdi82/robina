import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {RoadGuide,roadGuidePoints,routeBearing} from './RoadGuide';
import {aimStickResponse,drivingStick} from './stickResponse';
import {vehicleFinish} from './VehicleFinish';
import {finishOperative} from './OperativeFinish';
import {CameraRig} from './CameraRig';

describe('visible road guidance and analog controls',()=>{
  it('follows the route around a corner instead of crossing the building',()=>{
    const points=roadGuidePoints({x:0,y:0},[{x:0,y:400},{x:400,y:400}]);
    expect(points.length).toBeGreaterThan(8);
    for(const p of points){expect(p.x===0||Math.abs(p.z-10)<.001).toBe(true);expect(Number.isFinite(p.yaw)).toBe(true);}
    expect(points[0].yaw).toBe(0);expect(points.at(-1)!.yaw).toBeCloseTo(Math.PI/2);
  });
  it('bounds the geometry and removes guidance when there is no destination',()=>{
    const guide=new RoadGuide();guide.update(new T.Vector3(),[{x:0,y:100000}],{x:0,y:100000},0,true);
    expect(guide.count).toBe(56);expect(guide.root.visible).toBe(true);
    expect((guide.root.children[0] as T.InstancedMesh).material).toMatchObject({depthTest:true,depthWrite:false,transparent:true});
    guide.update(new T.Vector3(),[],undefined,0);expect(guide.root.visible).toBe(false);expect(guide.count).toBe(0);guide.dispose();
  });
  it('gives correct relative bearings as the camera turns',()=>{
    const camera=new T.PerspectiveCamera();camera.lookAt(0,0,-1);camera.updateMatrixWorld();
    expect(routeBearing(new T.Vector3(),{x:0,y:-400},camera)).toBeCloseTo(0);
    expect(routeBearing(new T.Vector3(),{x:400,y:0},camera)).toBeCloseTo(Math.PI/2);
    camera.lookAt(1,0,0);camera.updateMatrixWorld();expect(routeBearing(new T.Vector3(),{x:400,y:0},camera)).toBeCloseTo(0);
  });
  it('retains fine aiming near the centre without lag or excessive speed at the rim',()=>{
    expect(aimStickResponse(0)).toBe(0);expect(aimStickResponse(.1)).toBeGreaterThan(0);expect(aimStickResponse(.1)).toBeLessThan(.05);
    expect(aimStickResponse(1)).toBe(1);expect(aimStickResponse(-1)).toBe(-1);expect(aimStickResponse(Infinity)).toBe(0);
    expect(drivingStick({x:.4,y:-.8})).toEqual({steer:.4,throttle:.8});expect(drivingStick({x:-.5,y:.7})).toEqual({steer:-.5,throttle:-.7});
  });
  it('refreshes aim orientation without moving or redamping the camera',()=>{
    const rig=new CameraRig();rig.setPOV('third');rig.resize(844,390);rig.update(new T.Vector3(),[],1/60);
    const before=rig.camera.position.clone(),rotation=rig.camera.quaternion.clone();rig.rotate(30,0);rig.refreshLook();
    expect(rig.camera.position.equals(before)).toBe(true);expect(rig.camera.quaternion.angleTo(rotation)).toBeGreaterThan(.01);
  });
  it('adds clear coat only to paint and preserves the supplied source materials',()=>{
    const source=new T.MeshStandardMaterial({roughness:.5,metalness:.2});source.userData.trafficPaint=true;
    const paint=vehicleFinish(source);expect(paint).toBeInstanceOf(T.MeshPhysicalMaterial);expect((paint as T.MeshPhysicalMaterial).clearcoat).toBe(.95);expect(paint.defines).toHaveProperty('PHYSICAL');expect(source.roughness).toBe(.5);
    const glassSource=new T.MeshStandardMaterial();glassSource.name='premium-glass';const glass=vehicleFinish(glassSource);expect(glass.roughness).toBe(.09);expect(glassSource.roughness).toBe(1);
    source.dispose();paint.dispose();glassSource.dispose();glass.dispose();
  });
  it('keeps operative skin maps and geometry while replacing the blue vertex tint',()=>{
    const root=new T.Group(),map=new T.Texture(),original=new T.MeshStandardMaterial({map,vertexColors:true}),geometry=new T.BoxGeometry(),mesh=new T.Mesh(geometry,original);mesh.name='SuperHero_Male';root.add(mesh);
    finishOperative(root);expect(mesh.geometry).toBe(geometry);expect(mesh.material.map).toBe(map);expect(mesh.material.vertexColors).toBe(false);expect(mesh.material).not.toBe(original);
    geometry.dispose();original.dispose();mesh.material.dispose();map.dispose();
  });
});
