import * as T from 'three';
/** Refinish the existing supplied rig, not the controller or animation clips.
 * Rest-space masks keep fabric on clothes and preserve textured face/hands. */
export function finishOperative(root:T.Object3D) {
  root.traverse(node=>{
    if(!(node instanceof T.Mesh)||node.name!=='SuperHero_Male')return;
    const original=node.material as T.MeshStandardMaterial,material=original.clone();
    material.vertexColors=false;material.color.set(0xffffff);material.roughness=.82;material.metalness=0;
    material.normalScale.set(.65,.65);material.envMapIntensity=.7;
    material.customProgramCacheKey=()=>'rivals-field-fabric-v1';
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFieldRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFieldRest=position;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFieldRest;').replace('#include <color_fragment>',`#include <color_fragment>
        float torso=step(.88,vFieldRest.y)*(1.-step(1.49,vFieldRest.y));
        float pants=step(.16,vFieldRest.y)*(1.-step(.88,vFieldRest.y));
        float boots=1.-step(.16,vFieldRest.y);
        vec3 cloth=mix(vec3(.065,.078,.071),vec3(.16,.185,.13),torso);
        float vest=torso*(1.-step(.235,abs(vFieldRest.x)));
        cloth=mix(cloth,vec3(.07,.085,.077),vest);
        float strap=1.-smoothstep(.014,.025,abs(abs(vFieldRest.x)-.145));
        cloth=mix(cloth,vec3(.26,.27,.20),strap*torso);
        float belt=(1.-smoothstep(.018,.032,abs(vFieldRest.y-.9)))*(1.-step(.24,abs(vFieldRest.x)));
        cloth=mix(cloth,vec3(.028,.032,.027),belt);
        float aa=1.-smoothstep(.001,.005,fwidth(vFieldRest.x)+fwidth(vFieldRest.y));
        cloth*=1.+sin(vFieldRest.x*1250.)*sin(vFieldRest.y*1250.)*.035*aa;
        diffuseColor.rgb=mix(diffuseColor.rgb,cloth,max(torso,pants));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.025,.029,.031),boots);
      `);
    };
    node.material=material;
    original.dispose();
  });
}
