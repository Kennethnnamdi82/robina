import {expect,test} from '@playwright/test';

test('real driving controls have separate touch targets on small phones',async({page},info)=>{
  await page.route('**/tests/rivals3d/entry.tsx',r=>r.fulfill({contentType:'application/javascript',body:''}));await page.goto('/tests/rivals3d/index.html');
  await page.evaluate(async()=>{
    const load=(url:string)=>import(/* @vite-ignore */url);
    for(const url of ['/src/features/rivals/rivals.css','/src/features/rivals/three/sandbox.css','/src/features/rivals/three/command-hud.css'])await load(url);
    const React=(await load('/node_modules/.vite-rivals3d/deps/react.js')).default,{createRoot}=(await load('/node_modules/.vite-rivals3d/deps/react-dom_client.js')).default,{DrivingControls}=await load('/src/features/rivals/three/SoldierHUD.tsx');
    document.body.innerHTML='<main class="rivals-shell r3-shell"><section class="rivals-game-view r3-game"><div id="driving-fixture"></div></section></main>';
    createRoot(document.getElementById('driving-fixture')).render(React.createElement(DrivingControls,{runtime:{vehicles:{snapshot:{speed:0,kind:'sedan',health:200}},setDriving:()=>{},vehicleInteract:()=>{}},disabled:false}));
  });
  await expect(page.getByRole('button',{name:'Accelerate vehicle'})).toBeVisible();
  for(const [width,height]of [[320,568],[320,740],[390,844],[568,320],[667,375],[844,390]]){
    await page.setViewportSize({width,height});
    const invalid=await page.locator('.r3-driving-controls').evaluate(root=>{const frame=root.getBoundingClientRect(),targets=[...root.querySelectorAll('button,.rivals-stick')].map(n=>({name:n.getAttribute('aria-label')??n.textContent,r:n.getBoundingClientRect()}));return targets.filter(({r},i)=>r.width<48||r.height<44||r.left<frame.left||r.right>frame.right+1||r.top<frame.top||r.bottom>frame.bottom+1||targets.some((other,j)=>i!==j&&r.left<other.r.right&&r.right>other.r.left&&r.top<other.r.bottom&&r.bottom>other.r.top)).map(n=>n.name);});
    const layout=await page.locator('.r3-driving-controls').evaluate(root=>[...root.querySelectorAll('button,.rivals-stick')].map(n=>({name:n.getAttribute('aria-label')??n.textContent,bottom:getComputedStyle(n).bottom,rect:n.getBoundingClientRect().toJSON()})));
    expect(invalid,`${width}x${height} touch targets: ${JSON.stringify(layout)}`).toEqual([]);
  }
  await page.setViewportSize({width:320,height:568});await page.screenshot({path:info.outputPath('small-phone-driving-controls.png')});
});

test('original score renders stereo audio with pursuit layers and no old ambient download',async({page})=>{
  await page.route('**/tests/rivals3d/entry.tsx',r=>r.fulfill({contentType:'application/javascript',body:''}));await page.goto('/tests/rivals3d/index.html');
  const result=await page.evaluate(async()=>{
    const path='/src/features/rivals/three/HeistScore.ts',{HeistScore}=await import(path),settingsPath='/src/features/rivals/core/settings.ts',{defaultSettings}=await import(settingsPath);
    const context=new OfflineAudioContext(2,44100*2,44100),score=new HeistScore(context,{...defaultSettings(),muted:false,masterVolume:1,musicVolume:.7});score.setAlert(true);const buffer=await context.startRendering();score.dispose();let peak=0,energy=0;const left=buffer.getChannelData(0),right=buffer.getChannelData(1);for(let i=0;i<left.length;i++){peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));energy+=left[i]*left[i];}return{peak,rms:Math.sqrt(energy/left.length),channels:buffer.numberOfChannels};
  });
  expect(result.channels).toBe(2);expect(result.peak).toBeGreaterThan(.05);expect(result.peak).toBeLessThan(.95);expect(result.rms).toBeGreaterThan(.01);
});

test('authored civilian terminal fall and persistent surface fire render without shader errors',async({page},info)=>{
  test.setTimeout(120000);const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader|WebGLProgram|GL_INVALID/.test(m.text()))errors.push(m.text());});
  await page.route('**/tests/rivals3d/entry.tsx',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await page.goto('/tests/rivals3d/index.html');
  const result=await page.evaluate(async()=>{
    // Import production renderers through the dedicated Vite sandbox only;
    // this fixture does not expose mutation hooks in the shipped game.
    const load=(path:string)=>import(/* @vite-ignore */path);
    const T=await load('/node_modules/three/build/three.module.js'),{GLTFLoader}=await load('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),{CityPeople}=await load('/src/features/rivals/three/CityPeople.ts'),{WorldFires}=await load('/src/features/rivals/three/WorldFires.ts');
    const source=await new GLTFLoader().loadAsync('/assets/rivals/characters/universal-operative.glb'),crowd=new CityPeople(source);
    crowd.setQuality('high');
    const base={route:[],target:0,speed:0,yaw:0,crossing:false,panicUntil:0,idleUntil:0,distance:0,moving:false,motion:0};
    const scene=new T.Scene();scene.background=new T.Color('#283541');scene.add(crowd.root,new T.HemisphereLight(0xcfe4ff,0x5b5348,3));const sun=new T.DirectionalLight(0xffe0bb,4);sun.position.set(-3,7,4);scene.add(sun);
    const ground=new T.Mesh(new T.PlaneGeometry(22,22),new T.MeshStandardMaterial({color:0x42484c,roughness:.95}));ground.rotation.x=-Math.PI/2;scene.add(ground);
    const wall=new T.Mesh(new T.BoxGeometry(4,3,.6),new T.MeshStandardMaterial({color:0x777269,roughness:1}));wall.position.set(3,1.5,-2);scene.add(wall);
    const textures=new T.TextureLoader(),fires=new WorldFires({blast:await textures.loadAsync('/assets/rivals/combat3d/fx/blast.webp'),smoke:await textures.loadAsync('/assets/rivals/combat3d/fx/smoke.webp')});scene.add(fires.root);
    fires.blast(new T.Vector3(3,.3,-1.5),7,[{id:'wall',kind:'wall',enabled:true,box:new T.Box3().setFromObject(wall)}]);fires.step(2,[]);
    const camera=new T.PerspectiveCamera(45,1000/650,.05,100);camera.position.set(5,4.5,9);camera.lookAt(.8,.7,-.5);camera.updateMatrixWorld(true);
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1000,650);renderer.setPixelRatio(1);document.body.replaceChildren(renderer.domElement);
    document.body.style.margin='0';crowd.draw([{...base,x:-2,z:0},{...base,x:0,z:0,health:0,deathAge:3}],2,3,camera);fires.draw(camera,2,new T.Vector3());await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
    return{people:crowd.rendered,fires:fires.snapshot,draws:renderer.info.render.calls,deathClip:source.animations.find((c:{name:string})=>c.name==='Death01')?.duration};
  });
  expect(result.people).toBe(2);expect(result.deathClip).toBeGreaterThan(0);expect(result.fires.buildings).toBe(1);expect(result.draws).toBeGreaterThan(3);expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('civilian-fall-and-surface-fire.png')});
});
