import * as T from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { Civilian } from './CityCrowd';
import { crowdGeometry } from './CityHumanGeometry';
import type { QualityId } from '../core/presentation';

export interface HumanSource { scene:T.Group; animations:T.AnimationClip[] }
const FRAMES=32;
/** Bake the authored skeleton, not vertex poses: one small shared bone texture
 * drives every civilian in three instanced draws. Each person has their own
 * stride phase and blends walking/running without modifying the player rig. */
export class CityPeople {
  readonly root=new T.Group();
  private atlas:T.DataTexture;
  private batches:{mesh:T.InstancedMesh;local:T.Matrix4;pose:T.InstancedBufferAttribute;tint:T.InstancedBufferAttribute;dense:T.BufferGeometry;light:T.BufferGeometry;normal:T.Texture|null;roughness:T.Texture|null}[]=[];
  private transform=new T.Object3D();private matrix=new T.Matrix4();
  private frustum=new T.Frustum();private view=new T.Matrix4();private sphere=new T.Sphere(new T.Vector3(),1.25);rendered=0;
  private palettes=[0x345e78,0x92705c,0x8b4940,0xb7b2a2,0x4a6253,0x585166,0x353c44].map(c=>new T.Color(c));
  constructor(source:HumanSource){
    const model=clone(source.scene) as T.Group;
    model.getObjectByName('Operative-vis-or')?.removeFromParent();
    const skins:T.SkinnedMesh[]=[];model.traverse(n=>{if(n instanceof T.SkinnedMesh)skins.push(n);});
    if(!skins.length)throw new Error('City civilians require the authored humanoid skeleton.');
    const skeleton=skins[0].skeleton,bones=skeleton.bones.length,width=bones*4,data=new Float32Array(width*FRAMES*3*4);
    const mixer=new T.AnimationMixer(model);
    for(const [clipIndex,name]of ['Idle_Loop','Walk_Loop','Jog_Fwd_Loop'].entries()){
      const clip=source.animations.find(c=>c.name===name);if(!clip)throw new Error('Missing civilian gait '+name);
      const action=mixer.clipAction(clip).play();
      for(let frame=0;frame<FRAMES;frame++){
        mixer.setTime(clip.duration*frame/FRAMES);model.updateMatrixWorld(true);skeleton.update();
        data.set(skeleton.boneMatrices,(clipIndex*FRAMES+frame)*bones*16);
      }
      action.stop();
    }
    mixer.stopAllAction();mixer.uncacheRoot(model);model.updateMatrixWorld(true);
    this.atlas=new T.DataTexture(data,width,FRAMES*3,T.RGBAFormat,T.FloatType);this.atlas.needsUpdate=true;
    this.atlas.minFilter=this.atlas.magFilter=T.NearestFilter;this.atlas.generateMipmaps=false;
    for(const skin of skins){
      const geometry=crowdGeometry(skin.geometry,skin.getWorldScale(new T.Vector3())),dense=skin.geometry.clone(),pose=new T.InstancedBufferAttribute(new Float32Array(48*4),4),tint=new T.InstancedBufferAttribute(new Float32Array(48*3),3);
      if(skin.name==='SuperHero_Male'){
        for(const g of [geometry,dense]){const positions=g.getAttribute('position');
        for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);if(y>.90&&y<1.46&&Math.abs(x)<.23&&z>0){const loose=.115*Math.sqrt(Math.max(0,1-(x/.27)**2));positions.setZ(i,Math.max(z,loose));}}
        g.computeVertexNormals();}
      }
      pose.setUsage(T.DynamicDrawUsage);for(const g of [geometry,dense]){g.setAttribute('cityPose',pose);g.setAttribute('cityTint',tint);}
      const original=(Array.isArray(skin.material)?skin.material[0]:skin.material) as T.MeshStandardMaterial,material=original.clone();
      material.vertexColors=false;material.roughness=skin.name==='Eyes'?.2:.8;material.metalness=0;material.normalScale.set(.65,.65);material.envMapIntensity=.65;
      material.customProgramCacheKey=()=>'city-authored-bone-atlas-v3-'+skin.name;
      material.onBeforeCompile=shader=>{
        shader.uniforms.cityBones={value:this.atlas};shader.uniforms.cityBoneSize={value:new T.Vector2(width,FRAMES*3)};
        shader.uniforms.cityBind={value:skin.bindMatrix.clone()};shader.uniforms.cityBindInverse={value:skin.bindMatrixInverse.clone()};
        shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
          attribute vec4 skinIndex;attribute vec4 skinWeight;attribute vec4 cityPose;attribute vec3 cityTint;
          uniform sampler2D cityBones;uniform vec2 cityBoneSize;uniform mat4 cityBind;uniform mat4 cityBindInverse;
          varying vec3 vCityTint;varying vec3 vCityRest;varying float vCityStyle;
          mat4 cityBone(float bone,float frame){float x=bone*4.;float y=(frame+.5)/cityBoneSize.y;
            return mat4(texture2D(cityBones,vec2((x+.5)/cityBoneSize.x,y)),texture2D(cityBones,vec2((x+1.5)/cityBoneSize.x,y)),texture2D(cityBones,vec2((x+2.5)/cityBoneSize.x,y)),texture2D(cityBones,vec2((x+3.5)/cityBoneSize.x,y)));}
          mat4 cityFrame(float frame){mat4 result=skinWeight.x*cityBone(skinIndex.x,frame);if(skinWeight.y>.0001)result+=skinWeight.y*cityBone(skinIndex.y,frame);if(skinWeight.z>.0001)result+=skinWeight.z*cityBone(skinIndex.z,frame);if(skinWeight.w>.0001)result+=skinWeight.w*cityBone(skinIndex.w,frame);return result;}
          mat4 cityCycle(float phase){float base=floor(phase/32.)*32.;float frame=mod(phase,32.);return cityFrame(base+floor(frame))*(1.-fract(frame))+cityFrame(base+mod(floor(frame)+1.,32.))*fract(frame);}
          mat4 citySkin(){mat4 pose;if(cityPose.z>.995)pose=cityCycle(cityPose.y);else if(cityPose.z<.005)pose=cityCycle(cityPose.x);else pose=cityCycle(cityPose.x)*(1.-cityPose.z)+cityCycle(cityPose.y)*cityPose.z;return cityBindInverse*pose*cityBind;}`)
          .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nmat4 citySkinMatrix=citySkin();objectNormal=mat3(citySkinMatrix)*objectNormal;')
          .replace('#include <begin_vertex>','#include <begin_vertex>\nvCityStyle=cityPose.w;vCityRest=(cityBind*vec4(position,1.)).xyz;vCityTint=cityTint;transformed=(citySkinMatrix*vec4(position,1.)).xyz;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCityTint;varying vec3 vCityRest;varying float vCityStyle;')
          .replace('#include <color_fragment>',`#include <color_fragment>
            // Civilian fabric colours, confined to clothing. Face/hands retain
            // the supplied skin texture; no edits to the player materials.
            float shirt=step(.88,vCityRest.y)*(1.-step(1.53,vCityRest.y))*(1.-step(.48,abs(vCityRest.x)));
            float pants=step(.17,vCityRest.y)*(1.-step(.88,vCityRest.y));
            vec3 fabric=mix(vCityTint*vec3(.38,.43,.49),vCityTint,shirt);
            // Casual wardrobes, not a crowd of identical superhero suits.
            float jacket=step(.5,vCityStyle)*(1.-step(2.5,vCityStyle));
            float center=1.-smoothstep(.065,.09,abs(vCityRest.x));
            fabric=mix(fabric,vec3(.48,.46,.40),shirt*jacket*center);
            float seam=(1.-smoothstep(.007,.018,abs(vCityRest.x)))*shirt;
            fabric*=1.-seam*.22;
            float weave=sin(vCityRest.x*1050.)*sin(vCityRest.y*1050.);
            float clothAA=1.-smoothstep(.001,.006,fwidth(vCityRest.x)+fwidth(vCityRest.y));
            fabric*=1.+weave*.025*clothAA;
            float collar=step(1.39,vCityRest.y)*(1.-step(1.48,vCityRest.y))*(1.-smoothstep(.08,.13,abs(vCityRest.x)));
            fabric=mix(fabric,vCityTint*.32,collar*shirt);
            diffuseColor.rgb=mix(diffuseColor.rgb,fabric,max(shirt,pants));
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.025,.032,.039),1.-step(.17,vCityRest.y));`);
      };
      const mesh=new T.InstancedMesh(geometry,material,48);mesh.name='Authored civilian / '+skin.name;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;
      this.root.add(mesh);this.batches.push({mesh,local:skin.matrixWorld.clone(),pose,tint,dense,light:geometry,normal:material.normalMap,roughness:material.roughnessMap});
    }
  }
  setQuality(quality:QualityId){for(const b of this.batches){b.mesh.geometry=quality==='high'?b.dense:b.light;const m=b.mesh.material as T.MeshStandardMaterial,normal=quality==='low'?null:b.normal,roughness=quality==='low'?null:b.roughness;if(m.normalMap!==normal||m.roughnessMap!==roughness){m.normalMap=normal;m.roughnessMap=roughness;m.needsUpdate=true;}}}
  draw(people:readonly Civilian[],count:number,time:number,camera?:T.Camera){
    if(camera){camera.updateMatrixWorld(true);this.view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.view);}
    const visible:number[]=[];for(let i=0;i<count;i++){this.sphere.center.set(people[i].x,.95,people[i].z);if(!camera||this.frustum.intersectsSphere(this.sphere))visible.push(i);}this.rendered=visible.length;
    for(const batch of this.batches){batch.mesh.count=visible.length;
      for(let slot=0;slot<visible.length;slot++){const i=visible[slot];
        const p=people[i],walking=p.moving,run=p.panicUntil>time;
        const walkPhase=(p.distance/1.65+i*.317)%1*FRAMES,runPhase=(p.distance/2.75+i*.317)%1*FRAMES;
        const blend=T.MathUtils.clamp(p.motion,0,1);
        batch.pose.setXYZW(slot,(time*.33+i*.173)%1*FRAMES,(run?64+runPhase:32+walkPhase),blend,i%4);
        const color=this.palettes[i%this.palettes.length];batch.tint.setXYZ(slot,color.r,color.g,color.b);
        this.transform.position.set(p.x,.025,p.z);this.transform.rotation.set(0,p.yaw,0);
        const scale=.93+(i%5)*.025;this.transform.scale.set(.96*scale,scale,.96*scale);this.transform.updateMatrix();
        this.matrix.multiplyMatrices(this.transform.matrix,batch.local);batch.mesh.setMatrixAt(slot,this.matrix);
      }
      batch.mesh.instanceMatrix.needsUpdate=true;batch.pose.needsUpdate=true;batch.tint.needsUpdate=true;
    }
  }
  dispose(){this.atlas.dispose();for(const {mesh,dense,light}of this.batches){mesh.dispose();dense.dispose();light.dispose();(mesh.material as T.Material).dispose();}this.root.clear();}
}
