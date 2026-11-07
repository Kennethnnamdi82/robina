import {Euler,MathUtils,Quaternion,type Camera} from 'three';

/** Optional micro-kick; physical gun animation supplies the visible recoil.
 * Never changes yaw, roll or FOV, including sustained automatic fire.
 * Restore before sampling gameplay rays or refreshing the follow rig. */
export class CameraFeedback {
 private pitch=0;private pitchVelocity=0;
 private base=new Quaternion();private rotation=new Quaternion();private euler=new Euler(0,0,0,'YXZ');
 private applied?:Camera;private serial=0;
 fire(ads=false,strength=1){
  this.serial++;
  const gain=(ads?.3:1)*MathUtils.clamp(Number.isFinite(strength)?strength:1,0,1.2);
  this.pitchVelocity=Math.min(.11,this.pitchVelocity+.09*gain);
 }
 restore(){if(!this.applied)return;this.applied.quaternion.copy(this.base);this.applied.updateMatrixWorld();this.applied=undefined;}
 update(dt:number,enabled:boolean,_speed:number,ads:boolean){
  if(!enabled){this.restore();this.clear();return;}dt=MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.1);
  const w=32,b=this.pitchVelocity+w*this.pitch,e=Math.exp(-w*dt);
  this.pitch=(this.pitch+b*dt)*e;this.pitchVelocity=(this.pitchVelocity-w*b*dt)*e;
  this.pitch=MathUtils.clamp(this.pitch,0,ads?.00065:.0016);
  this.ads=ads;
 }
 private ads=false;
 apply(camera:Camera){
  this.restore();this.applied=camera;this.base.copy(camera.quaternion);
  this.euler.set(Math.min(this.pitch,this.ads?.00065:.0016),0,0);this.rotation.setFromEuler(this.euler);camera.quaternion.multiply(this.rotation);camera.updateMatrixWorld();
 }
 clear(){this.pitch=this.pitchVelocity=0;}
 get snapshot(){return{pitch:this.pitch,yaw:0,roll:0,shots:this.serial};}
}
