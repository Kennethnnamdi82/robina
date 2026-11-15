// Local, read-only model QA. No backend credentials, orders or payments.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {chromium} from 'playwright';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://local').pathname;
    if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/","three/":"/node_modules/three/"}}</script>');return;}
    if(!['/node_modules/','/src/features/rivals/','/src/features/rugfire/','/public/assets/'].some(p=>pathname.startsWith(p))){res.writeHead(403).end();return;}
    let file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(root+path.sep))throw Error('outside_root');
    if(!path.extname(file))file+='.ts';const source=await readFile(file);
    res.setHeader('Content-Type',file.endsWith('.ts')||file.endsWith('.js')?'text/javascript':'application/octet-stream');
    res.end(file.endsWith('.ts')?ts.transpileModule(source.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText:source);
  }catch{console.error('Model test resource unavailable:',req.url);res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage();page.on('console',message=>{if(message.type()==='error')console.error(message.text());});await page.goto('http://127.0.0.1:'+server.address().port);
  const results=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {prepareOutfit}=await import('/src/features/rivals/three/CollectionAppearance.ts');
    const {HumanoidAnimator}=await import('/src/features/rivals/three/HumanoidAnimator.ts');
    const {createActor}=await import('/src/features/rugfire/actors.ts');
    const {WeaponRig}=await import('/src/features/rivals/three/WeaponRig.ts');
    const loader=new GLTFLoader(),source=await loader.loadAsync('/public/assets/rivals/realism/field-operative.glb'),results=[];
    for(const id of ['urban','neon','shadow','cyber','crimson','golden','midnight','commander','founder']){
      const gltf=await loader.loadAsync('/public/assets/rivals/store/models/'+id+'.glb'),root=prepareOutfit(gltf.scene,id),actor=createActor('player');
      const animator=new HumanoidAnimator(actor,root,source.animations),gun=await loader.loadAsync('/public/assets/rivals/combat3d/weapons/rifle.glb'),weapon=new WeaponRig(actor,gun.scene,animator);
      const frame={vx:0,vz:1,vertical:0,grounded:true,sprinting:false,aiming:true,angle:-Math.PI/2,pov:'third',dodgeRemaining:0,dodgeSerial:0,health:100,hitSerial:0,shots:0,reload:0};
      let finite=true,maxGrip=0;
      for(let i=0;i<60;i++){frame.shots=i>30?1:0;animator.update(1/60,frame);weapon.pose(new T.Vector3(0,1.3,12),frame);root.updateMatrixWorld(true);maxGrip=Math.max(maxGrip,weapon.rightGripError);root.traverse(n=>{finite&&=n.position.toArray().every(Number.isFinite)&&n.quaternion.toArray().every(Number.isFinite);});}
      const bounds=new T.Box3().setFromObject(root),height=bounds.getSize(new T.Vector3()).y;
      if(!finite||height<1.3||height>2.8||maxGrip>.4)throw Error('Outfit validation failed: '+JSON.stringify({id,finite,height,maxGrip}));
      for(const emote of ['salute','celebration','dance','taunt','pose']){animator.update(1/60,frame);animator.poseVictory(emote,.7);}
      results.push({id,height:Number(height.toFixed(3)),maxGrip:Number(maxGrip.toFixed(3)),animated:animator.activeActions>0});animator.dispose();
      const geometries=new Set(),materials=new Set(),textures=new Set();for(const object of [root,gun.scene])object.traverse(n=>{if(n.isMesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);}});materials.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});m.dispose();});textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());
    }
    return results;
  });
  console.log(JSON.stringify({check:'actual-purchased-outfit-animation-and-grip',results}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
