import {MathUtils,Quaternion,Vector3,type Object3D} from 'three';
import {ArmIK,setWorldRotation} from './ArmIK';

// Contact intervals of the shipped in-place clips, indexed left/right.
const stance:Record<string,readonly [readonly [number,number],readonly [number,number]]>={
  Walk_Loop:[[.025,.49],[.525,.99]],
  Jog_Fwd_Loop:[[.025,.18],[.525,.68]],
  Sprint_Loop:[[.07,.22],[.60,.74]],
};

class LegContact {
  private readonly ik:ArmIK;
  private readonly bones:Object3D[];
  private readonly pose=[new Quaternion(),new Quaternion(),new Quaternion()];
  private readonly correction=[new Quaternion(),new Quaternion(),new Quaternion()];
  private readonly goal=new Quaternion();
  private readonly anchor=new Vector3();
  private readonly position=new Vector3();
  private readonly offset=new Vector3();
  private readonly pole=new Vector3();
  private readonly footRotation=new Quaternion();
  private readonly scratch=new Quaternion();
  private clip='';
  private priorPhase=0;
  private corrected=false;

  constructor(thigh:Object3D,calf:Object3D,foot:Object3D){
    this.ik=new ArmIK(thigh,calf,foot);
    this.bones=[thigh,calf,foot];
  }

  restore(){
    if(!this.corrected)return;
    this.bones.forEach((bone,i)=>bone.quaternion.copy(this.pose[i]));
    this.corrected=false;
  }

  update(clip:string,phase:number,window:readonly [number,number]|undefined,weight:number,dt:number){
    this.offset.set(0,0,0);
    if(window&&phase>window[0]&&phase<window[1]&&weight>0){
      const foot=this.ik.hand;
      foot.getWorldPosition(this.position);
      if(this.clip!==clip||phase<this.priorPhase)this.anchor.copy(this.position);
      this.clip=clip;this.priorPhase=phase;
      const blend=weight*MathUtils.smoothstep(phase,window[0],window[0]+.042)*(1-MathUtils.smoothstep(phase,window[1]-.042,window[1]));
      this.offset.subVectors(this.anchor,this.position).clampLength(0,.17).multiplyScalar(blend);
    }else this.clip='';
    const solve=this.offset.lengthSq()>=1e-8;
    if(!solve&&this.correction.every(q=>Math.abs(q.w)>1-1e-8))return;
    this.bones.forEach((bone,i)=>this.pose[i].copy(bone.quaternion));
    if(solve){
      this.ik.lower.getWorldPosition(this.pole);
      this.ik.hand.getWorldQuaternion(this.footRotation);
      this.ik.solve(this.position.add(this.offset),this.pole);
      setWorldRotation(this.ik.hand,this.footRotation,this.scratch);
    }
    // Ease only the additive contact pose. The authored gait still advances
    // at the current stride as the stance starts, ends or reaches full extension.
    const response=1-Math.exp(-26*dt);
    this.bones.forEach((bone,i)=>{
      this.goal.identity();
      if(solve)this.goal.copy(this.pose[i]).invert().multiply(bone.quaternion);
      this.correction[i].slerp(this.goal,response);
      bone.quaternion.copy(this.pose[i]).multiply(this.correction[i]);
    });
    this.corrected=true;
  }
}

export class OperativeFootPlant {
  private readonly legs:(LegContact|undefined)[];
  constructor(body:Object3D){
    this.legs=['l','r'].map(side=>{
      const thigh=body.getObjectByName('thigh_'+side),calf=body.getObjectByName('calf_'+side),foot=body.getObjectByName('foot_'+side);
      return thigh&&calf&&foot?new LegContact(thigh,calf,foot):undefined;
    });
  }
  restore(){this.legs.forEach(leg=>leg?.restore());}
  update(clip:string,phase:number,weight:number,dt:number){
    const intervals=stance[clip];
    this.legs.forEach((leg,i)=>leg?.update(clip,phase,intervals?.[i],weight,dt));
  }
}
