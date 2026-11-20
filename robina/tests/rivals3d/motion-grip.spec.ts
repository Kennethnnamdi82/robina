import {expect,test} from '@playwright/test';

for(const model of ['realism/field-operative.glb','characters/universal-operative.glb'])test(`real soldier ${model} keeps both rifle grips stable through walking, sprinting, bursts and reload`,async({page},info)=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/tests/rivals3d/entry.tsx',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await page.goto('/tests/rivals3d/index.html');
  const result=await page.evaluate(async model=>{
    const load=(url:string)=>import(/* @vite-ignore */url);
    const T=await load('/node_modules/three/build/three.module.js'),{GLTFLoader}=await load('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {createActor}=await load('/src/features/rugfire/actors.ts'),{HumanoidAnimator}=await load('/src/features/rivals/three/HumanoidAnimator.ts'),{WeaponRig}=await load('/src/features/rivals/three/WeaponRig.ts');
    const [body,rifle]=await Promise.all([new GLTFLoader().loadAsync('/assets/rivals/'+model),new GLTFLoader().loadAsync('/assets/rivals/combat3d/weapons/rifle.glb')]);
    const actor=createActor('player'),animator=new HumanoidAnimator(actor,body.scene,body.animations),gun=new WeaponRig(actor,rifle.scene,animator);
    const scene=new T.Scene();scene.background=new T.Color('#19232d');scene.add(actor.root,new T.HemisphereLight(0xdce6ef,0x454137,3));
    const sun=new T.DirectionalLight(0xffebd0,3);sun.position.set(-3,5,4);scene.add(sun);
    const camera=new T.PerspectiveCamera(40,960/720,.02,100);camera.position.set(-2.8,1.9,3.5);camera.lookAt(0,1,0);
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(960,720);renderer.setPixelRatio(1);document.body.replaceChildren(renderer.domElement);
    const target=new T.Vector3(0,1.32,20),point=new T.Vector3(),prior=new T.Vector3();
    const frame={vx:0,vz:0,vertical:0,grounded:true,sprinting:false,aiming:false,angle:Math.PI/2,pov:'third',dodgeRemaining:0,dodgeSerial:0,health:100,hitSerial:0,shots:0,reload:0,reloadDuration:1.25,equipment:'rifle',independentAim:true,action:'idle'};
    let grip=0,support=0,maxWeaponStep=0,peak={},peakStep={};const clips=new Set<string>();
    const pelvis=body.scene.getObjectByName('pelvis'),pelvisPoint=new T.Vector3(),jogHeights:number[]=[];
    for(let i=0;i<630;i++){
      const dt=1/120;frame.vz=i<60?0:i<180?2:i<300?5.875:i<420?9:0;frame.sprinting=i>=300&&i<420;frame.aiming=i>=420;
      if(i>=420&&i<450&&i%10===0){frame.shots++;gun.fire();}
      frame.reload=i>=450?Math.max(0,1.25-(i-450)*dt):0;
      animator.update(dt,frame);gun.decay(dt);gun.pose(target,frame,dt);actor.root.updateMatrixWorld(true);gun.model.getWorldPosition(point);
      grip=Math.max(grip,gun.rightGripError);if(!frame.reload&&gun.leftGripError>support){support=gun.leftGripError;peak={frame:i,error:support,target:gun.leftTarget.toArray(),wrist:body.scene.getObjectByName('hand_l').getWorldPosition(new T.Vector3()).toArray(),shoulder:body.scene.getObjectByName('upperarm_l').getWorldPosition(new T.Vector3()).toArray()};}
      if(i>1&&point.distanceTo(prior)>maxWeaponStep){maxWeaponStep=point.distanceTo(prior);peakStep={frame:i,from:prior.toArray(),to:point.toArray()};}prior.copy(point);clips.add(animator.upperClipName);
      if(i>=205&&i<300)jogHeights.push(pelvis.getWorldPosition(pelvisPoint).y);
    }
    renderer.render(scene,camera);
    return{grip,support,maxWeaponStep,jogBob:Math.max(...jogHeights)-Math.min(...jogHeights),clips:[...clips],supported:gun.supportEngaged,alignment:gun.alignment,peak,peakStep};
  },model);
  console.log('Real soldier grip/motion audit:',JSON.stringify(result));
  expect(result.grip).toBeLessThan(.005);expect(result.support).toBeLessThan(.035);
  expect(result.maxWeaponStep).toBeLessThan(.04);expect(result.clips).toEqual(['Pistol_Aim_Neutral']);expect(result.supported).toBe(true);
  expect(result.alignment).toBeGreaterThan(.98);expect(errors).toEqual([]);
  if(model.startsWith('realism/'))expect(result.jogBob).toBeLessThan(.13);
  await page.screenshot({path:info.outputPath('stable-rifle-grip.png')});
});
