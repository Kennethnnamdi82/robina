import { beforeEach, describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { CameraRig, POVS } from './CameraRig';
import { angleDelta, type CameraMotion } from './SmartCameraFollow';
import type { Solid3D } from './world3d';
import { directionalDriving } from './VehicleController';

const origin = new Vector3();
const motion = (): CameraMotion => ({ vx: 0, vz: 0, sprinting: false, combat: false, manual: false, vehicle: null });
const rig = () => { const r = new CameraRig(); r.setPOV('third'); r.resize(1280,720); r.update(origin,[],0,true); return r; };
const tick = (r: CameraRig, m: CameraMotion, seconds = 3, fps = 60, solids: Solid3D[] = []) => {
  for (let i = 0; i < Math.round(seconds * fps); i++) r.update(origin,solids,1/fps,false,0,undefined,m);
};
beforeEach(() => localStorage.clear());

describe('smart locomotion camera', () => {
  it('follows travel behind the operative and settles instead of spinning on a held sideways gesture', () => {
    const r = rig(), m = motion();
    for (let i = 0; i < 600; i++) {
      const move = r.movement(1,0,true); m.vx = move.x * 4; m.vz = move.y * 4;
      r.update(origin,[],1/60,false,0,undefined,m);
      expect(move.x).toBeCloseTo(1); expect(move.y).toBeCloseTo(0);
    }
    expect(angleDelta(r.yaw,-Math.PI/2)).toBeCloseTo(0,4);
    const settled = r.yaw; m.vx = m.vz = 0; tick(r,m);
    expect(r.yaw).toBeCloseTo(settled,4);
    r.movement(0,0,true);
    expect(r.movement(0,-1,true).x).toBeCloseTo(1,3);
  });
  it.each([30,60,120])('tracks a sudden 180-degree turn without a one-frame snap at %s FPS', fps => {
    const r = rig(), m = motion(); m.vz = 4;
    let before = r.yaw;
    for (let i=0;i<fps*4;i++) {
      r.update(origin,[],1/fps,false,0,undefined,m);
      expect(Math.abs(angleDelta(before,r.yaw))).toBeLessThanOrEqual(2.4/fps+1e-8); before = r.yaw;
    }
    expect(Math.abs(angleDelta(r.yaw,Math.PI))).toBeLessThan(.001);
  });
  it('uses comparable damping at 30 and 120 FPS', () => {
    const a = rig(), b = rig(), m = motion(); m.vx = 4;
    tick(a,m,2,30); tick(b,m,2,120);
    expect(Math.abs(angleDelta(a.yaw,b.yaw))).toBeLessThan(.015);
    expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThan(.08);
  });
  it('widens sprint framing subtly and restores the walking frame after stopping', () => {
    const r=rig(), m=motion(), before=r.camera.position.distanceTo(origin); m.vz=-6; m.sprinting=true; tick(r,m);
    expect(r.perspective.fov).toBeGreaterThan(60); expect(r.perspective.fov).toBeLessThanOrEqual(61);
    expect(r.camera.position.distanceTo(origin)).toBeGreaterThan(before+.3);
    m.vz=0; m.sprinting=false; tick(r,m);
    expect(r.perspective.fov).toBeCloseTo(57,3);
  });
  it('allows manual orbit immediately, holds it, then recenters when travelling', () => {
    const r=rig(), m=motion(); m.vx=4; r.rotate(100,0); const manual=r.yaw;
    tick(r,m,2); expect(r.yaw).toBeCloseTo(manual);
    tick(r,m,3); expect(Math.abs(angleDelta(r.yaw,-Math.PI/2))).toBeLessThan(.005);
    m.manual=true; const held=r.yaw; m.vz=4; tick(r,m,4); expect(r.yaw).toBe(held);
  });
  it('never auto-rotates first person, even while sprinting sideways', () => {
    const r=rig(), m=motion(); r.setPOV('first'); r.yaw=.4; m.vx=6; m.sprinting=true;
    tick(r,m); expect(r.yaw).toBe(.4); expect(r.perspective.fov).toBeCloseTo(72);
    expect(r.camera.position.y).toBeCloseTo(1.62);
  });
  it('gives shooting, right-stick aim, reload and weapon changes priority over automatic yaw', () => {
    const r=rig(), m=motion(); m.vx=5; m.combat=true; tick(r,m,5);
    expect(r.yaw).toBe(0); expect(r.perspective.fov).toBe(57);
    expect(r.movement(1,0,true)).toEqual({x:1,y:0});
    m.combat=false; tick(r,m,.5); expect(r.yaw).toBe(0);
    tick(r,m,3); expect(Math.abs(angleDelta(r.yaw,-Math.PI/2))).toBeLessThan(.01);
    r.ads=true; const yaw=r.yaw; m.vz=5; tick(r,m,2);
    expect(r.yaw).toBe(yaw); expect(r.perspective.fov).toBe(49);
  });
  it('does not steer the aim ray when the shoulder camera lags behind a strafing operative', () => {
    const r=rig(), m=motion(), direction=new Vector3(), position=new Vector3();m.combat=true;m.vx=4;
    r.camera.getWorldDirection(direction);const initial=direction.clone();
    for(let i=0;i<120;i++){
      position.x+=4/60;r.update(position,[],1/60,false,0,undefined,m);
      r.camera.getWorldDirection(direction);expect(direction.distanceTo(initial)).toBeLessThan(1e-7);
    }
  });
  it('freezes follow timers during pause without inventing a manual-look gesture', () => {
    const r=rig(),m=motion();m.vx=4;m.paused=true;tick(r,m,3);expect(r.yaw).toBe(0);
    m.paused=false;tick(r,m,.3);expect(r.yaw).toBeLessThan(-.2);
    r.rotate(100,0);const manual=r.yaw;m.paused=true;tick(r,m,10);
    m.paused=false;tick(r,m,2);expect(r.yaw).toBe(manual);
  });
});

describe('vehicle framing and four-POV transitions', () => {
  it('adapts chase distance/FOV to speed and does not permanently replace the selected first-person POV', () => {
    const r=rig(), m=motion(); r.setPOV('first'); r.setZoom(1.4); tick(r,m);
    m.vehicle={id:3,heading:0,speed:0,length:4.1}; tick(r,m);
    const stopped=r.camera.position.distanceTo(origin); expect(r.pov).toBe('first');
    expect(stopped).toBeGreaterThan(4);
    m.vehicle.speed=20; tick(r,m); expect(r.perspective.fov).toBeGreaterThan(65);
    expect(r.camera.position.distanceTo(origin)).toBeGreaterThan(stopped+1);
    m.vehicle=null; tick(r,m); expect(r.pov).toBe('first'); expect(r.zoom.first).toBe(1.4);
    expect(r.camera.position.distanceTo(new Vector3(0,1.62,0))).toBeLessThan(.001);
    expect(r.perspective.fov).toBeCloseTo(72/1.4);
  });
  it('does not overshoot FOV during same-projection vehicle transitions or show the head from inside it', () => {
    const r=rig(),m=motion();m.vehicle={id:7,heading:0,speed:0,length:4.1};
    for(let i=0;i<90;i++){r.update(origin,[],1/60,false,0,undefined,m);expect(r.perspective.fov).toBeGreaterThanOrEqual(57);expect(r.perspective.fov).toBeLessThanOrEqual(59);}
    m.vehicle=null;r.setPOV('first');tick(r,m,2);expect(r.bodyVisible).toBe(false);
    r.setPOV('third');r.update(origin,[],0,false,0,undefined,m);expect(r.bodyVisible).toBe(false);
    tick(r,m,2);expect(r.bodyVisible).toBe(true);
  });
  it('holds reverse visibility through braking, without switching sides at near-zero speed', () => {
    const r=rig(), m=motion(); m.vehicle={id:4,heading:0,speed:5,length:4}; tick(r,m);
    m.vehicle.speed=-3; tick(r,m,4); expect(Math.abs(angleDelta(r.yaw,Math.PI))).toBeLessThan(.005);
    const reversing=r.yaw;
    for(const speed of [0,-.2,.2,-.3,0]) {m.vehicle.speed=speed; tick(r,m,.3);}
    expect(Math.abs(angleDelta(r.yaw,reversing))).toBeLessThan(.005);
    m.vehicle.speed=5; tick(r,m,4); expect(Math.abs(angleDelta(r.yaw,0))).toBeLessThan(.005);
  });
  it('keeps a held directional steering command stable while the chase camera turns', () => {
    const r=rig(), m=motion(); m.vehicle={id:5,heading:0,speed:10,length:4}; tick(r,m);
    const first=r.drivingYaw(1,0); m.vehicle.heading=-Math.PI/2;
    tick(r,m); const next=r.drivingYaw(1,0);
    const direction=r.camera.getWorldDirection(new Vector3());
    expect(Math.abs(angleDelta(Math.atan2(-direction.x,-direction.z),r.yaw))).toBeLessThan(.03);
    expect(next).toBe(first);
    const a=directionalDriving({throttle:0,steer:0,brake:false,stickX:1,stickY:0,cameraYaw:first});
    const b=directionalDriving({throttle:0,steer:0,brake:false,stickX:1,stickY:0,cameraYaw:next});
    expect(a.heading).toBe(b.heading);
    r.drivingYaw(0,0); expect(r.drivingYaw(0,-1)).toBeCloseTo(r.yaw);
  });
  it('preserves all POVs and each zoom while entering, switching modes and exiting a vehicle', () => {
    const r=rig(), m=motion();
    for(const pov of POVS) {
      r.setPOV(pov); r.setZoom(1.4); tick(r,m,1);
      m.vehicle={id:6,heading:.8,speed:8,length:7}; tick(r,m,1);
      expect(r.pov).toBe(pov); expect(r.zoom[pov]).toBe(1.4);
      m.vehicle=null; tick(r,m,1); expect(r.pov).toBe(pov);
      expect(r.camera.position.toArray().every(Number.isFinite)).toBe(true);
    }
  });
  it('blends camera poses instead of teleporting directly to each new mode', () => {
    const r=rig(), m=motion();
    for(const pov of ['tactical','side','third','first'] as const) {
      const before=r.camera.position.clone(); r.setPOV(pov);
      expect(r.camera.position.distanceTo(before)).toBeLessThan(1e-7);
      r.update(origin,[],1/60,false,0,undefined,m);
      expect(r.camera.position.toArray().every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(r.perspective.fov)).toBe(true); tick(r,m,2);
    }
  });
  it('draws the exact transition endpoint before an idle renderer stops drawing', () => {
    const r=rig(),m=motion();m.paused=true;
    for(const pov of ['tactical','side','first','third'] as const){
      r.setPOV(pov);let frames=0;
      while(r.settling&&frames++<100)r.update(origin,[],.2,false,0,undefined,m);
      expect(frames).toBeLessThan(100);expect(r.settling).toBe(false);
      if(pov==='first')expect(r.perspective.fov).toBe(72);
      if(pov==='third')expect(r.perspective.fov).toBe(57);
    }
  });
});

describe('collision-safe camera damping', () => {
  const wall=():Solid3D=>({id:'wall',kind:'wall',enabled:true,box:new Box3(new Vector3(-5,0,1),new Vector3(5,6,2))});
  it('constrains the lagged eye immediately when a wall appears, then restores distance gradually', () => {
    const r=rig(), m=motion(), solid=wall(), original=solid.box.clone();
    r.update(origin,[solid],1/120,false,0,undefined,m);
    expect(solid.box.clone().expandByScalar(.17).containsPoint(r.camera.position)).toBe(false);
    expect(r.camera.position.z).toBeLessThan(.83);
    for(let i=0;i<120;i++)r.update(origin,[solid],1/60,false,0,undefined,m);
    const blocked=r.camera.position.clone(); r.update(origin,[],1/120,false,0,undefined,m);
    expect(r.camera.position.distanceTo(blocked)).toBeLessThan(.3);
    tick(r,m,3); expect(r.camera.position.z).toBeGreaterThan(2.9);
    expect(solid.box.equals(original)).toBe(true);
  });
  it('skips only the occupied vehicle collider, while neighboring vehicles still block the boom', () => {
    const r=rig(), m=motion(), solid=wall(); m.vehicle={id:4,heading:0,speed:0,length:4}; solid.id='city-traffic-4';
    tick(r,m,3,60,[solid]); expect(r.camera.position.z).toBeGreaterThan(4);
    solid.id='city-traffic-5'; tick(r,m,2,60,[solid]); expect(r.camera.position.z).toBeLessThan(.83);
    expect(r.camera.position.y).toBeGreaterThan(3);
    const roof=new Vector3(0,1.6,0).project(r.camera);expect(Math.abs(roof.y)).toBeLessThan(1);
  });
  it('handles rotated and disabled walls, low ceilings, frame hitches and extreme manual angles without NaNs or ground clipping', () => {
    const r=rig(), m=motion(), solid=wall(); solid.oriented={center:new Vector3(0,2,2),half:new Vector3(3,2,.2),yaw:Math.PI/4};
    const ceiling:Solid3D={id:'ceiling',kind:'wall',enabled:true,box:new Box3(new Vector3(-3,2,-3),new Vector3(3,2.2,3))};
    for(let i=0;i<240;i++) {
      r.rotate(20,i%20<10?-100:100); solid.enabled=i%7!==0;
      r.update(origin,[solid,ceiling],[1/120,1/30,.18,NaN,-1][i%5],false,0,undefined,m);
      expect(r.camera.position.y).toBeGreaterThanOrEqual(.42);
      expect(r.camera.position.toArray().every(Number.isFinite)).toBe(true);
    }
  });
});
