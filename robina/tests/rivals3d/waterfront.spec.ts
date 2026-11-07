import {test,expect} from '@playwright/test';

test('authored waterfront renders with open bridges, hotel and bar; real vocals decode',async({page},info)=>{
 test.setTimeout(180000);await page.setViewportSize({width:960,height:540});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/tests/rivals3d/entry.tsx',r=>r.fulfill({contentType:'application/javascript',body:''}));await page.goto('/tests/rivals3d/index.html');
 const result=await page.evaluate(async()=>{
  const load=(url:string)=>import(/* @vite-ignore */url),T=await load('/node_modules/.vite-rivals3d/deps/three.js'),{GLTFLoader}=await load('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {CityAssets}=await load('/src/features/rivals/three/CityAssets.ts'),{CityEnvironment}=await load('/src/features/rivals/three/CityEnvironment.ts'),{createAssignmentOperation}=await load('/src/features/rivals/three/Operations.ts'),{WorldState}=await load('/src/features/rivals/world/WorldState.ts'),{convertSolids}=await load('/src/features/rivals/three/world3d.ts');
  const assets=new CityAssets();await assets.load();assets.humanoid=await new GLTFLoader().loadAsync('/assets/rivals/characters/universal-operative.glb');
  const op=createAssignmentOperation(0,31),city=new CityEnvironment(assets,convertSolids(new WorldState(op.level)),new T.Texture(),op.venue,op.seed);city.setQuality('low');
  const scene=new T.Scene();scene.background=new T.Color('#b6c9d5');scene.add(city.root,new T.HemisphereLight(0xe7f2ff,0x6b6350,2));const sun=new T.DirectionalLight(0xffe3ba,2.7);sun.position.set(-15,40,20);scene.add(sun);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(960,540);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  document.body.innerHTML='';document.body.style.margin='0';document.body.append(renderer.domElement);const camera=new T.PerspectiveCamera(58,960/540,.1,300);camera.position.set(98,4.5,32);camera.lookAt(121,3,32);renderer.render(scene,camera);
  Object.assign(window,{waterfrontView:(x:number,y:number,z:number)=>{camera.position.set(x,y,z);camera.lookAt(121,3,32);renderer.render(scene,camera);}});
  const audio=new OfflineAudioContext(1,22050,22050),vocals=[];for(const id of ['vocal-hurt','vocal-death-0','vocal-death-1']){const response=await fetch('/assets/rivals/combat3d/audio/'+id+'.wav');if(!response.ok)throw Error('Missing vocal '+id);const buffer=await audio.decodeAudioData(await response.arrayBuffer());vocals.push({id,seconds:buffer.duration,channels:buffer.numberOfChannels});}
  return {names:city.plan.buildings.filter((b:{name?:string})=>b.name).map((b:{name:string})=>b.name),calls:renderer.info.render.calls,vocals};
 });
 expect(result.names).toContain('HOTEL MERIDIAN');expect(result.names).toContain('THE AMBER ROOM / BAR');expect(result.calls).toBeGreaterThan(0);for(const voice of result.vocals){expect(voice.channels).toBe(1);expect(voice.seconds).toBeGreaterThan(.1);expect(voice.seconds).toBeLessThanOrEqual(1.8);}
 await page.screenshot({path:info.outputPath('open-waterfront-bridge.png')});
 await page.evaluate(()=>{(window as unknown as {waterfrontView:(x:number,y:number,z:number)=>void}).waterfrontView(117,8,60);});await page.screenshot({path:info.outputPath('hotel-and-bar-promenade.png')});expect(errors).toEqual([]);
});
