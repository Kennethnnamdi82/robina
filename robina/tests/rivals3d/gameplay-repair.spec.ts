import {expect,test} from '@playwright/test';

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
