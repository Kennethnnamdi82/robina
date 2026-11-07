import {describe,it,expect} from 'vitest';
import {PerspectiveCamera} from 'three';
import {CameraFeedback} from './CameraFeedback';
import {AdaptiveResolution} from './AdaptiveResolution';
describe('controlled shooting camera',()=>{
 it('produces a bounded impulse, recovers smoothly and never changes base aim',()=>{
  const feedback=new CameraFeedback(),camera=new PerspectiveCamera(62);camera.rotation.set(.1,.7,0);const base=camera.quaternion.clone();feedback.fire();feedback.update(1/60,true,0,false);expect(feedback.snapshot.pitch).toBeGreaterThan(.0001);expect(feedback.snapshot.pitch).toBeLessThanOrEqual(.0016);
  feedback.apply(camera);expect(camera.quaternion.angleTo(base)).toBeGreaterThan(.0001);feedback.restore();expect(camera.quaternion.angleTo(base)).toBeLessThan(1e-7);expect(camera.fov).toBe(62);
  for(let i=0;i<120;i++)feedback.update(1/60,true,0,false);expect(Math.abs(feedback.snapshot.pitch)).toBeLessThan(.00001);
 });
 it('has equal recovery at 30 and 120 FPS, less ADS motion and no reduced-motion kick',()=>{
  const a=new CameraFeedback(),b=new CameraFeedback(),ads=new CameraFeedback();a.fire();b.fire();ads.fire(true);
  for(let i=0;i<6;i++)a.update(1/30,true,0,false);for(let i=0;i<24;i++)b.update(1/120,true,0,false);for(let i=0;i<6;i++)ads.update(1/30,true,0,true);
  expect(a.snapshot.pitch).toBeCloseTo(b.snapshot.pitch,8);expect(ads.snapshot.pitch).toBeLessThan(a.snapshot.pitch*.5);a.update(1/60,false,6,false);expect(a.snapshot.pitch).toBe(0);
 });
 it('freezes recoil while paused and restores FOV and orientation exactly',()=>{
  const f=new CameraFeedback(),c=new PerspectiveCamera(72);f.fire();f.update(.02,true,3,false);const before=f.snapshot;f.update(0,true,3,false);expect(f.snapshot).toEqual(before);f.apply(c);expect(c.fov).toBe(72);f.restore();expect(c.fov).toBe(72);
 });
 it.each([30,60,120])('sustained fire at %s FPS cannot add sideways shake, zoom pumping or aim drift',fps=>{
  for(const ads of [false,true]){
   const f=new CameraFeedback(),c=new PerspectiveCamera(62);c.rotation.set(.3,-.7,0);const base=c.quaternion.clone(),position=c.position.clone();
   for(let i=0;i<fps*10;i++){
    f.restore();if(i%Math.max(1,Math.round(fps*.07))===0)f.fire(ads,1.1);
    f.update(1/fps,true,9,ads);f.apply(c);
    expect(c.quaternion.angleTo(base)).toBeLessThanOrEqual((ads?.00065:.0016)+1e-6);
    expect(f.snapshot.yaw).toBe(0);expect(f.snapshot.roll).toBe(0);expect(c.fov).toBe(62);expect(c.position.equals(position)).toBe(true);
   }
   f.update(1/fps,false,9,ads);expect(c.quaternion.angleTo(base)).toBeLessThan(1e-7);
  }
 });
});
describe('adaptive pixel budget',()=>{
 it('also recovers when active frames are catastrophically slow',()=>{const b=new AdaptiveResolution(1,1);b.sample(3);expect(b.scale).toBe(1);b.sample(3);expect(b.scale).toBe(.75);b.sample(2);b.sample(2);expect(b.scale).toBe(.65);});
 it('reduces sustained GPU workload quickly and recovers only after a healthy interval',()=>{
  const budget=new AdaptiveResolution(1,1);for(let i=0;i<76;i++)budget.sample(1/25);expect(budget.scale).toBeLessThan(1);const reduced=budget.scale;
  for(let i=0;i<100;i++)budget.sample(1/60);expect(budget.scale).toBe(reduced);for(let i=0;i<650;i++)budget.sample(1/60);expect(budget.scale).toBeGreaterThan(reduced);expect(budget.scale).toBeLessThanOrEqual(1);
 });
 it('ignores suspension, invalid samples and isolated hitches',()=>{const b=new AdaptiveResolution(1,1);for(let i=0;i<120;i++)b.sample(i===50?.12:1/60);b.sample(20);b.sample(NaN);expect(b.scale).toBe(1);});
});
