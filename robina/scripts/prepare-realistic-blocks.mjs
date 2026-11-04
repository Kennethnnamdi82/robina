// Curate complete, phototextured buildings from the supplied licensed city.
// Geometry is selected in source world space; no original file is modified.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {chromium} from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'public/assets/rivals/city');
const raw=await fs.readFile(path.join(root,'src/features/realistic_city.glb'));
const json=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString()),binaryOffset=28+raw.readUInt32LE(12);
const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
const components={5120:['getInt8',1],5121:['getUint8',1],5122:['getInt16',2],5123:['getUint16',2],5125:['getUint32',4],5126:['getFloat32',4]};
function accessor(index){const a=json.accessors[index],v=json.bufferViews[a.bufferView],type=components[a.componentType],count={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],start=binaryOffset+(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??type[1]*count;return{count:a.count,at:i=>Array.from({length:count},(_,c)=>view[type[0]](start+i*stride+c*type[1],true))};}
const sections=[
  {name:'residence',minX:99400,maxX:103800,minZ:-104500,maxZ:-101000},
  {name:'commerce',minX:92000,maxX:96800,minZ:-99400,maxZ:-96500},
  {name:'headquarters',minX:126600,maxX:132600,minZ:-115000,maxZ:-111000},
].map(s=>({...s,groups:new Map()}));
const point=new T.Vector3(),normal=new T.Vector3();
function visit(index,parent=new T.Matrix4()){
  const n=json.nodes[index],local=n.matrix?new T.Matrix4().fromArray(n.matrix):new T.Matrix4().compose(new T.Vector3().fromArray(n.translation??[0,0,0]),new T.Quaternion().fromArray(n.rotation??[0,0,0,1]),new T.Vector3().fromArray(n.scale??[1,1,1]));
  const world=parent.clone().multiply(local),normalMatrix=new T.Matrix3().getNormalMatrix(world);
  if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){
    if(p.mode!==undefined&&p.mode!==4)continue;
    const positions=accessor(p.attributes.POSITION),normals=p.attributes.NORMAL!==undefined?accessor(p.attributes.NORMAL):null,uv=p.attributes.TEXCOORD_0!==undefined?accessor(p.attributes.TEXCOORD_0):null,indices=p.indices!==undefined?accessor(p.indices):null;
    const count=indices?.count??positions.count;
    for(let i=0;i+2<count;i+=3){const ids=[0,1,2].map(j=>indices?indices.at(i+j)[0]:i+j),vertices=ids.map(id=>new T.Vector3().fromArray(positions.at(id)).applyMatrix4(world));
      for(const section of sections){if(!vertices.every(v=>v.x>=section.minX&&v.x<=section.maxX&&v.z>=section.minZ&&v.z<=section.maxZ&&v.y>780))continue;
        if(!section.groups.has(p.material))section.groups.set(p.material,{position:[],normal:[],uv:[]});const g=section.groups.get(p.material);
        const face=new T.Vector3().subVectors(vertices[1],vertices[0]).cross(new T.Vector3().subVectors(vertices[2],vertices[0])).normalize();
        ids.forEach((id,j)=>{g.position.push(...vertices[j].toArray());g.normal.push(...(normals?normal.fromArray(normals.at(id)).applyMatrix3(normalMatrix).normalize():face).toArray());g.uv.push(...(uv?uv.at(id):[0,0]));});
      }
    }
  }
  n.children?.forEach(i=>visit(i,world));
}
json.scenes[0].nodes.forEach(i=>visit(i));
const materialIds=[...new Set(sections.flatMap(s=>[...s.groups.keys()]))],grid=Math.ceil(Math.sqrt(materialIds.length)),cell=512,pad=4;
const images=new Map();for(const id of materialIds){const material=json.materials[id],texture=material.pbrMetallicRoughness?.baseColorTexture;if(!texture)continue;const image=json.images[json.textures[texture.index].source],v=json.bufferViews[image.bufferView];images.set(id,{data:raw.subarray(binaryOffset+v.byteOffset,binaryOffset+v.byteOffset+v.byteLength),mime:image.mimeType});}
const server=http.createServer((req,res)=>{const id=Number(req.url.slice(1)),image=images.get(id);if(!image){res.writeHead(404).end();return;}res.setHeader('Content-Type',image.mime);res.end(image.data);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/${images.keys().next().value}`);
  const atlas=await page.evaluate(async({grid,cell,pad,materials})=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=grid*cell;const ctx=canvas.getContext('2d');ctx.fillStyle='#8c887e';ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<materials.length;i++){const m=materials[i],x=(i%grid)*cell,y=Math.floor(i/grid)*cell;ctx.fillStyle=m.color;ctx.fillRect(x,y,cell,cell);
      if(m.image){const bitmap=await createImageBitmap(await(await fetch('/'+m.id)).blob());ctx.drawImage(bitmap,x+pad,y+pad,cell-pad*2,cell-pad*2);bitmap.close();}
      ctx.drawImage(canvas,x+pad,y+pad,1,cell-pad*2,x,y+pad,pad,cell-pad*2);ctx.drawImage(canvas,x+cell-pad-1,y+pad,1,cell-pad*2,x+cell-pad,y+pad,pad,cell-pad*2);
      ctx.drawImage(canvas,x,y+pad,cell,1,x,y,cell,pad);ctx.drawImage(canvas,x,y+cell-pad-1,cell,1,x,y+cell-pad,cell,pad);
    }
    return canvas.toDataURL('image/webp',.92).split(',')[1];
  },{grid,cell,pad,materials:materialIds.map(id=>({id,image:images.has(id),color:new T.Color().fromArray(json.materials[id].pbrMetallicRoughness?.baseColorFactor??[.65,.65,.65]).getStyle()}))});
  await fs.writeFile(path.join(output,'realistic-facades.webp'),Buffer.from(atlas,'base64'));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
const doc={asset:{version:'2.0',generator:'RIVALS source city curation',extras:json.asset.extras},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],buffers:[{byteLength:0}],bufferViews:[],accessors:[],materials:[{name:'Realistic-city-photo-atlas',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:.03,roughnessFactor:.84},doubleSided:true}],textures:[{extensions:{EXT_texture_webp:{source:0}},sampler:0}],images:[{uri:'realistic-facades.webp',mimeType:'image/webp'}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],extensionsUsed:['EXT_texture_webp'],extensionsRequired:['EXT_texture_webp']};
const chunks=[];let offset=0;
function add(values,size){const array=new Float32Array(values),data=Buffer.from(array.buffer),viewIndex=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length,target:34962});chunks.push(data);offset+=data.length;const min=Array(size).fill(Infinity),max=Array(size).fill(-Infinity);for(let i=0;i<values.length;i++){min[i%size]=Math.min(min[i%size],values[i]);max[i%size]=Math.max(max[i%size],values[i]);}const index=doc.accessors.length;doc.accessors.push({bufferView:viewIndex,componentType:5126,count:values.length/size,type:({1:'SCALAR',2:'VEC2',3:'VEC3'})[size],min,max});return index;}
const audit={source:json.asset.extras,grid,cell,pad,materials:materialIds.length,models:{}};
for(const s of sections){const bounds=new T.Box3();for(const g of s.groups.values())for(let i=0;i<g.position.length;i+=3)bounds.expandByPoint(point.fromArray(g.position,i));const center=bounds.getCenter(new T.Vector3()),pos=[],norm=[],uv=[],ids=[];
  for(const [material,g]of s.groups){for(let i=0;i<g.position.length;i+=3){pos.push(g.position[i]-center.x,g.position[i+1]-bounds.min.y,g.position[i+2]-center.z);ids.push(materialIds.indexOf(material));}norm.push(...g.normal);uv.push(...g.uv);}
  const attributes={POSITION:add(pos,3),NORMAL:add(norm,3),TEXCOORD_0:add(uv,2),_CITY_MATERIAL:add(ids,1)};const mesh=doc.meshes.length;doc.meshes.push({name:s.name,primitives:[{attributes,material:0,mode:4}]});doc.scenes[0].nodes.push(doc.nodes.length);doc.nodes.push({name:s.name,mesh});audit.models[s.name]={triangles:pos.length/9,size:bounds.getSize(new T.Vector3()).toArray()};
}
doc.buffers[0].byteLength=offset;const binary=Buffer.concat(chunks),jsonBytes=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(jsonBytes.length/4)*4,0x20);jsonBytes.copy(padded);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
await fs.writeFile(path.join(output,'realistic-blocks.glb'),Buffer.concat([header,padded,binHeader,binary]));await fs.writeFile(path.join(output,'realistic-blocks.json'),JSON.stringify(audit,null,2));
await fs.writeFile(path.join(output,'REALISTIC-CITY-CREDITS.txt'),`${json.asset.extras.title}\n${json.asset.extras.author}\n${json.asset.extras.source}\n${json.asset.extras.license}\nAdaptation: three exterior building sections curated, normalized, instanced; shared mobile texture atlas.\n`);
console.log(JSON.stringify(audit));
