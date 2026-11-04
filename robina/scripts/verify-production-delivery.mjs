import {readFileSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
const origin=process.argv[2]||'https://robina-mining.vercel.app';
const config=JSON.parse(readFileSync('vercel.json','utf8'));
const modelRedirects=config.redirects.filter(route=>route.source.endsWith('.glb'));
let index=0,verified=0,raw=0,compressed=0;
await Promise.all(Array.from({length:3},async()=>{
  while(index<modelRedirects.length){
    const route=modelRedirects[index++];
    const response=await fetch(new URL(route.source,origin),{method:'HEAD',signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200,route.source);
    assert.equal(response.headers.get('content-encoding'),'gzip',route.source);
    assert.equal(response.headers.get('content-type'),'model/gltf-binary',route.source);
    const size=statSync('public'+route.destination).size;
    assert.equal(Number(response.headers.get('content-length')),size,route.source);
    assert.equal(new URL(response.url).pathname,route.destination,route.source);
    verified++;compressed+=size;raw+=statSync('public'+route.source).size;
  }
}));
console.log(JSON.stringify({origin,verified,raw,compressed},null,2));
