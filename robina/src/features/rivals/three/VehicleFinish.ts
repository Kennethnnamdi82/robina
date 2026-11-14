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
  else if(/livery/i.test(source.name)){
    material.color.set(0xe5e2d9);material.roughness=.52;material.metalness=.18;material.envMapIntensity=1;
    material.customProgramCacheKey=()=>'rivals-fleet-weathering-v1';
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFleetRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFleetRest=position;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFleetRest;').replace('#include <color_fragment>',`#include <color_fragment>
       float fleetDust=(1.-smoothstep(.18,.95,vFleetRest.y))*.22;
       float fleetGrain=fract(sin(dot(floor(vFleetRest.xz*230.),vec2(12.9898,78.233)))*43758.5453);
       diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.205,.17),fleetDust*(.7+fleetGrain*.3));`);
    };
  }
  return material;
}
