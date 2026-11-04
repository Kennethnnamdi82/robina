import * as T from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { HumanSource } from './CityPeople';

const joints=[['pelvis','Pelvis'],['thigh_l','Leg_L'],['calf_l','Knee_L'],['thigh_r','Leg_R'],['calf_r','Knee_R']] as const;
/** Transfer the player's authored leg timing to the existing security rigs.
 * World-rest retargeting preserves their proportions and original body assets.
 * Horizontal translation remains exclusively owned by the navigation model. */
export function securityGaits(source:HumanSource,target:T.Object3D):T.AnimationClip[]{
 const human=clone(source.scene),rig=target.clone(true);human.updateMatrixWorld(true);rig.updateMatrixWorld(true);
 const pairs=joints.map(([a,b])=>{const from=human.getObjectByName(a),to=rig.getObjectByName(b);if(!from||!to)throw new Error('Security gait joint missing: '+b);return{from,to,inverse:from.getWorldQuaternion(new T.Quaternion()).invert(),rest:to.getWorldQuaternion(new T.Quaternion()),position:to.position.clone()};});
 const sourceHeight=pairs[0].from.getWorldPosition(new T.Vector3()).y,targetHeight=pairs[0].to.getWorldPosition(new T.Vector3()).y,scale=targetHeight/sourceHeight;
 const mixer=new T.AnimationMixer(human),alignment=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI),inverseAlignment=alignment.clone().invert(),world=new T.Quaternion(),inverse=new T.Quaternion(),delta=new T.Vector3();
 return ['Idle_Loop','Walk_Loop','Jog_Fwd_Loop'].map((name,index)=>{
  const sourceClip=source.animations.find(c=>c.name===name);if(!sourceClip)throw new Error('Missing security source gait '+name);
  const action=mixer.clipAction(sourceClip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const samples=Math.ceil(sourceClip.duration*30),times:number[]=[],values=pairs.map(()=>[] as number[]),positions:number[]=[];
  for(let frame=0;frame<=samples;frame++){
   const time=Math.min(sourceClip.duration,frame/30);times.push(time);mixer.setTime(time);human.updateMatrixWorld(true);
   delta.set(0,(pairs[0].from.getWorldPosition(new T.Vector3()).y-sourceHeight)*scale,0);
   delta.applyQuaternion(pairs[0].to.parent!.getWorldQuaternion(inverse).invert());pairs[0].to.position.copy(pairs[0].position).add(delta);
   for(const [i,pair]of pairs.entries()){
    pair.from.getWorldQuaternion(world).multiply(pair.inverse);world.premultiply(alignment).multiply(inverseAlignment).multiply(pair.rest);
    pair.to.parent!.getWorldQuaternion(inverse).invert();pair.to.quaternion.copy(inverse.multiply(world)).normalize();pair.to.updateMatrixWorld(true);
    const q=pair.to.quaternion,v=values[i],sign=v.length&&q.x*v[v.length-4]+q.y*v[v.length-3]+q.z*v[v.length-2]+q.w*v[v.length-1]<0?-1:1;v.push(q.x*sign,q.y*sign,q.z*sign,q.w*sign);
   }
   positions.push(...pairs[0].to.position.toArray());
  }
  action.stop();const tracks:T.KeyframeTrack[]=pairs.map((p,i)=>new T.QuaternionKeyframeTrack(p.to.name+'.quaternion',times,values[i]));tracks.push(new T.VectorKeyframeTrack('Pelvis.position',times,positions));
  return new T.AnimationClip(['Human_Idle','Human_Walk','Human_Run'][index],sourceClip.duration,tracks).optimize();
 });
}
