import {Vector3} from 'three';
import {traceSolids} from './physics3d';
import type {Solid3D} from './world3d';

export const SOLDIER_GRIP=[-.16,1.32,.21] as const;
// Metres from the prepared GLBs. Paid weapons reuse these calibrated shells.
export const MUZZLE_GEOMETRY={
  rifle:[0,.10123006076384625,-.5725729590171362],
  smg:[0,.07224083477718347,-.3238315513406589],
  pistol:[0,.1457557651849453,-.24446964151431294],
} as const;
const delta=new Vector3(),forward=new Vector3(),right=new Vector3(),up=new Vector3(),grip=new Vector3(),anchor=new Vector3(),muzzle=new Vector3(),worldUp=new Vector3(0,1,0);

/** The same cover sweep is used by presentation and trusted simulation. */
export function safeMuzzleOrigin(start:Vector3,end:Vector3,solids:readonly Solid3D[],out:Vector3){
  delta.subVectors(end,start);const length=delta.length();if(length<1e-6){out.copy(start);return false;}
  delta.divideScalar(length);const clear=traceSolids(start,delta,solids,length,.045);
  out.copy(start).addScaledVector(delta,Math.max(0,clear-(clear<length?.005:0)));return clear<length;
}
/** No browser-supplied origins: derive the physical bore from server position,
 * calibrated equipment and accepted aim, then stop it at any intervening wall. */
export function authoritativeMuzzle(position:Vector3,target:Vector3,kind:keyof typeof MUZZLE_GEOMETRY,solids:readonly Solid3D[],out:Vector3){
  forward.subVectors(target,position).setY(0);if(forward.lengthSq()<1e-6)forward.set(0,0,-1);forward.normalize();
  right.crossVectors(forward,worldUp).normalize();grip.copy(position).addScaledVector(right,-SOLDIER_GRIP[0]).addScaledVector(forward,SOLDIER_GRIP[2]);grip.y+=SOLDIER_GRIP[1];
  forward.subVectors(target,grip).normalize();up.crossVectors(right,forward).normalize();const offset=MUZZLE_GEOMETRY[kind];
  muzzle.copy(grip).addScaledVector(forward,-offset[2]).addScaledVector(up,offset[1]);anchor.copy(position);anchor.y+=1.23;
  return safeMuzzleOrigin(anchor,muzzle,solids,out);
}
