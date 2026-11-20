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

  update(clip:string,phase:number,window:readonly [number,number]|undefined){
    if(!window||phase<=window[0]||phase>=window[1]){
      this.clip='';
      return;
    }
    const foot=this.ik.hand;
    foot.getWorldPosition(this.position);
    if(this.clip!==clip||phase<this.priorPhase)this.anchor.copy(this.position);
    this.clip=clip;this.priorPhase=phase;
    const blend=MathUtils.smoothstep(phase,window[0],window[0]+.035)*(1-MathUtils.smoothstep(phase,window[1]-.035,window[1]));
    // Keep the correction small so retargeted outfits and uneven terrain
    // can release the stance naturally instead of overextending a knee.
    this.offset.subVectors(this.anchor,this.position).clampLength(0,.17).multiplyScalar(blend);
    if(this.offset.lengthSq()<1e-8)return;
    this.bones.forEach((bone,i)=>this.pose[i].copy(bone.quaternion));
    this.corrected=true;
    this.ik.lower.getWorldPosition(this.pole);
    foot.getWorldQuaternion(this.footRotation);
    this.ik.solve(this.position.add(this.offset),this.pole);
    setWorldRotation(foot,this.footRotation,this.scratch);
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
  update(clip:string,phase:number,eligible:boolean){
    const intervals=eligible?stance[clip]:undefined;
    this.legs.forEach((leg,i)=>leg?.update(clip,phase,intervals?.[i]));
  }
}
