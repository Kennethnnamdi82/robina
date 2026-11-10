import {test,expect} from '@playwright/test';
import type * as Three from 'three';
import type {AssignmentSite} from '../../src/features/rivals/three/AssignmentSite';
import type {SiteLife} from '../../src/features/rivals/three/SiteLife';
import type {WorldState} from '../../src/features/rivals/world/WorldState';
type FixtureWindow=Window&{__campaignArt:{scene:Three.Scene;renderer:Three.WebGLRenderer;camera:Three.PerspectiveCamera;site:AssignmentSite;life:SiteLife|null;world:WorldState;T:typeof import('three');ASSIGNMENTS:typeof import('../../src/features/rivals/missions/assignments').ASSIGNMENTS;AssignmentSite:typeof import('../../src/features/rivals/three/AssignmentSite').AssignmentSite;WorldState:typeof import('../../src/features/rivals/world/WorldState').WorldState;createAssignmentOperation:typeof import('../../src/features/rivals/three/Operations').createAssignmentOperation;addAssignmentWalls:typeof import('../../src/features/rivals/three/AssignmentSite').addAssignmentWalls}};
interface AudioFixture {unlock:()=>void;context:AudioContext;sirenGain:GainNode;sirenPan:StereoPannerNode;sirens:OscillatorNode[];master:GainNode}

test.use({launchOptions:{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}});

test('seven bespoke mission sites render, with bank staff, opening doors and a working vault',async({page},info)=>{
  test.setTimeout(180000);const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&/Shader|WebGLProgram|GL_INVALID/.test(message.text()))errors.push(message.text());});
  await page.route('**/tests/rivals3d/entry.tsx',route=>route.fulfill({contentType:'application/javascript',body:''}));
  await page.goto('/tests/rivals3d/index.html');
  await page.setViewportSize({width:1100,height:700});
  const bank=await page.evaluate(async()=>{
    const load=(path:string)=>import(/* @vite-ignore */path);
    const T=await load('/node_modules/three/build/three.module.js'),{GLTFLoader}=await load('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {ASSIGNMENTS}=await load('/src/features/rivals/missions/assignments.ts'),{createAssignmentOperation}=await load('/src/features/rivals/three/Operations.ts'),{WorldState}=await load('/src/features/rivals/world/WorldState.ts');
    const {AssignmentSite,addAssignmentWalls}=await load('/src/features/rivals/three/AssignmentSite.ts'),{SiteLife}=await load('/src/features/rivals/three/SiteLife.ts'),{NavigationGrid}=await load('/src/features/rivals/ai/navigation.ts');
    const scene=new T.Scene();scene.background=new T.Color('#6e8796');scene.add(new T.HemisphereLight(0xe7f1fa,0x6c5643,2.1));const sun=new T.DirectionalLight(0xffe4bb,3);sun.position.set(30,30,40);scene.add(sun);
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1100,700);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.replaceChildren(renderer.domElement);document.body.style.margin='0';
    const camera=new T.PerspectiveCamera(48,1100/700,.05,150),a=ASSIGNMENTS[0],world=new WorldState(createAssignmentOperation(0,321).level);addAssignmentWalls(world,a);
    const site=new AssignmentSite(a,world);scene.add(site.root);camera.position.set(a.site.x+11,10,a.site.z+16);camera.lookAt(a.site.x,1,a.site.z);camera.updateMatrixWorld(true);
    const gltf=await new GLTFLoader().loadAsync('/assets/rivals/characters/universal-operative.glb'),life=new SiteLife(a,{scene:gltf.scene,animations:gltf.animations},new NavigationGrid(world.level.width*2,world.level.height*2,32,world.blockers));life.setQuality('low');scene.add(life.root);
    site.update(1,new T.Vector3(a.site.x,0,a.site.z+6));life.update(0,1,false,camera);await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
    // All mutation handles live only in this test fixture, never the application.
    (window as unknown as FixtureWindow).__campaignArt={scene,renderer,camera,site,life,world,T,ASSIGNMENTS,AssignmentSite,WorldState,createAssignmentOperation,addAssignmentWalls};
    return{people:life.people.length,cashiers:life.people.filter((p:{z:number})=>p.z<a.site.z).length,entrances:(site as unknown as {doors:Three.Group[]}).doors.length,draws:renderer.info.render.calls};
  });
  expect(bank.people).toBe(7);expect(bank.cashiers).toBe(2);expect(bank.entrances).toBe(2);expect(bank.draws).toBeLessThan(40);
  await page.screenshot({path:info.outputPath('bank-lobby-cashiers-customers.png')});
  const vault=await page.evaluate(()=>{const q=(window as unknown as FixtureWindow).__campaignArt;q.world.grantFlag('task-1');q.site.update(2,new q.T.Vector3(44,0,25));q.camera.position.set(44,2.1,24.7);q.camera.lookAt(44,1,15.8);q.camera.updateMatrixWorld(true);q.life?.update(0,2,false,q.camera);q.renderer.render(q.scene,q.camera);return (q.site as unknown as {vault:Three.Group}).vault.rotation.y;});
  expect(Math.abs(vault)).toBeGreaterThan(1);await page.screenshot({path:info.outputPath('bank-counter-and-open-vault.png')});
  for(let index=1;index<7;index++){
    const name=await page.evaluate(async index=>{const q=(window as unknown as FixtureWindow).__campaignArt;q.scene.remove(q.site.root);if(q.life){q.scene.remove(q.life.root);q.life.dispose();q.life=null;}q.site.dispose();const a=q.ASSIGNMENTS[index],world=new q.WorldState(q.createAssignmentOperation(index,321).level);q.addAssignmentWalls(world,a);q.site=new q.AssignmentSite(a,world);q.scene.add(q.site.root);q.camera.position.set(a.site.x+11,11,a.site.z+16);q.camera.lookAt(a.site.x,1,a.site.z);q.camera.updateMatrixWorld(true);q.site.update(1,new q.T.Vector3(a.site.x,0,a.site.z+6));await q.renderer.compileAsync(q.scene,q.camera);q.renderer.render(q.scene,q.camera);return a.name;},index);
    expect(name).not.toBe('THE LAST DEPOSIT');await page.screenshot({path:info.outputPath('stage-'+(index+1)+'-interior.png')});
  }
  const location=await page.evaluate(async()=>{
    const load=(path:string)=>import(/* @vite-ignore */path),q=(window as unknown as FixtureWindow).__campaignArt;
    const {CityAssets}=await load('/src/features/rivals/three/CityAssets.ts'),{CityEnvironment}=await load('/src/features/rivals/three/CityEnvironment.ts'),{CityAtmosphere}=await load('/src/features/rivals/three/CityAtmosphere.ts'),{convertSolids}=await load('/src/features/rivals/three/world3d.ts'),{SiteLife}=await load('/src/features/rivals/three/SiteLife.ts'),{NavigationGrid}=await load('/src/features/rivals/ai/navigation.ts'),{GLTFLoader}=await load('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    q.site.dispose();q.scene.clear();const op=q.createAssignmentOperation(0,321),a=q.ASSIGNMENTS[0],world=new q.WorldState(op.level);q.addAssignmentWalls(world,a);
    const assets=new CityAssets();await assets.load();const humanoid=await new GLTFLoader().loadAsync('/assets/rivals/characters/universal-operative.glb');assets.humanoid={scene:humanoid.scene,animations:humanoid.animations};
    const grass=await new q.T.TextureLoader().loadAsync('/assets/rugfire/textures/grass-alpha.webp'),city=new CityEnvironment(assets,convertSolids(world),grass,op.venue,op.seed);city.setQuality('low');q.scene.add(city.root);
    new CityAtmosphere(q.scene,q.renderer,'golden');q.site=new q.AssignmentSite(a,world);q.scene.add(q.site.root);q.life=new SiteLife(a,assets.humanoid,new NavigationGrid(world.level.width*2,world.level.height*2,32,world.blockers));q.life.setQuality('low');q.scene.add(q.life.root);
    q.camera.position.set(a.site.x+12,9,a.site.z+18);q.camera.lookAt(a.site.x,1.5,a.site.z);q.camera.updateMatrixWorld(true);q.site.update(1,new q.T.Vector3(44,0,25));q.life.update(0,1,false,q.camera);city.update(1,'third',false,new q.T.Vector3(44,0,25),0,[],q.camera);await q.renderer.compileAsync(q.scene,q.camera);q.renderer.render(q.scene,q.camera);return city.plan.label;
  });
  expect(location).toBe('HELIX / FINANCIAL MILE');await page.screenshot({path:info.outputPath('bank-in-financial-district.png')});
  await page.evaluate(()=>{const q=(window as unknown as FixtureWindow).__campaignArt;q.camera.position.set(44,1.7,24.7);q.camera.lookAt(44,1.5,17);q.camera.updateMatrixWorld(true);q.life?.update(0,1,false,q.camera);q.renderer.render(q.scene,q.camera);});
  await page.screenshot({path:info.outputPath('bank-interior-in-city.png')});
  expect(errors).toEqual([]);
});

test('police siren oscillators become audible during pursuit and respect mute',async({page})=>{
  await page.route('**/tests/rivals3d/entry.tsx',route=>route.fulfill({contentType:'application/javascript',body:''}));await page.goto('/tests/rivals3d/index.html');
  const result=await page.evaluate(async()=>{
    const load=(path:string)=>import(/* @vite-ignore */path),{CityAmbience}=await load('/src/features/rivals/three/CityAmbience.ts'),{defaultSettings}=await load('/src/features/rivals/core/settings.ts');
    const bus=new CityAmbience({...defaultSettings(),muted:false,musicVolume:0,masterVolume:1,sfxVolume:1}),audio=bus as unknown as AudioFixture;audio.unlock();await audio.context.resume();bus.update(1,0,20,false,true,undefined,{distance:4,pan:.6,level:3});await new Promise(r=>setTimeout(r,600));
    const active={gain:audio.sirenGain.gain.value,pan:audio.sirenPan.pan.value,voices:audio.sirens.length};bus.configure({...defaultSettings(),muted:true});await new Promise(r=>setTimeout(r,700));const muted=audio.master.gain.value;bus.dispose();return{...active,muted};
  });
  expect(result.voices).toBe(2);expect(result.gain).toBeGreaterThan(.05);expect(result.pan).toBeGreaterThan(.3);expect(result.muted).toBeLessThan(.02);
});
