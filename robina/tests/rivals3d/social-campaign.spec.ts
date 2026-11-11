import {test,expect} from '@playwright/test';
import type * as Three from 'three';
import type {SocialScene} from '../../src/features/rivals/three/SocialScene';
type SceneWindow=Window&{__socialArt:{scene:Three.Scene;renderer:Three.WebGLRenderer;camera:Three.PerspectiveCamera;social:SocialScene;T:typeof Three}};
test.use({launchOptions:{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
test('articulated hands and populated social venues render with the real supplied assets',async({page},info)=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&/Shader|WebGLProgram|GL_INVALID/.test(message.text()))errors.push(message.text());});
  await page.route('**/tests/rivals3d/entry.tsx',route=>route.fulfill({contentType:'application/javascript',body:''}));
  await page.goto('/tests/rivals3d/index.html');
  const hands=await page.evaluate(async()=>{
    const load=(path:string)=>import(/* @vite-ignore */path),T=await load('/node_modules/three/build/three.module.js'),{GLTFLoader}=await load('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),{FirstPersonWeapon}=await load('/src/features/rivals/three/WeaponRig.ts');
    const scene=new T.Scene();scene.background=new T.Color('#35414c');scene.add(new T.HemisphereLight(0xe3efff,0x333b27,2.3));const sun=new T.DirectionalLight(0xffe7c7,3);sun.position.set(2,3,2);scene.add(sun);
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1100,700);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.replaceChildren(renderer.domElement);document.body.style.margin='0';
    const camera=new T.PerspectiveCamera(65,1100/700,.025,150);const model=await new GLTFLoader().loadAsync('/assets/rivals/combat3d/weapons/rifle.glb');
    const weapon=new FirstPersonWeapon(model.scene);scene.add(weapon.root);weapon.update(.016,false,0,1.2);await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
    (window as unknown as SceneWindow).__socialArt={scene,renderer,camera,T,social:undefined as unknown as SocialScene};
    return{digits:weapon.hands.fingerCount,meshes:weapon.handMeshCount,calls:renderer.info.render.calls};
  });
  expect(hands.digits).toBe(10);expect(hands.meshes).toBeLessThan(20);await page.screenshot({path:info.outputPath('first-person-gripping-hands.png')});
  const grip=await page.evaluate(async()=>{
    const q=(window as unknown as SceneWindow).__socialArt,load=(path:string)=>import(/* @vite-ignore */path),{GLTFLoader}=await load('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),{createActor}=await load('/src/features/rugfire/actors.ts'),{HumanoidAnimator}=await load('/src/features/rivals/three/HumanoidAnimator.ts'),{WeaponRig}=await load('/src/features/rivals/three/WeaponRig.ts'),{finishOperative}=await load('/src/features/rivals/three/OperativeFinish.ts');
    q.scene.children.filter(node=>node.type==='Group').forEach(node=>q.scene.remove(node));
    const human=await new GLTFLoader().loadAsync('/assets/rivals/characters/universal-operative.glb'),rifle=await new GLTFLoader().loadAsync('/assets/rivals/combat3d/weapons/rifle.glb');finishOperative(human.scene);
    const actor=createActor('player'),avatar=new HumanoidAnimator(actor,human.scene,human.animations),weapon=new WeaponRig(actor,rifle.scene,avatar);q.scene.add(actor.root);
    const frame={vx:0,vz:0,vertical:0,grounded:true,sprinting:false,aiming:true,angle:Math.PI/2,pov:'third',dodgeRemaining:0,dodgeSerial:0,health:100,hitSerial:0,shots:1,reload:0,equipment:'rifle'};
    // The animator starts facing the default insertion direction. Settle its
    // genuine turn before judging a held pose; a single frame captures mid-turn.
    const target=new q.T.Vector3(0,1.3,10);for(let i=0;i<90;i++){avatar.update(1/60,frame);weapon.pose(target,frame);}
    weapon.fire();weapon.pose(target,frame);q.camera.position.set(1.15,1.65,1.5);q.camera.lookAt(0,1.2,.2);q.camera.updateMatrixWorld(true);await q.renderer.compileAsync(q.scene,q.camera);q.renderer.render(q.scene,q.camera);
    return{right:weapon.rightGripError,left:weapon.leftGripError,supported:weapon.supportEngaged,alignment:weapon.alignment};
  });expect(grip.right).toBeLessThan(.001);expect(grip.left).toBeLessThan(.045);expect(grip.supported).toBe(true);expect(grip.alignment).toBeGreaterThan(.98);await page.screenshot({path:info.outputPath('third-person-real-rig-grip.png')});
  const venue=await page.evaluate(async()=>{
    const q=(window as unknown as SceneWindow).__socialArt,load=(path:string)=>import(/* @vite-ignore */path),{GLTFLoader}=await load('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),{SocialScene}=await load('/src/features/rivals/three/SocialScene.ts'),{ASSIGNMENTS}=await load('/src/features/rivals/missions/assignments.ts');
    q.scene.children.filter(node=>node.type==='Group').forEach(node=>q.scene.remove(node));const human=await new GLTFLoader().loadAsync('/assets/rivals/characters/universal-operative.glb');q.social=new SocialScene({scene:human.scene,animations:human.animations},ASSIGNMENTS[7]);q.scene.add(q.social.root);
    q.camera.position.set(134,8,54);q.camera.lookAt(125,1,44);q.camera.updateMatrixWorld(true);q.social.update(4,new q.T.Vector3(126,0,44),false);await q.renderer.compileAsync(q.scene,q.camera);q.renderer.render(q.scene,q.camera);
    let people=0;q.social.root.traverse(node=>{if(node.name.startsWith('Social character'))people++;});return{people,calls:q.renderer.info.render.calls};
  });
  expect(venue.people).toBeGreaterThanOrEqual(13);expect(venue.calls).toBeLessThan(150);await page.screenshot({path:info.outputPath('amber-room-patrons-waiter.png')});
  await page.evaluate(()=>{const q=(window as unknown as SceneWindow).__socialArt;q.camera.position.set(135,2.1,44);q.camera.lookAt(122,1.2,44);q.camera.updateMatrixWorld(true);q.social.update(8,new q.T.Vector3(126,0,44),false);q.renderer.render(q.scene,q.camera);});await page.screenshot({path:info.outputPath('bar-open-door-interior.png')});
  await page.evaluate(()=>{const q=(window as unknown as SceneWindow).__socialArt;q.camera.position.set(141,3.6,69);q.camera.lookAt(137,1,62);q.camera.updateMatrixWorld(true);q.social.update(5,new q.T.Vector3(136,0,64),true);q.renderer.render(q.scene,q.camera);});await page.screenshot({path:info.outputPath('broker-wine-and-gang-handoff.png')});
  expect(errors).toEqual([]);
});
