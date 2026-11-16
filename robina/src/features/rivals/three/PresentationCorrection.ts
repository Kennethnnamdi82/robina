import {Vector3} from 'three';
/** Hide reconciliation discontinuities, never move the authoritative body. */
export class PresentationCorrection {
  private offset=new Vector3();
  correct(before:Vector3,after:Vector3,reset=false){
    if(reset||before.distanceToSquared(after)>64){this.offset.set(0,0,0);return;}
    this.offset.add(before).sub(after);
    this.offset.clampLength(0,4);
  }
  present(position:Vector3,dt:number,out:Vector3){
    this.offset.multiplyScalar(Math.exp(-14*Math.max(0,Math.min(dt,.1))));
    if(this.offset.lengthSq()<1e-8)this.offset.set(0,0,0);
    return out.copy(position).add(this.offset);
  }
}
