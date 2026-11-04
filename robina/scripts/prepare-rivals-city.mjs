// Repackage selected supplied glTFs as GLBs, sharing mobile-sized WebP textures.
// Source packs are read only. No network downloads or new dependencies.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public/assets/rivals/city');
const city = 'Exports/glTF (Godot)/', sci = 'Modular SciFi MegaKit[Standard]/glTF/';
const choices = {
  residence: city+'Building_Small_1', commerce: city+'Building_Medium_2_001', headquarters: city+'Building_Large_2',
  street: city+'Street_2Lane', sidewalk: city+'Sidewalk_Straight_3m', planter: city+'Prop_Planter_Single',
  drain: city+'Prop_Drain', ac: city+'Prop_ACUnit', bollard: city+'Prop_Bollard',
  wall: sci+'Walls/WallAstra_Straight', window: sci+'Walls/WallWindow_Straight',
  computer: sci+'Props/Prop_Computer', access: sci+'Props/Prop_AccessPoint',
  vent: sci+'Props/Prop_Vent_Wide', rail: sci+'Props/Prop_Rail_3', barrel: sci+'Props/Prop_Barrel_Large',
  crate: sci+'Props/Prop_Crate3',
  platform: sci+'Platforms/Platform_Metal2',
};
await fs.mkdir(path.join(output,'models'),{recursive:true});
await fs.mkdir(path.join(output,'textures'),{recursive:true});
const inputs = new Map();
const manifest = { license:'CC0-1.0', sources:{ city:'https://quaternius.com/packs/downtowncitymegakit.html', sciFi:'src/features/Modular SciFi MegaKit[Standard]/License_Standard.txt' }, models:{}, textures:{} };
const server = http.createServer(async(req,res)=>{
  try { if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<link rel="icon" href="data:,">');return;}
    const input=inputs.get(decodeURIComponent(req.url.slice(1)));if(!input){res.writeHead(404).end();return;}res.end(await fs.readFile(input));
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  for(const [id,source] of Object.entries(choices)){
    const file=path.join(root,'src/features',source+'.gltf'),json=JSON.parse(await fs.readFile(file,'utf8'));
    const isSci=source.startsWith('Modular');
    for(const image of json.images??[]){
      const name=path.basename(image.uri),key=(isSci?'sci-':'city-')+name.replace(/\.(png|jpg)$/i,'.webp');
      if(!manifest.textures[key]){
        const input=path.join(root,'src/features',isSci?'Modular SciFi MegaKit[Standard]/Textures':'Textures',name);
        inputs.set(key,input);
        const result=await page.evaluate(async({key,max})=>{
          const blob=await(await fetch('/'+encodeURIComponent(key))).blob(),bitmap=await createImageBitmap(blob);
          const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
          canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
          const url=canvas.toDataURL('image/webp',.88);bitmap.close();return{data:url.split(',')[1],width:canvas.width,height:canvas.height};
        },{key,max:/ORM/i.test(name)?256:512});
        const data=Buffer.from(result.data,'base64');await fs.writeFile(path.join(output,'textures',key),data);
        manifest.textures[key]={bytes:data.length,width:result.width,height:result.height,sha256:createHash('sha256').update(data).digest('hex')};
      }
      image.uri='../textures/'+key;image.mimeType='image/webp';
    }
    // WebP is a glTF extension, not a core PNG/JPEG image format.
    json.extensionsUsed=[...new Set([...(json.extensionsUsed??[]),'EXT_texture_webp'])];
    json.extensionsRequired=[...new Set([...(json.extensionsRequired??[]),'EXT_texture_webp'])];
    for(const texture of json.textures??[]){texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;}
    if(['residence','commerce','headquarters'].includes(id))for(const mesh of json.meshes)mesh.primitives=mesh.primitives.filter(p=>!/InteriorWall|InteriorFloor/.test(json.materials[p.material]?.name));
    if(json.buffers.length!==1)throw new Error('Expected one source geometry buffer: '+id);
    const bin=await fs.readFile(path.join(path.dirname(file),json.buffers[0].uri));delete json.buffers[0].uri;
    const raw=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(raw.length/4)*4,0x20);raw.copy(padded);
    const binary=Buffer.alloc(Math.ceil(bin.length/4)*4);bin.copy(binary);
    const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
    const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
    const packed=Buffer.concat([header,padded,binHeader,binary]);await fs.writeFile(path.join(output,'models',id+'.glb'),packed);
    const triangles=json.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+(json.accessors[p.indices??p.attributes.POSITION].count/3),0);
    manifest.models[id]={source,bytes:packed.length,triangles,sha256:createHash('sha256').update(packed).digest('hex')};
    console.log('Prepared',id,packed.length,'bytes',triangles,'triangles');
  }
  await fs.copyFile(path.join(root,'src/features/Modular SciFi MegaKit[Standard]/License_Standard.txt'),path.join(output,'SCIFI-LICENSE.txt'));
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log('Shared textures:',Object.keys(manifest.textures).length,'Total prepared bytes:',Object.values(manifest.models).concat(Object.values(manifest.textures)).reduce((n,a)=>n+a.bytes,0));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
