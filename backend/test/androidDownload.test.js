import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {createAndroidDownloadRoutes} from '../src/downloads/android.js';
import {createApp} from '../src/app.js';

const release={available:true,versionCode:1451,bytes:64,sha256:'a'.repeat(64)};
async function serve(t,options,offline=false){
  const app=offline?createApp(()=>false,{paymentProvider:null,androidDownload:options}):express().use('/api/downloads',createAndroidDownloadRoutes(options));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return 'http://127.0.0.1:'+server.address().port+'/api/downloads/android';
}

test('APK HEAD works without login or MongoDB and advertises a real attachment, not a redirect',async t=>{
  let binaryReads=0;
  const url=await serve(t,{readRelease:async()=>release,fetcher:async()=>{binaryReads++;throw Error('HEAD must not download file');}},true);
  const response=await fetch(url,{method:'HEAD'});
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/vnd.android.package-archive');
  assert.equal(response.headers.get('content-disposition'),'attachment; filename="RIVALS-RIVAL-HEIST.apk"');
  assert.equal(response.headers.get('content-length'),'64');assert.equal(response.headers.get('accept-ranges'),'bytes');
  assert.equal(response.headers.get('location'),null);assert.equal(binaryReads,0);
});

test('streams a download larger than serverless payload limits without forwarding account credentials',async t=>{
  const bytes=5*1024*1024;let blocks=0;
  const url=await serve(t,{readRelease:async()=>({...release,bytes}),fetcher:async(target,options)=>{
    assert.equal(target,'https://github.com/Kennethnnamdi82/rivals-heist-android/releases/download/android-1451/RIVALS-RIVAL-HEIST.apk');
    assert.equal(options.headers.Cookie,undefined);assert.equal(options.headers.Authorization,undefined);
    return new Response(new ReadableStream({pull(controller){if(blocks++===5)controller.close();else controller.enqueue(new Uint8Array(1024*1024).fill(42));}}),{headers:{'content-length':String(bytes)}});
  }});
  const response=await fetch(url+'?url=https://attacker.invalid/file',{headers:{Cookie:'bd_session=must-not-forward',Authorization:'must-not-forward'}});
  assert.equal(response.status,200);assert.equal(response.redirected,false);assert.equal(response.headers.get('location'),null);
  const content=new Uint8Array(await response.arrayBuffer());assert.equal(content.length,bytes);assert.equal(content[0],42);assert.equal(content.at(-1),42);
});

test('supports partial downloads and does not splice two APK versions when If-Range changes',async t=>{
  let metadataReads=0;const ranges=[];
  const url=await serve(t,{readRelease:async()=>{metadataReads++;return release;},fetcher:async(_url,{headers})=>{
    ranges.push(headers.Range);
    if(headers.Range)return new Response(new Uint8Array(10).fill(7),{status:206,headers:{'content-length':'10','content-range':'bytes 10-19/64'}});
    return new Response(new Uint8Array(64),{headers:{'content-length':'64'}});
  }});
  let response=await fetch(url,{headers:{Range:'bytes=10-19','If-Range':'"'+release.sha256+'"'}});
  assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 10-19/64');assert.equal((await response.arrayBuffer()).byteLength,10);
  response=await fetch(url,{headers:{Range:'bytes=10-19','If-Range':'"previous-version"'}});
  assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,64);assert.deepEqual(ranges,['bytes=10-19',undefined]);assert.equal(metadataReads,1);
});

test('rejects invalid ranges, unexpected partial responses and unsupported methods',async t=>{
  const url=await serve(t,{readRelease:async()=>release,fetcher:async()=>new Response(new Uint8Array(10),{status:206,headers:{'content-length':'10','content-range':'bytes 1-10/999'}})});
  for(const range of ['bytes=90-100','bytes=20-10','bytes=0-1,3-4','bytes=-0','bytes=-999999999999999999999999']){
    const response=await fetch(url,{headers:{Range:range}});assert.equal(response.status,416);assert.equal(response.headers.get('content-range'),'bytes */64');
  }
  assert.equal((await fetch(url,{headers:{Range:'bytes=0-9'}})).status,503);
  const post=await fetch(url,{method:'POST'});assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');
});

test('coalesces metadata lookups and never advertises a missing release as a file',async t=>{
  let reads=0;
  const url=await serve(t,{readRelease:async()=>{reads++;await new Promise(resolve=>setTimeout(resolve,30));return{available:false};},fetcher:async()=>assert.fail('missing binary must not be fetched')});
  const responses=await Promise.all(Array.from({length:5},()=>fetch(url,{method:'HEAD'})));
  assert.equal(reads,1);responses.forEach(response=>{assert.equal(response.status,503);assert.equal(response.headers.get('content-disposition'),null);});
});
