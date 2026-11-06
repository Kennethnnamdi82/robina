import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createActor } from '../../src/features/rugfire/actors';
import { HumanoidAnimator, type HumanoidFrame } from '../../src/features/rivals/three/HumanoidAnimator';
import { WeaponRig } from '../../src/features/rivals/three/WeaponRig';
import { finishOperative } from '../../src/features/rivals/three/OperativeFinish';
if(import.meta.env.DEV&&import.meta.env.VITE_RIVALS_3D_SANDBOX==='true')void(async()=>{
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  document.body.append(renderer.domElement);const scene=new T.Scene();scene.background=new T.Color('#16212b');
  const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.01,100);scene.add(new T.HemisphereLight(0xe7edf5,0x34414a,2));
  const light=new T.DirectionalLight(0xffe9cf,3);light.position.set(3,5,4);scene.add(light);
  const actor=createActor('player'),loader=new GLTFLoader();scene.add(actor.root);
  const [body,rifle]=await Promise.all([loader.loadAsync('/assets/rivals/characters/universal-operative.glb'),loader.loadAsync('/assets/rivals/combat3d/weapons/rifle.glb')]);
  finishOperative(body.scene);const animator=new HumanoidAnimator(actor,body.scene,body.animations),gun=new WeaponRig(actor,rifle.scene,animator);
  const frame:HumanoidFrame={vx:0,vz:0,vertical:0,grounded:true,sprinting:false,aiming:false,angle:Math.PI/2,pov:'third',dodgeRemaining:0,dodgeSerial:0,health:100,hitSerial:0,shots:0,reload:0,equipment:'rifle',independentAim:true};
  const target=new T.Vector3(0,1.3,12),point=new T.Vector3();let view='front',clock=0;
  const api={view:(value:string)=>{view=value;},aim:(active:boolean)=>{frame.aiming=active;},walk:(active:boolean)=>{frame.vz=active?2:0;},metrics:()=>({grip:gun.rightGripError,support:gun.leftGripError,supported:gun.supportEngaged,gun:gun.model.getWorldPosition(point).toArray(),yaw:animator.yaw,visible:actor.root.visible})};
  Object.assign(window,{equipmentStudio:api});document.getElementById('status')!.remove();
  function draw(){requestAnimationFrame(draw);clock+=1/60;animator.update(1/60,frame);
    const angles:Record<string,number>={front:0,right:Math.PI/2,rear:Math.PI,left:-Math.PI/2},angle=animator.yaw+(angles[view]??0);
    camera.position.set(Math.sin(angle)*3.8,1.35,Math.cos(angle)*3.8);camera.lookAt(0,1.03,0);camera.updateMatrixWorld(true);
    // Orbit's crosshair faces the actor, while the idle hold must stay forward.
    const observed=camera.getWorldDirection(new T.Vector3()).multiplyScalar(12).add(camera.position);
    gun.pose(frame.aiming?target:observed,frame);renderer.render(scene,camera);
  }draw();
})();
