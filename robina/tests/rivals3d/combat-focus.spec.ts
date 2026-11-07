import {test,expect} from '@playwright/test';

test('real animated operative holds aim through injury, sprinting and sustained fire; soundtrack mixes obey controls',async({page},info)=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/tests/rivals3d/entry.tsx',r=>r.fulfill({contentType:'application/javascript',body:''}));await page.goto('/tests/rivals3d/index.html');
 const result=await page.evaluate(async()=>{
  const load=(url:string)=>import(/* @vite-ignore */url),T=await load('/node_modules/.vite-rivals3d/deps/three.js'),{GLTFLoader}=await load('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {createActor}=await load('/src/features/rugfire/actors.ts'),{HumanoidAnimator}=await load('/src/features/rivals/three/HumanoidAnimator.ts'),{WeaponRig}=await load('/src/features/rivals/three/WeaponRig.ts'),{CameraFeedback}=await load('/src/features/rivals/three/CameraFeedback.ts'),{CharacterController}=await load('/src/features/rivals/characters/CharacterController.ts'),{emptyCommand}=await load('/src/features/rivals/input/InputBuffer.ts'),{finishOperative}=await load('/src/features/rivals/three/OperativeFinish.ts');
  const loader=new GLTFLoader(),[human,weapon]=await Promise.all([loader.loadAsync('/assets/rivals/characters/universal-operative.glb'),loader.loadAsync('/assets/rivals/combat3d/weapons/rifle.glb')]);finishOperative(human.scene);
  const actor=createActor('player'),animator=new HumanoidAnimator(actor,human.scene,human.animations),gun=new WeaponRig(actor,weapon.scene,animator),controller=new CharacterController(true),feedback=new CameraFeedback(),camera=new T.PerspectiveCamera(62,960/640,.05,100);
  const scene=new T.Scene();scene.background=new T.Color('#101b25');scene.add(actor.root,new T.HemisphereLight(0xddeeff,0x565c50,2));const sun=new T.DirectionalLight(0xffe8cb,3);sun.position.set(3,5,3);scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#32404b',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.005;scene.add(floor);
  let grip=0,support=0,alignment=1,cameraKick=0,shots=0,health=100;const phases=new Set<string>(),spineSamples:number[]=[];
  const frame={vx:0,vz:0,vertical:0,grounded:true,sprinting:false,aiming:true,angle:0,pov:'third',dodgeRemaining:0,dodgeSerial:0,health:100,hitSerial:0,shots:0,reload:0,equipment:'rifle'},aim=new T.Vector3();
  for(let i=0;i<240;i++){
   feedback.restore();const command={...emptyCommand(),x:1,aiming:true,aimX:1,aimY:0,fire:true,sprint:i>=100};
   if(i%30===0){controller.receiveDamage({id:'officer:'+i,sourceId:'police',team:'security',amount:5,angle:Math.PI});frame.hitSerial++;}
   controller.step(command,1/60);
   if(!controller.canAttack||!controller.aiming||controller.aimAngle!==0)throw Error('Police damage interrupted aim/trigger');
   if(i%5===0){gun.fire();feedback.fire();shots++;}
   Object.assign(frame,{vx:controller.vx*.025,vz:controller.vy*.025,health:controller.health,sprinting:controller.sprinting,shots});
   actor.root.position.x+=frame.vx/60;animator.update(1/60,frame);phases.add(animator.motion);spineSamples.push(actor.body.getObjectByName('spine_01').quaternion.x);
   aim.copy(actor.root.position).add(new T.Vector3(15,1.29,0));gun.decay(1/60);gun.pose(aim,frame);
   grip=Math.max(grip,gun.rightGripError);support=Math.max(support,gun.leftGripError);alignment=Math.min(alignment,gun.alignment);
   camera.position.copy(actor.root.position).add(new T.Vector3(3,2.2,4));camera.lookAt(actor.root.position.clone().add(new T.Vector3(0,1,0)));const base=camera.quaternion.clone();
   feedback.update(1/60,true,frame.vx,false);feedback.apply(camera);cameraKick=Math.max(cameraKick,camera.quaternion.angleTo(base));feedback.restore();
   if(camera.fov!==62||camera.quaternion.angleTo(base)>1e-7)throw Error('Camera drift/zoom pumping');
  }
  health=controller.health;
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(960,640);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;
  document.body.innerHTML='';document.body.style.margin='0';document.body.append(renderer.domElement);renderer.render(scene,camera);
  const {HeistScore,HEIST_SCORE}=await load('/src/features/rivals/three/HeistScore.ts'),{defaultSettings}=await load('/src/features/rivals/core/settings.ts');
  const mix=async(muted=false,alert=false,musicVolume=.5,paused=false)=>{
   const context=new OfflineAudioContext(2,22050*3,22050),score=new HeistScore(context,{...defaultSettings(),muted,masterVolume:.7,musicVolume});score.setAlert(alert);if(paused)score.pause(true);
   const buffer=await context.startRendering();let energy=0,peak=0;const data=buffer.getChannelData(0);for(let i=22050;i<data.length;i++){energy+=data[i]**2;peak=Math.max(peak,Math.abs(data[i]));}score.dispose();return{rms:Math.sqrt(energy/(data.length-22050)),peak};
  };
  const audio={cue:HEIST_SCORE,base:await mix(),pursuit:await mix(false,true),muted:await mix(true,true),zeroMusic:await mix(false,true,0),paused:await mix(false,true,.5,true)};
  return{grip,support,alignment,cameraKick,shots,health,phases:[...phases],torsoMotion:Math.max(...spineSamples)-Math.min(...spineSamples),audio};
 });
 expect(result.grip).toBeLessThan(.001);expect(result.support).toBeLessThan(.045);expect(result.alignment).toBeGreaterThan(.985);expect(result.cameraKick).toBeLessThanOrEqual(.001601);
 expect(result.shots).toBe(48);expect(result.health).toBe(60);expect(result.phases).toContain('run');expect(result.phases).toContain('sprint');expect(result.phases).not.toContain('hit');expect(result.torsoMotion).toBeGreaterThan(.005);
 expect(result.audio.base.rms).toBeGreaterThan(.005);expect(result.audio.pursuit.rms).toBeGreaterThan(result.audio.base.rms);expect(result.audio.pursuit.peak).toBeLessThan(.9);
 for(const silent of [result.audio.muted,result.audio.zeroMusic,result.audio.paused])expect(silent.peak).toBeLessThan(.000001);
 await page.screenshot({path:info.outputPath('sprinting-operative-stable-weapon.png')});await info.attach('combat-focus-and-score',{body:JSON.stringify(result,null,2),contentType:'application/json'});expect(errors).toEqual([]);
});
