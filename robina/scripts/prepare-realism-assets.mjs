// Curate user-supplied models without changing physics or the source artwork.
// Outputs are deterministic, self-contained GLBs; no model CDN at runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,inflateRawSync} from 'node:zlib';
import {chromium} from '@playwright/test';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const output=path.join(root,'public/assets/rivals/realism');
await fs.mkdir(output,{recursive:true});
const raw=path.join(root,'.tools/realism-materials');await fs.mkdir(raw,{recursive:true});
const sources={asphalt:'Asphalt001',paving:'PavingStones152',brick:'Bricks101',concrete:'Concrete049'};
const records=[];
// Read ZIP central entries, including archives using data descriptors. Never
// extract archive paths: only three known image roles enter our output folder.
function mapsFromZip(buffer){
 let end=buffer.length-22;while(end>=Math.max(0,buffer.length-65557)&&buffer.readUInt32LE(end)!==0x06054b50)end--;
 if(end<0)throw Error('Invalid material ZIP');
 const maps={};let at=buffer.readUInt32LE(end+16);
 for(let i=0;i<buffer.readUInt16LE(end+10);i++){
  if(buffer.readUInt32LE(at)!==0x02014b50)throw Error('Invalid ZIP directory');
  const method=buffer.readUInt16LE(at+10),bytes=buffer.readUInt32LE(at+20),size=buffer.readUInt32LE(at+24),length=buffer.readUInt16LE(at+28),extra=buffer.readUInt16LE(at+30),comment=buffer.readUInt16LE(at+32),offset=buffer.readUInt32LE(at+42),name=buffer.toString('utf8',at+46,at+46+length);
  at+=46+length+extra+comment;
  const role=name.endsWith('_Color.jpg')?'color':name.endsWith('_NormalGL.jpg')?'normal':name.endsWith('_Roughness.jpg')?'roughness':null;
  if(!role)continue;if(size>25*1024*1024)throw Error('Oversized material entry');
  const start=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28),compressed=buffer.subarray(start,start+bytes);
  const data=method===8?inflateRawSync(compressed,{maxOutputLength:25*1024*1024}):method===0?compressed:null;
  if(!data||data.length!==size||data[0]!==255||data[1]!==216)throw Error('Invalid material image');
  maps[role]=data;
 }
 if(Object.keys(maps).length!==3)throw Error('Material is missing required PBR maps');return maps;
}
if(!process.argv.includes('--offline'))for(const [role,id]of Object.entries(sources)){
 if(process.argv.includes('--asphalt-only')&&role!=='asphalt')continue;
 const url=`https://ambientcg.com/get?file=${id}_2K-JPG.zip`;
 try{
  console.log('Fetching',id);
  const response=await fetch(url,{signal:AbortSignal.timeout(120000),headers:{'User-Agent':'RIVALS-Asset-Preparation/1.0'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  const buffer=Buffer.from(await response.arrayBuffer());if(buffer.length>100*1024*1024)throw Error('Oversized archive');
  const maps=mapsFromZip(buffer);for(const [name,data]of Object.entries(maps))await fs.writeFile(path.join(raw,`${role}-${name}.jpg`),data);
  records.push({role,id,url,license:'CC0-1.0',sha256:createHash('sha256').update(buffer).digest('hex')});
 }catch(error){throw Error(`Material preparation failed (${id}): ${error.message}. Use --offline only if prepared maps already exist.`);}
}
if(records.length){let previous=[];try{previous=JSON.parse(await fs.readFile(path.join(output,'material-sources.json'),'utf8'));}catch{}await fs.writeFile(path.join(output,'material-sources.json'),JSON.stringify([...previous.filter(p=>!records.some(r=>r.role===p.role)),...records],null,2)+'\n');}
for(const family of ['wood','stucco'])for(const [name,file]of Object.entries({color:'basecolor',normal:'normal',roughness:'roughness'}))await fs.copyFile(path.join(root,'src/features/RIVALS_Premium_Urban_Showcase_v2/assets/materials',family,file+'.jpg'),path.join(raw,family+'-'+name+'.jpg'));
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>');return;}
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(file.endsWith('.js'))res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage();page.on('console',m=>console.log(m.text()));
 await page.exposeFunction('saveAsset',async(name,data,audit)=>{
  const buffer=Buffer.from(data,'base64');await fs.writeFile(path.join(output,name+'.glb'),buffer);await fs.writeFile(path.join(output,name+'.glb.gz'),gzipSync(buffer,{level:9}));
  await fs.writeFile(path.join(output,name+'.json'),JSON.stringify({...audit,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')},null,2)+'\n');console.log('Prepared',name,buffer.length);
 });
 await page.goto('http://127.0.0.1:'+server.address().port);
 // Bounded 2K PBR textures. Source archives can contain larger maps despite
 // their selected download resolution; never silently ship 8K normal maps.
 for(const role of [...Object.keys(sources),'wood','stucco'])for(const name of ['color','normal','roughness']){
  const data=await page.evaluate(async({role,name})=>{const image=await createImageBitmap(await(await fetch(`/.tools/realism-materials/${role}-${name}.jpg`)).blob()),canvas=document.createElement('canvas'),scale=Math.min(1,2048/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();return canvas.toDataURL('image/webp',name==='normal'?.98:.94).split(',')[1];},{role,name});
  await fs.writeFile(path.join(output,`${role}-${name}.webp`),Buffer.from(data,'base64'));
 }
 if(process.argv.includes('--materials-only')){await browser.close();browser=undefined;await new Promise(resolve=>server.close(resolve));process.exit(0);}
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),{GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
  const {MeshoptDecoder}=await import('/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js');
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),exporter=new GLTFExporter();
  async function save(name,scene,animations,audit){const buffer=await exporter.parseAsync(scene,{binary:true,animations,maxTextureSize:2048});const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob([buffer]));});await window.saveAsset(name,data,audit);}
  const pack='/src/features/RIVALS_Premium_Urban_Showcase_v2/assets/models/';
  const district=new T.Group();district.name='Curated urban showcase';
  // Split material-batched geometry into six independent, cullable buildings.
  // Original pack coordinates are NOT compatible with the game's road grid.
  async function split(file,centers,prefix){
   const gltf=await loader.loadAsync(pack+file+'.glb');gltf.scene.updateMatrixWorld(true);
   const groups=centers.map((p,i)=>{const g=new T.Group();g.name=prefix+i;district.add(g);return g;});
   gltf.scene.traverse(node=>{
    if(!node.isMesh)return;const geo=node.geometry.index?node.geometry.toNonIndexed():node.geometry,vertices=geo.getAttribute('position'),lists=centers.map(()=>[]),point=new T.Vector3();
    for(let i=0;i<vertices.count;i+=3){point.set(0,0,0);for(let k=0;k<3;k++)point.add(new T.Vector3().fromBufferAttribute(vertices,i+k).applyMatrix4(node.matrixWorld));point.divideScalar(3);let best=0,distance=Infinity;centers.forEach((p,j)=>{const d=(point.x-p[0])**2+(point.z-p[1])**2;if(d<distance){best=j;distance=d;}});lists[best].push(i,i+1,i+2);}
    lists.forEach((indices,j)=>{
     if(!indices.length)return;const geometry=new T.BufferGeometry();for(const [key,a]of Object.entries(geo.attributes)){const data=[];for(const index of indices)for(let k=0;k<a.itemSize;k++)data.push(a.getComponent(index,k));geometry.setAttribute(key,new T.Float32BufferAttribute(data,a.itemSize));}
     geometry.applyMatrix4(node.matrixWorld);geometry.translate(-centers[j][0],0,-centers[j][1]);
     const mesh=new T.Mesh(geometry,node.material);mesh.name=prefix+j+'-'+node.material.name;mesh.castShadow=mesh.receiveShadow=true;groups[j].add(mesh);
    });
   });
   return groups;
  }
  await split('premium_signature_city_facades',[[-28,-32],[-49,-41],[27,-34],[48,-39],[27,36],[49,42]],'facade-');
  await split('premium_street_cafe_props',[[-12,25],[13,27],[-13,-23],[12,-26]],'cafe-');
  await split('premium_parkway_palms',[[-11,-50],[11,-50],[-11,51],[11,48],[39,-10],[-39,10],[40,10],[-39,-10],[59,54],[-59,-53]],'palm-');
  const skyline=(await loader.loadAsync(pack+'premium_distant_skyline.glb')).scene;skyline.name='showcase-skyline';district.add(skyline);
  await save('urban-showcase',district,[],{source:'RIVALS_Premium_Urban_Showcase_v2',purpose:'Six footprint-normalized facades, four cafe sets, ten palms and distant skyline; no gameplay entities'});

  // Real textured military body, retargeted to the established naming/socket
  // contract. Animation clips/controllers/rules remain the existing game's.
  const [source,target]=await Promise.all([loader.loadAsync('/public/assets/rivals/characters/universal-operative.glb'),loader.loadAsync('/src/features/Military_Male_03.glb')]);
  const names={'Bip01':'root','Bip01_Pelvis':'pelvis','Bip01_Spine':'spine_01','Bip01_Spine1':'spine_02','Bip01_Spine2':'spine_03','Bip01_Neck':'neck_01','Bip01_Head':'Head'};
  // GLTFLoader sanitizes spaces to underscores in node names.
  for(const side of ['L','R']){const s=side.toLowerCase();for(const [from,to]of Object.entries({'Clavicle':'clavicle','UpperArm':'upperarm','Forearm':'lowerarm','Hand':'hand','Thigh':'thigh','Calf':'calf','Foot':'foot','Toe0':'ball'}))names[`Bip01_${side}_${from}`]=`${to}_${s}`;for(const [n,digit]of ['thumb','index','middle','ring','pinky'].entries())for(let j=0;j<3;j++)names[`Bip01_${side}_Finger${n}${j||''}`]=`${digit}_0${j+1}_${s}`;}
  const sourceBones=new Map();source.scene.traverse(n=>{if(n.isBone)sourceBones.set(n.name,n);});
  target.scene.traverse(n=>{const key=n.name.replace(/ /g,'_');if(names[key])n.name=names[key];});
  // Normalize target before sampling rest-space deltas. Preserve its skin bind.
  const bounds=new T.Box3().setFromObject(target.scene),size=bounds.getSize(new T.Vector3());
  const wrapper=new T.Group();wrapper.name='RivalsFieldOperative';wrapper.add(target.scene);target.scene.scale.multiplyScalar(1.78/size.y);target.scene.position.y=-bounds.min.y*target.scene.scale.x;wrapper.updateMatrixWorld(true);
  const bones=[];target.scene.traverse(n=>{if(n.isBone&&sourceBones.has(n.name))bones.push(n);});
  for(const required of ['pelvis','spine_01','spine_03','Head','hand_r','hand_l','thigh_l','thigh_r'])if(!bones.some(b=>b.name===required))throw Error('Missing military bone '+required);
  const rest=new Map(bones.map(b=>[b.name,{position:b.position.clone(),quaternion:b.quaternion.clone(),world:b.getWorldQuaternion(new T.Quaternion())}]));
  source.scene.updateMatrixWorld(true);const inverseRest=new Map([...sourceBones].map(([name,b])=>[name,b.getWorldQuaternion(new T.Quaternion()).invert()]));
  const sourceHip=sourceBones.get('pelvis'),targetHip=bones.find(b=>b.name==='pelvis'),sourceHeight=sourceHip.getWorldPosition(new T.Vector3()).y,sourceHipRest=sourceHip.getWorldPosition(new T.Vector3()),clips=[];
  for(const clip of source.animations){
   const mixer=new T.AnimationMixer(source.scene),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
   const times=[],rotations=new Map(bones.map(b=>[b.name,[]])),positions=[];
   for(let frame=0;frame<=Math.ceil(clip.duration*30);frame++){
    const time=Math.min(frame/30,clip.duration);times.push(time);mixer.setTime(time);source.scene.updateMatrixWorld(true);
    targetHip.position.copy(rest.get('pelvis').position);const delta=new T.Vector3(0,(sourceHip.getWorldPosition(new T.Vector3()).y-sourceHipRest.y)*1.0,0);targetHip.parent.worldToLocal(delta.add(targetHip.parent.getWorldPosition(new T.Vector3())));targetHip.position.add(delta);
    for(const bone of bones){
     const rotation=sourceBones.get(bone.name).getWorldQuaternion(new T.Quaternion()).multiply(inverseRest.get(bone.name)).multiply(rest.get(bone.name).world),parent=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();bone.quaternion.copy(parent.multiply(rotation)).normalize();bone.updateMatrixWorld(true);
     const q=bone.quaternion,values=rotations.get(bone.name),sign=values.length&&q.x*values.at(-4)+q.y*values.at(-3)+q.z*values.at(-2)+q.w*values.at(-1)<0?-1:1;values.push(q.x*sign,q.y*sign,q.z*sign,q.w*sign);
    }
    positions.push(...targetHip.position.toArray());
   }
   clips.push(new T.AnimationClip(clip.name,clip.duration,[...bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,rotations.get(b.name))),new T.VectorKeyframeTrack('pelvis.position',times,positions)]).optimize());
   mixer.stopAllAction();mixer.uncacheRoot(source.scene);source.scene.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.pose();});for(const b of bones){b.position.copy(rest.get(b.name).position);b.quaternion.copy(rest.get(b.name).quaternion);}wrapper.updateMatrixWorld(true);
  }
  let triangles=0;target.scene.traverse(n=>{if(!n.isMesh)return;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;for(const m of Array.isArray(n.material)?n.material:[n.material]){m.roughness=.8;m.metalness=/equipment|pistol/i.test(m.name)?.12:0;m.envMapIntensity=.85;}});
  await save('field-operative',wrapper,clips,{source:'User-supplied src/features/Military_Male_03.glb',animationSource:'Existing CC0 universal-operative.glb',height:1.78,triangles,bones:bones.map(b=>b.name),clips:clips.map(c=>c.name),license:'Military model supplied by project owner; upstream redistribution rights must be confirmed before public release.'});
 });
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
