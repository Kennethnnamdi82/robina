// Actual GLB/rig and WebGL presentation checks. No accounts, payments or saves.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {chromium} from 'playwright';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const output=path.join(root,'test-results/cinematic');await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://local').pathname;
    if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<link rel="icon" href="data:,"><style>body{margin:0;background:#15202b}</style><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/","three/":"/node_modules/three/"}}</script>');return;}
    if(!['/node_modules/','/src/features/rivals/','/src/features/rugfire/','/public/assets/'].some(p=>pathname.startsWith(p))){res.writeHead(403).end();return;}
    let file=path.resolve(root,'.'+decodeURIComponent(pathname));
    if(!['node_modules','src/features/rivals','src/features/rugfire','public/assets'].some(base=>file.startsWith(path.join(root,base)+path.sep)))throw Error('outside_test_resources');
    if(!path.extname(file))file+='.ts';const source=await readFile(file);res.setHeader('Content-Type',file.endsWith('.ts')||file.endsWith('.js')?'text/javascript':'application/octet-stream');
    res.end(file.endsWith('.ts')?ts.transpileModule(source.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText:source);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto('http://127.0.0.1:'+server.address().port);
  const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {HumanoidAnimator}=await import('/src/features/rivals/three/HumanoidAnimator.ts'),{createActor}=await import('/src/features/rugfire/actors.ts');
    const {WeaponRig,FirstPersonWeapon}=await import('/src/features/rivals/three/WeaponRig.ts');
    const loader=new GLTFLoader(),human=await loader.loadAsync('/public/assets/rivals/realism/field-operative.glb'),weapon=await loader.loadAsync('/public/assets/rivals/combat3d/weapons/rifle.glb');
    const actor=createActor('player'),animator=new HumanoidAnimator(actor,human.scene,human.animations),gun=new WeaponRig(actor,weapon.scene,animator);
    const frame={vx:0,vz:0,vertical:0,grounded:true,sprinting:false,aiming:true,angle:-Math.PI/2,pov:'third',dodgeRemaining:0,dodgeSerial:0,health:100,hitSerial:0,shots:0,reload:0};
    for(let i=0;i<90;i++){animator.update(1/60,frame);gun.pose(new T.Vector3(0,1.35,-15),frame);}
    const joints={};for(const side of ['r','l'])for(const name of ['upperarm','lowerarm','hand','index_01','middle_01']){const n=human.scene.getObjectByName(name+'_'+side);joints[name+'_'+side]={world:n.getWorldPosition(new T.Vector3()).toArray(),local:n.position.toArray(),quaternion:n.quaternion.toArray()};}
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,760);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.setPixelRatio(1);document.body.append(renderer.domElement);
    const scene=new T.Scene();scene.background=new T.Color('#31404e');scene.add(actor.root,new T.HemisphereLight(0xddeeff,0x615d4b,2));const sun=new T.DirectionalLight(0xffedd6,3);sun.position.set(3,5,-3);scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#59636a',roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
    const camera=new T.PerspectiveCamera(48,1100/760,.025,100);camera.position.set(2.1,1.8,-2.7);camera.lookAt(0,1.3,0);renderer.render(scene,camera);
    window.cinematicQA={T,loader,renderer,scene,camera,actor,animator,gun,FirstPersonWeapon};
    return{joints,metadata:gun.metadata,grip:gun.rightGripError,support:gun.leftGripError};
  });
  if(result.grip>.001||result.support>.045)throw Error('Actual model grip failed: '+JSON.stringify(result));
  await page.screenshot({path:path.join(output,'soldier-grip.png')});
  for(const [width,height]of [[1100,760],[390,844]]){
    await page.setViewportSize({width,height});
    const fps=await page.evaluate(async({width,height})=>{
      const q=window.cinematicQA,{T,renderer,scene,camera,actor}=q;
      if(!q.view){const source=await q.loader.loadAsync('/public/assets/rivals/combat3d/weapons/rifle.glb');q.view=new q.FirstPersonWeapon(source.scene);q.viewScene=new T.Scene();q.viewScene.add(q.view.root,new T.HemisphereLight(0xddeeff,0x393d39,2));const sun=new T.DirectionalLight(0xffeedd,3);sun.position.set(1,4,2);q.viewScene.add(sun);q.viewCamera=new T.PerspectiveCamera(52,width/height,.025,8);}
      actor.root.position.set(0,0,-12);camera.position.set(0,1.62,0);camera.lookAt(0,1.62,-20);camera.aspect=width/height;camera.fov=52;camera.updateProjectionMatrix();
      q.viewCamera.aspect=width/height;q.viewCamera.updateProjectionMatrix();renderer.setSize(width,height);
      for(let i=0;i<120;i++){q.view.update(1/60,true,0,1.2);q.view.aimAt(new T.Vector3(0,0,-12));}
      renderer.render(scene,camera);renderer.autoClear=false;renderer.clearDepth();renderer.render(q.viewScene,q.viewCamera);renderer.autoClear=true;
      const sight=q.view.root.localToWorld(new T.Vector3().fromArray(q.view.sightPoint)).project(q.viewCamera);return{sight:sight.toArray(),hands:q.view.handMeshCount};
    },{width,height});
    if(Math.abs(fps.sight[0])>.005||Math.abs(fps.sight[1])>.005)throw Error('Actual ADS alignment failed');
    await page.screenshot({path:path.join(output,`fps-ads-${width}x${height}.png`)});
  }
  await page.setViewportSize({width:1100,height:760});
  const effects=await page.evaluate(async()=>{
    const q=window.cinematicQA,{T,scene,renderer,camera,actor}=q,{CombatEffects}=await import('/src/features/rivals/three/CombatEffects.ts'),{WorldFires}=await import('/src/features/rivals/three/WorldFires.ts');
    const loader=new T.TextureLoader(),[flash,smoke,blast]=await Promise.all(['flash','smoke','blast'].map(id=>loader.loadAsync('/public/assets/rivals/combat3d/fx/'+id+'.webp')));
    const fx=new CombatEffects({flash,smoke,blast}),fires=new WorldFires({smoke,blast});scene.add(fx.root,fires.root);actor.root.position.set(3,0,-5);renderer.setSize(1100,760);camera.aspect=1100/760;camera.fov=52;camera.position.set(7,4,8);camera.lookAt(0,1,-5);camera.updateProjectionMatrix();
    const point=new T.Vector3(0,.3,-5);fx.blast(point,7,[]);fx.age(.18);fires.blast(point,7,[]);fires.step(.18,[]);fires.draw(camera,.18,new T.Vector3());renderer.render(scene,camera);q.fx=fx;q.fires=fires;return fx.snapshot();
  });
  await page.screenshot({path:path.join(output,'grenade-impact.png')});
  await page.evaluate(()=>{const q=window.cinematicQA;q.fx.age(2);q.fires.step(2,[]);q.fires.draw(q.camera,2.18,new q.T.Vector3());q.renderer.render(q.scene,q.camera);});
  await page.screenshot({path:path.join(output,'grenade-aftermath.png')});
  if(effects.cinematic.shockwaves!==1)throw Error('Rendered explosion did not contain its shockwave');
  console.log(JSON.stringify({check:'actual-soldier-and-fps-models',grip:result.grip,support:result.support,views:['soldier','landscape ADS','portrait ADS']}));
  if(errors.length)throw Error(errors.join('\n'));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
