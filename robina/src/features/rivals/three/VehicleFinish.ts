import * as T from 'three';
/** Preserve supplied geometry/material separation; paint gets an automotive
 * clear coat, glass its own reflection, and rubber stays non-metallic. */
export function vehicleFinish(source:T.MeshStandardMaterial) {
  if(source.userData.trafficPaint){
    const paint=new T.MeshPhysicalMaterial();T.MeshStandardMaterial.prototype.copy.call(paint,source);
    paint.defines={STANDARD:'',PHYSICAL:''};
    paint.clearcoat=.95;paint.clearcoatRoughness=.18;paint.roughness=.26;paint.metalness=.5;paint.envMapIntensity=1.15;
    return paint;
  }
  const material=source.clone();
  if(/glass/i.test(source.name)){material.roughness=.09;material.metalness=.45;material.color.set(0x68828d);material.envMapIntensity=1.3;}
  else if(/rubber/i.test(source.name)){material.roughness=.84;material.metalness=.025;}
  return material;
}
