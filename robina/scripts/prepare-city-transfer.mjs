import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
const before=JSON.parse(await fs.readFile('docs/rivals-3d/art-direction/smoothness-before.json','utf8'));
const urls=[...new Set([...before.resources.map(r=>r.url).filter(u=>u.endsWith('.glb')&&!u.includes('/city/models/')&&!u.endsWith('/premium/street-car.glb')),'/assets/rivals/city/optimized/city-blocks.glb','/assets/rivals/city/optimized/street-car.glb','/assets/rivals/city/living-city.glb','/assets/rivals/city/premium/delivery-truck.glb'])];
let raw=0,compressed=0;for(const url of urls){const file=path.resolve('public','.'+url),data=await fs.readFile(file),gzip=gzipSync(data,{level:9});await fs.writeFile(file+'.gz',gzip);raw+=data.length;compressed+=gzip.length;}
console.log(JSON.stringify({files:urls.length,raw,compressed},null,2));
