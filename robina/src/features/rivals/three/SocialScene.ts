import * as T from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ArmIK } from './ArmIK';
import type { HumanSource } from './CityPeople';
import type { Assignment } from '../missions/assignments';
import { SOCIAL_VENUES, socialWalls } from './SocialVenues';
import {batchPresentation} from './batchPresentation';

type SocialPose = 'stand'|'sit'|'drink'|'eat'|'dance';
/** Small, nearby-only casts use the supplied human skin and a genuine two-bone
 * sitting/serving pose. No new asset downloads or second renderer are needed. */
class SocialPerson {
  readonly root=new T.Group();private body:T.Object3D;private limbs:{bone:T.Object3D;rotation:T.Quaternion}[]=[];
  private right:ArmIK;private left:ArmIK;private legs:ArmIK[]=[];private cup?:T.Group;private point=new T.Vector3();private pole=new T.Vector3();
  private ownedMaterials:T.Material[]=[];
  constructor(source:HumanSource,readonly pose:SocialPose,private glass:()=>T.Group,colour:number){
    this.root.userData.socialAnimated=true;this.body=clone(source.scene);this.body.name='Social character / '+pose;this.root.add(this.body);
    this.body.getObjectByName('Operative-vis-or')?.removeFromParent();
    const mixer=new T.AnimationMixer(this.body),idle=source.animations.find(clip=>clip.name==='Idle_Loop');
    if(idle){mixer.clipAction(idle).play();mixer.setTime(.4);}
    // Stopping a mixer restores the bind pose. Retain the sampled idle before
    // releasing its bindings, otherwise stationary guests spread their arms.
    const sampled:{node:T.Object3D;position:T.Vector3;rotation:T.Quaternion;scale:T.Vector3}[]=[];
    this.body.traverse(node=>sampled.push({node,position:node.position.clone(),rotation:node.quaternion.clone(),scale:node.scale.clone()}));
    mixer.stopAllAction();mixer.uncacheRoot(this.body);
    sampled.forEach(pose=>{pose.node.position.copy(pose.position);pose.node.quaternion.copy(pose.rotation);pose.node.scale.copy(pose.scale);});
    this.body.traverse(node=>{if(node instanceof T.Mesh){node.castShadow=false;node.receiveShadow=true;const paint=(original:T.Material)=>{const material=(original as T.MeshStandardMaterial).clone();this.ownedMaterials.push(material);if(node.name==='SuperHero_Male'){
      material.customProgramCacheKey=()=>'social-clothing-v1';material.onBeforeCompile=shader=>{shader.uniforms.socialTint={value:new T.Color(colour)};shader.uniforms.socialBind={value:(node as T.SkinnedMesh).bindMatrix};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSocialRest;uniform mat4 socialBind;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSocialRest=(socialBind*vec4(position,1.)).xyz;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSocialRest;uniform vec3 socialTint;').replace('#include <color_fragment>','#include <color_fragment>\nfloat shirt=step(.87,vSocialRest.y)*(1.-step(1.49,vSocialRest.y))*(1.-step(.48,abs(vSocialRest.x)));float pants=step(.15,vSocialRest.y)*(1.-step(.87,vSocialRest.y));diffuseColor.rgb=mix(diffuseColor.rgb,socialTint,shirt);diffuseColor.rgb=mix(diffuseColor.rgb,socialTint*.45,pants);');};
    }return material;};node.material=Array.isArray(node.material)?node.material.map(paint):paint(node.material);}});
    const bone=(name:string)=>{const node=this.body.getObjectByName(name);if(!node)throw Error('Social actor is missing '+name);return node;};
    this.right=new ArmIK(bone('upperarm_r'),bone('lowerarm_r'),bone('hand_r'));this.left=new ArmIK(bone('upperarm_l'),bone('lowerarm_l'),bone('hand_l'));
    for(const name of ['upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l','thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r']){const node=bone(name);this.limbs.push({bone:node,rotation:node.quaternion.clone()});}
    if(pose!=='stand'&&pose!=='dance'){this.body.position.y=-.42;for(const side of ['l','r'])this.legs.push(new ArmIK(bone('thigh_'+side),bone('calf_'+side),bone('foot_'+side)));}
    if(pose==='drink'){this.cup=glass();this.root.add(this.cup);}
  }
  update(time:number){
    for(const limb of this.limbs)limb.bone.quaternion.copy(limb.rotation);
    this.body.rotation.z=this.pose==='dance'?Math.sin(time*2.4)*.055:Math.sin(time*.8)*.006;
    this.root.updateMatrixWorld(true);
    this.legs.forEach((leg,index)=>{const side=index===0?1:-1;this.point.set(side*.13,.08,.42);this.root.localToWorld(this.point);this.pole.set(side*.14,.54,.7);this.root.localToWorld(this.pole);leg.solve(this.point,this.pole);});
    if(this.pose==='drink'||this.pose==='eat'){
      const sip=(Math.sin(time*.65)+1)/2,lift=T.MathUtils.smoothstep(sip,.42,.9);
      this.point.set(.25-lift*.11,.86+lift*.36,.4-lift*.24);if(this.cup)this.cup.position.copy(this.point);if(this.cup)this.cup.position.y-=.1;this.root.localToWorld(this.point);this.pole.set(.48,.75,.12);this.root.localToWorld(this.pole);this.right.solve(this.point,this.pole);
      this.point.set(-.25,.88,.4);this.root.localToWorld(this.point);this.pole.set(-.5,.7,.1);this.root.localToWorld(this.pole);this.left.solve(this.point,this.pole);
    }else if(this.pose==='stand'||this.pose==='sit'){
      for(const [arm,side]of [[this.right,1],[this.left,-1]] as const){this.point.set(side*.24,this.pose==='sit'?.65:.91,this.pose==='sit'?.35:.07);this.root.localToWorld(this.point);this.pole.set(side*.45,this.pose==='sit'?.76:1.1,-.02);this.root.localToWorld(this.pole);arm.solve(this.point,this.pole);}
    }else if(this.pose==='dance'){
      for(const [arm,side]of [[this.right,1],[this.left,-1]] as const){this.point.set(side*.38,1.05+Math.sin(time*2+side)*.1,.23);this.root.localToWorld(this.point);this.pole.set(side*.6,.95,-.1);this.root.localToWorld(this.pole);arm.solve(this.point,this.pole);}
    }
  }
  dispose(){this.body.traverse(node=>{if(node instanceof T.SkinnedMesh)node.skeleton.boneTexture?.dispose();});this.ownedMaterials.forEach(material=>material.dispose());this.root.clear();}
}

export class SocialScene {
  readonly root=new T.Group();private geometry=new Set<T.BufferGeometry>();private materials=new Set<T.Material>();private textures:T.Texture[]=[];
  private casts:{person:SocialPerson;offset:number}[]=[];private groups:{root:T.Group;x:number;z:number}[]=[];private brokerCase?:T.Group;
  private scratch=new T.Vector3();
  private makeHeld?:(action:string)=>T.Group|undefined;
  constructor(source:HumanSource,assignment?:Assignment){
    this.root.name='WATERFRONT / SOCIAL LIFE';
    const mat=(color:number,metalness=0,roughness=.7)=>{const material=new T.MeshStandardMaterial({color,metalness,roughness});this.materials.add(material);return material;};
    const wood=mat(0x5c3b29),dark=mat(0x22252a,.2),cream=mat(0xcfc3ab),brass=mat(0xc5a66e,.6,.3),leather=mat(0x392323),white=mat(0xe4dfd2),green=mat(0x234a3d),red=mat(0x5e1225,.05,.2);
    const clear=new T.MeshPhysicalMaterial({color:0xd2e1e5,transparent:true,opacity:.37,roughness:.08,metalness:0,side:T.DoubleSide,depthWrite:false});this.materials.add(clear);
    const unit=this.own(new T.BoxGeometry(1,1,1)),cylinder=this.own(new T.CylinderGeometry(1,1,1,14)),sphere=this.own(new T.SphereGeometry(1,12,8));
    const box=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material)=>{const mesh=new T.Mesh(unit,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    const round=(parent:T.Group,x:number,y:number,z:number,r:number,h:number,material:T.Material)=>{const mesh=new T.Mesh(cylinder,material);mesh.position.set(x,y,z);mesh.scale.set(r,h,r);parent.add(mesh);return mesh;};
    const glass=()=>{const root=new T.Group();round(root,0,.004,0,.034,.008,clear);round(root,0,.05,0,.005,.09,clear);const bowl=new T.Mesh(this.own(new T.LatheGeometry([new T.Vector2(.005,.09),new T.Vector2(.035,.105),new T.Vector2(.052,.145),new T.Vector2(.049,.19)],14)),clear);root.add(bowl);round(root,0,.128,0,.04,.035,red);return root;};
    this.makeHeld=action=>{if(action==='party')return undefined;if(action==='drink'){const cup=glass();cup.position.set(.01,.005,-.015);return cup;}const plate=new T.Group();round(plate,0,0,0,.16,.025,white);const food=new T.Mesh(sphere,wood);food.scale.set(.1,.04,.08);food.position.y=.03;plate.add(food);return plate;};
    const bottle=(parent:T.Group,x:number,z:number,y=.85)=>{round(parent,x,y+.11,z,.065,.22,green);round(parent,x,y+.27,z,.025,.16,green);round(parent,x,y+.36,z,.027,.035,brass);box(parent,x,y+.12,z+.061,.095,.1,.006,cream);};
    const chair=(parent:T.Group,x:number,z:number,yaw=0,boss=false)=>{const group=new T.Group();group.position.set(x,0,z);group.rotation.y=yaw;parent.add(group);box(group,0,.47,0,boss?.8:.65,.12,.66,leather);box(group,0,.91,-.29,boss?.82:.66,.84,.13,leather);for(const dx of [-.26,.26])for(const dz of [-.24,.24])box(group,dx,.23,dz,.055,.46,.055,wood);if(boss)for(const dx of [-.41,.41])box(group,dx,.72,0,.12,.13,.65,wood);};
    const table=(parent:T.Group,x:number,z:number)=>{round(parent,x,.79,z,.7,.09,wood);round(parent,x,.4,z,.065,.74,brass);round(parent,x,.07,z,.32,.06,dark);for(const dx of [-.28,.28]){round(parent,x+dx,.845,z,.17,.025,white);const food=new T.Mesh(sphere,mat(0x986b3d));food.position.set(x+dx,.89,z);food.scale.set(.1,.045,.09);parent.add(food);}bottle(parent,x,z-.2);const cup=glass();cup.position.set(x+.35,.85,z+.2);parent.add(cup);};
    const person=(parent:T.Group,x:number,z:number,yaw:number,pose:SocialPose,colour:number,index:number)=>{const actor=new SocialPerson(source,pose,glass,colour);actor.root.position.set(x,0,z);actor.root.rotation.y=yaw;parent.add(actor.root);actor.update(index*1.7);this.casts.push({person:actor,offset:index*1.7});return actor;};
    for(const venue of SOCIAL_VENUES){
      const room=new T.Group();room.name=venue.name;this.root.add(room);this.groups.push({root:room,x:venue.x,z:venue.z});
      box(room,venue.x,-.02,venue.z,11.4,.06,11.4,venue.id==='bar'?wood:cream);
      for(const part of socialWalls().filter(part=>part.id.startsWith(venue.id)&&!part.id.includes('table')))box(room,part.x,part.h/2,part.z,part.w,part.h,part.d,part.id.includes('counter')?wood:venue.id==='bar'?leather:cream);
      // Real door opening faces the eastern promenade. There is no roof hiding the room.
      box(room,venue.x+5.6,2.85,venue.z,.3,.35,3.2,dark);
      this.sign(room,venue.name,venue.x,2.7,venue.z-5.42,7.5,.65);
      for(const dz of [-3,3]){table(room,venue.x+1.9,venue.z+dz);chair(room,venue.x+1.9,venue.z+dz-1.05,0);chair(room,venue.x+1.9,venue.z+dz+1.05,Math.PI);person(room,venue.x+1.9,venue.z+dz-1.05,0,dz<0?'drink':'eat',dz<0?0x586879:0x80594a,this.casts.length);person(room,venue.x+1.9,venue.z+dz+1.05,Math.PI,'eat',0x53604a,this.casts.length);}
      for(let z=venue.z-2.4;z<=venue.z+2.4;z+=.8)bottle(room,venue.x-4.9,z,1.4);
      box(room,venue.x-4.9,1.38,venue.z,.65,.12,6.2,wood);box(room,venue.x-4.9,2.05,venue.z,.65,.12,6.2,wood);
      person(room,venue.x-4.4,venue.z,Math.PI/2,'stand',0xd5d2c9,this.casts.length);
      if(venue.id==='bar'){box(room,venue.x+.8,.018,venue.z,3,.025,2.8,dark);person(room,venue.x+.25,venue.z,0,'dance',0x864c51,this.casts.length);person(room,venue.x+1.4,venue.z,Math.PI,'dance',0x3f6263,this.casts.length);}
      for(const dz of [-3.6,3.6]){const lamp=new T.PointLight(0xffcf91,1.2,7,2);lamp.position.set(venue.x,2.5,venue.z+dz);room.add(lamp);round(room,venue.x,2.58,venue.z+dz,.3,.18,brass);}
    }
    if(assignment?.bossHandoff){
      const lounge=new T.Group(),x=assignment.extraction.x,z=assignment.extraction.z;this.root.add(lounge);this.groups.push({root:lounge,x,z});lounge.name='THE BROKER / PRIVATE HANDOFF';
      box(lounge,x+1,.02,z-1,5.5,.05,5,leather);table(lounge,x+1.5,z-1.6);chair(lounge,x+1.5,z-2.65,0,true);person(lounge,x+1.5,z-2.65,0,'drink',0x292a31,0);
      chair(lounge,x-.25,z-1.6,Math.PI/2);person(lounge,x-.25,z-1.6,Math.PI/2,'sit',0x3c4851,1);person(lounge,x+3.2,z-.7,-Math.PI/2,'stand',0x35342e,2);
      this.sign(lounge,'THE BROKER / PRIVATE TABLE',x+1.5,2.4,z-3.4,4,.35);
      this.brokerCase=new T.Group();this.brokerCase.userData.socialAnimated=true;box(this.brokerCase,0,.15,0,.65,.3,.45,dark);box(this.brokerCase,0,.32,0,.25,.055,.06,brass);this.brokerCase.position.set(x+1.5,.85,z-1.6);this.brokerCase.visible=false;lounge.add(this.brokerCase);
    }
    for(const group of this.groups)batchPresentation(group.root,geometry=>this.own(geometry),node=>Boolean(node.userData.socialAnimated));
  }
  private own<G extends T.BufferGeometry>(geometry:G){this.geometry.add(geometry);return geometry;}
  heldItem(action:string){return this.makeHeld?.(action);}
  private sign(parent:T.Group,text:string,x:number,y:number,z:number,w:number,h:number){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const context=canvas.getContext('2d')!;context.fillStyle='#1a1c20';context.fillRect(0,0,1024,128);context.font='600 42px Arial';context.textAlign='center';context.fillStyle='#e7d6ad';context.fillText(text,512,80);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;this.textures.push(texture);const material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});this.materials.add(material);const mesh=new T.Mesh(this.own(new T.PlaneGeometry(w,h)),material);mesh.position.set(x,y,z);parent.add(mesh);}
  update(time:number,player:T.Vector3,delivered:boolean){for(const group of this.groups)group.root.visible=Math.hypot(group.x-player.x,group.z-player.z)<42;for(const cast of this.casts){if(cast.person.root.parent?.visible&&cast.person.root.getWorldPosition(this.scratch).distanceTo(player)<25)cast.person.update(time+cast.offset);}if(this.brokerCase)this.brokerCase.visible=delivered;}
  dispose(){this.casts.forEach(cast=>cast.person.dispose());this.geometry.forEach(geometry=>geometry.dispose());this.materials.forEach(material=>material.dispose());this.textures.forEach(texture=>texture.dispose());this.root.clear();}
}
