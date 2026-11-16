import {Vector3} from 'three';
/** Hide reconciliation discontinuities, never move the authoritative body. */
export class PresentationCorrection {
  private offset=new Vector3();
  private previous=new Vector3();private recovery=new Vector3();private movement=new Vector3();private initialized=false;
  correct(before:Vector3,after:Vector3,reset=false){
    if(reset||before.distanceToSquared(after)>64){this.offset.set(0,0,0);this.initialized=false;return;}
    // Remove the rewind itself from the next frame's intentional displacement.
    if(this.initialized)this.previous.add(after).sub(before);
    this.offset.add(before).sub(after);
    this.offset.clampLength(0,4);
  }
  present(position:Vector3,dt:number,out:Vector3){
    this.recovery.copy(this.offset).multiplyScalar(1-Math.exp(-14*Math.max(0,Math.min(dt,.1))));
    if(this.initialized){
      this.movement.subVectors(position,this.previous).setY(0);
      const distance=this.movement.length();
      if(distance>1e-5){
        this.movement.divideScalar(distance);
        const opposing=this.recovery.dot(this.movement);
        // Settling network error must not reverse a deliberate walking/driving
        // step. Sideways/vertical corrections and stopping still converge.
        if(opposing>distance*.5)this.recovery.addScaledVector(this.movement,distance*.5-opposing);
      }
    }
    this.previous.copy(position);this.initialized=true;
    this.offset.sub(this.recovery);
    if(this.offset.lengthSq()<1e-8)this.offset.set(0,0,0);
    return out.copy(position).add(this.offset);
  }
}

/** Presentation only: physical steering and server collision checks are unchanged. */
export class HeadingCorrection {
  private offset=0;
  correct(before:number,after:number,reset=false){this.offset=reset?0:Math.atan2(Math.sin(this.offset+before-after),Math.cos(this.offset+before-after));}
  present(yaw:number,dt:number){this.offset*=Math.exp(-12*Math.max(0,Math.min(dt,.1)));return yaw+this.offset;}
}
