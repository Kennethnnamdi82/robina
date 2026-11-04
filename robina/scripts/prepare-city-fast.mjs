// Offline only: retain source geometry, atlas materials, merge render parts.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'public/assets/rivals/city/optimized');await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>');return;}const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(file.endsWith('.js'))res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage();page.on('pageerror',e=>console.error(e));await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.exposeFunction('save',async(name,base64,audit)=>{await fs.writeFile(path.join(out,name+'.glb'),Buffer.from(base64,'base64'));await fs.writeFile(path.join(out,name+'.json'),JSON.stringify(audit,null,2));console.log(name,audit);});
 await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),{GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'),{mergeGeometries,mergeVertices}=await import('/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js');
  const loader=new GLTFLoader(),exporter=new GLTFExporter(),save=async(name,root,audit)=>{const data=await exporter.parseAsync(root,{binary:true,maxTextureSize:2048});const b64=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob([data]));});await window.save(name,b64,{...audit,bytes:data.byteLength});};
  const ids=['residence','commerce','headquarters'],sources=[];for(const id of ids)sources.push((await loader.loadAsync('/public/assets/rivals/city/models/'+id+'.glb')).scene);
  const materials=new Map();for(const root of sources)root.traverse(n=>{if(n.isMesh){const m=n.material;if(Array.isArray(m))throw Error('Unexpected multi-material building');if(!materials.has(m.name))materials.set(m.name,m);}});
  const grid=Math.ceil(Math.sqrt(materials.size)),tile=512,gutter=4,size=grid*tile;
  const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;},albedo=canvas(),normal=canvas(),orm=canvas(),tiles=new Map();
  const scratch=document.createElement('canvas');scratch.width=scratch.height=tile;const sc=scratch.getContext('2d',{willReadFrequently:true});
  let index=0;for(const [name,m]of materials){const col=index%grid,row=Math.floor(index/grid);tiles.set(name,[col,row]);index++;
   const fill=(target,texture,color)=>{const c=target.getContext('2d');c.fillStyle=color;c.fillRect(col*tile,row*tile,tile,tile);if(texture?.image)c.drawImage(texture.image,col*tile+gutter,row*tile+gutter,tile-gutter*2,tile-gutter*2);};
   const color=m.color.clone();if(/glass/i.test(name))color.set(0x47616b);color.convertLinearToSRGB();fill(albedo,m.map,'#'+color.getHexString(T.LinearSRGBColorSpace));
   fill(normal,m.normalMap,'rgb(128,128,255)');
   const pixels=sc.createImageData(tile,tile),maps={};for(const slot of ['aoMap','roughnessMap','metalnessMap']){if(m[slot]?.image){sc.clearRect(0,0,tile,tile);sc.drawImage(m[slot].image,0,0,tile,tile);maps[slot]=sc.getImageData(0,0,tile,tile).data;}}
   for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=maps.aoMap?.[i]??255;pixels.data[i+1]=Math.max(40,(maps.roughnessMap?.[i+1]??255)*(m.roughness??.8));pixels.data[i+2]=(maps.metalnessMap?.[i+2]??255)*(m.metalness??0);pixels.data[i+3]=255;}
   sc.putImageData(pixels,0,0);orm.getContext('2d').drawImage(scratch,col*tile+gutter,row*tile+gutter,tile-gutter*2,tile-gutter*2);
  }
  const tex=(c,srgb=false)=>{const t=new T.CanvasTexture(c);t.flipY=false;if(srgb)t.colorSpace=T.SRGBColorSpace;t.userData.mimeType='image/webp';return t;},map=tex(albedo,true),normalMap=tex(normal),ormMap=tex(orm);
  const opaque=new T.MeshStandardMaterial({map,normalMap,roughnessMap:ormMap,metalnessMap:ormMap,aoMap:ormMap,roughness:1,metalness:1});opaque.name='CityAtlas-Masonry';opaque.userData.cityAtlas={grid,tile,gutter};
  const windowMaterial=opaque.clone();windowMaterial.name='CityAtlas-FakeInterior';windowMaterial.emissive.set(0xffffff);windowMaterial.emissiveMap=map;windowMaterial.emissiveIntensity=.12;
  const packed=new T.Group(),audit={materials:materials.size,atlasSize:size,buildings:[]};
  for(const [i,source]of sources.entries()){
   source.updateMatrixWorld(true);const groups=new Map();let triangles=0;
   source.traverse(n=>{if(!n.isMesh)return;const m=n.material,mat=/FakeInterior/.test(m.name)?windowMaterial:opaque,g=n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone();g.applyMatrix4(n.matrixWorld);
    for(const key of Object.keys(g.attributes))if(!['position','normal','uv','uv1'].includes(key))g.deleteAttribute(key);
    if(!g.getAttribute('uv1'))g.setAttribute('uv1',g.getAttribute('uv').clone());
    if(n.matrixWorld.determinant()<0)for(const a of Object.values(g.attributes))for(let k=0;k<a.count;k+=3)for(let c=0;c<a.itemSize;c++){const v=a.getComponent(k+1,c);a.setComponent(k+1,c,a.getComponent(k+2,c));a.setComponent(k+2,c,v);}
    const tileUV=new Float32Array(g.getAttribute('position').count*2),t=tiles.get(m.name);for(let k=0;k<tileUV.length;k+=2){tileUV[k]=t[0];tileUV[k+1]=t[1];}g.setAttribute('_citytile',new T.BufferAttribute(tileUV,2));
    if(!groups.has(mat))groups.set(mat,[]);groups.get(mat).push(g);
   });
   const building=new T.Group();building.name=ids[i];for(const [material,list]of groups){const geometry=mergeVertices(mergeGeometries(list));triangles+=(geometry.index?.count??geometry.getAttribute('position').count)/3;building.add(new T.Mesh(geometry,material));}packed.add(building);audit.buildings.push({id:ids[i],triangles,draws:groups.size});
  }
  // Include only props that the playable district actually instantiates.
  for(const id of ['planter','ac','computer','vent','barrel','crate','platform']){const source=(await loader.loadAsync('/public/assets/rivals/city/models/'+id+'.glb')).scene;source.name=id;packed.add(source);}
  await save('city-blocks',packed,audit);
  // Consolidate equivalent neutral exterior materials, preserving the shape,
  // paint response, distinct glass, emissive lights and four wheel pivots.
  const car=(await loader.loadAsync('/public/assets/rivals/city/premium/street-car.glb')).scene;car.updateMatrixWorld(true);const result=new T.Group(),byPart=new Map(),carMaterials=new Map();
  car.traverse(n=>{if(!n.isMesh)return;let joint=n;while(joint&&!joint.userData.cityWheel)joint=joint.parent;const part=joint?.name??'body',original=n.material,paint=original.userData.trafficPaint,glass=/glass/.test(original.name),lights=/light/.test(original.name),kind=paint?'paint':glass?'glass':lights?original.name:'trim';
   let material=carMaterials.get(kind);if(!material){material=original.clone();material.name='premium-'+kind;if(kind==='trim'){material.map=null;material.normalMap=null;material.roughnessMap=null;material.metalnessMap=null;material.aoMap=null;material.roughness=.55;material.metalness=.35;material.color.set(0xffffff);material.vertexColors=true;}carMaterials.set(kind,material);}
   const center=joint?.getWorldPosition(new T.Vector3())??new T.Vector3(),g=n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone();g.applyMatrix4(n.matrixWorld);if(joint)g.translate(-center.x,-center.y,-center.z);
   for(const key of Object.keys(g.attributes))if(!['position','normal','uv','uv1'].includes(key))g.deleteAttribute(key);for(const key of ['uv','uv1'])if(!g.getAttribute(key))g.setAttribute(key,new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));
   if(kind==='trim'){const colors=new Float32Array(g.getAttribute('position').count*3);for(let k=0;k<colors.length;k+=3){colors[k]=original.color.r;colors[k+1]=original.color.g;colors[k+2]=original.color.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));}
   const key=part+'|'+kind;if(!byPart.has(key))byPart.set(key,{part,material,center,wheel:Boolean(joint),list:[]});byPart.get(key).list.push(g);
  });
  const {SimplifyModifier}=await import('/node_modules/three/examples/jsm/modifiers/SimplifyModifier.js');
  const parts=new Map();let triangles=0;for(const batch of byPart.values()){let part=parts.get(batch.part);if(!part){part=new T.Group();part.name=batch.part;if(batch.wheel){part.userData.cityWheel=true;part.position.copy(batch.center);}result.add(part);parts.set(batch.part,part);}let geometry=mergeVertices(mergeGeometries(batch.list));if(geometry.getAttribute('position').count>400)geometry=await new SimplifyModifier().modify(geometry,Math.floor(geometry.getAttribute('position').count*.58));triangles+=(geometry.index?.count??geometry.getAttribute('position').count)/3;part.add(new T.Mesh(geometry,batch.material));}
  await save('street-car',result,{triangles,drawParts:byPart.size,materials:carMaterials.size,wheels:[...parts.values()].filter(p=>p.userData.cityWheel).length});
 });
}finally{await browser?.close();await new Promise(r=>server.close(r));}
