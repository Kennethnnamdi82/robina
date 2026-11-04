import {Euler,MathUtils,PerspectiveCamera,Quaternion,type Camera} from 'three';

/** Critically damped, render-only recoil. No random displacement, aim drift or
 * cumulative camera rotation. Restore before sampling gameplay rays. */
export class CameraFeedback {
 private pitch=0;private pitchVelocity=0;private yaw=0;private yawVelocity=0;private roll=0;private rollVelocity=0;
 private base=new Quaternion();private rotation=new Quaternion();private euler=new Euler(0,0,0,'YXZ');
 private applied?:Camera;private fov=0;private speed=0;private clock=0;private serial=0;
 fire(ads=false,strength=1){
  const gain=(ads?.48:1)*strength;this.pitchVelocity=Math.min(.95,this.pitchVelocity+.58*gain);
  this.yawVelocity+=((this.serial++%2)?-.065:.065)*gain;this.rollVelocity+=((this.serial%2)?-.08:.08)*gain;
 }
 restore(){if(!this.applied)return;this.applied.quaternion.copy(this.base);if(this.applied instanceof PerspectiveCamera){this.applied.fov=this.fov;this.applied.updateProjectionMatrix();}this.applied.updateMatrixWorld();this.applied=undefined;}
 update(dt:number,enabled:boolean,speed:number,ads:boolean){
  if(!enabled){this.clear();return;}dt=MathUtils.clamp(dt,0,.1);this.clock+=dt;this.speed=MathUtils.damp(this.speed,Math.min(1,speed/6),10,dt);
  const spring=(x:number,v:number,w:number)=>{const b=v+w*x,e=Math.exp(-w*dt);return[(x+b*dt)*e,(v-w*b*dt)*e];};
  [this.pitch,this.pitchVelocity]=spring(this.pitch,this.pitchVelocity,25);
  [this.yaw,this.yawVelocity]=spring(this.yaw,this.yawVelocity,22);
  [this.roll,this.rollVelocity]=spring(this.roll,this.rollVelocity,24);
  this.ads=ads;
 }
 private ads=false;
 apply(camera:Camera){
  this.restore();this.applied=camera;this.base.copy(camera.quaternion);
  const stride=this.speed*(this.ads?.12:1),sway=Math.sin(this.clock*11)*stride*.0009;
  this.euler.set(this.pitch+sway,this.yaw,this.roll+Math.sin(this.clock*5.5)*stride*.0014);this.rotation.setFromEuler(this.euler);camera.quaternion.multiply(this.rotation);
  if(camera instanceof PerspectiveCamera){this.fov=camera.fov;camera.fov+=this.speed*(this.ads?0:1.5)+Math.abs(this.pitch)*22;camera.updateProjectionMatrix();}camera.updateMatrixWorld();
 }
 clear(){this.pitch=this.pitchVelocity=this.yaw=this.yawVelocity=this.roll=this.rollVelocity=this.speed=0;}
 get snapshot(){return{pitch:this.pitch,yaw:this.yaw,roll:this.roll,shots:this.serial};}
}
