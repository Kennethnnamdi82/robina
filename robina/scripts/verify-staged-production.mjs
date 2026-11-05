import {spawnSync,spawn} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
const [target,cli,pattern='built production 3D']=process.argv.slice(2);
if(!target||!cli)throw Error('Usage: node scripts/verify-staged-production.mjs <deployment-url> <vercel-cli-js|--public> [test-pattern|--delivery-only]');
const publicCheck=cli==='--public';
if(publicCheck&&pattern!=='--delivery-only')throw Error('Public mode supports delivery preflight only.');
const access=publicCheck?null:spawnSync(process.execPath,[cli,'curl','/','--deployment',target,'--','--silent','--show-error','--head','--header','x-vercel-set-bypass-cookie: true'],{encoding:'utf8',maxBuffer:2*1024*1024,cwd:'..'});
if(access&&access.status!==0)throw Error('Authenticated Vercel request failed; no credential output retained.');
const match=access?.stdout.match(/^set-cookie:\s*(_vercel_jwt)=([^;\s]+)/mi);
if(!publicCheck&&!match)throw Error('Vercel did not issue the expected staging-access cookie.');
// Credentials stay in process memory/environment, never arguments or files.
const cookie=match?{name:match[1],value:match[2],url:new URL(target).origin,secure:true,httpOnly:true,sameSite:'Lax'}:null;
if(pattern==='--delivery-only'){
  const origin=new URL(target).origin;
  const request=async(path,method='HEAD')=>{
    const url=new URL(path,origin);
    assert.equal(url.origin,origin,'Preflight must stay on the staged host');
    return fetch(url,{method,redirect:'manual',headers:cookie?{Cookie:cookie.name+'='+cookie.value}:{},signal:AbortSignal.timeout(20000)});
  };
  const config=JSON.parse(readFileSync('vercel.json','utf8'));
  const models=config.redirects.filter(route=>route.source.endsWith('.glb'));
  const pages=config.redirects.filter(route=>!route.source.startsWith('/assets/'));
  let index=0;
  const checks=[...pages,...models];
  await Promise.all(Array.from({length:3},async()=>{
    while(index<checks.length){
      const route=checks[index++],isGame=route.source==='/gaming';
      const response=await request(route.source+(isGame?'?engine=2d':''));
      assert.equal(response.status,307,route.source);
      const destination=new URL(response.headers.get('location'),origin);
      assert.equal(destination.origin,origin);
      assert.equal(destination.pathname,route.destination);
      if(isGame)assert.equal(destination.searchParams.get('engine'),'2d');
      if(route.source.endsWith('.glb')){
        const asset=await request(destination.pathname+destination.search);
        assert.equal(asset.status,200,route.source);
        assert.equal(asset.headers.get('content-encoding'),'gzip',route.source);
        assert.equal(asset.headers.get('content-type'),'model/gltf-binary',route.source);
        assert.equal(Number(asset.headers.get('content-length')),statSync('public'+route.destination).size,route.source);
      }
    }
  }));
  const home=await request('/','GET');assert.equal(home.status,200);
  const html=await home.text();assert.match(html,/<title>RIVALS/);
  const entry=html.match(/<script[^>]+src="([^"]+)"/)[1];
  const javascript=await request(entry,'GET');assert.equal(javascript.status,200);
  const entryText=await javascript.text();assert.match(entryText,/Sign in to RIVALS/);
  const hubModule=entryText.match(/GameHub-[a-zA-Z0-9_-]+\.js/)?.[0];assert.ok(hubModule,'Frontend hub must be lazy-loaded by the application');
  const hub=await request('/assets/'+hubModule,'GET');assert.equal(hub.status,200);const hubText=await hub.text();assert.match(hubText,/FRONTEND PREVIEW/);
  const storeModule=hubText.match(/StorePage-[a-zA-Z0-9_-]+\.js/)?.[0];assert.ok(storeModule,'Store must be lazy-loaded from the game hub');
  const store=await request('/assets/'+storeModule,'GET');assert.equal(store.status,200);assert.match(await store.text(),/THE EXCHANGE/);
  const gamePages=['/missions','/profile','/rank','/settings','/customization','/leaderboards','/play','/store','/store/weapons','/store/health','/inventory','/purchase-history','/recovery'];
  for(const path of gamePages){const response=await request(path);assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/text\/html/,path);}
  const menuArt='/assets/rivals/hub/menu-keyart-v1.webp',art=await request(menuArt);
  assert.equal(art.status,200);assert.equal(Number(art.headers.get('content-length')),statSync('public'+menuArt).size);
  for(const model of ['operative','rifle','ak47','smg','pistol','health']){const path='/assets/rivals/store/'+model+'.png',art=await request(path);assert.equal(art.status,200,path);assert.equal(Number(art.headers.get('content-length')),statSync('public'+path).size,path);}
  console.log(JSON.stringify({origin,publicRedirects:pages.length,gamePages:gamePages.length,compressedModels:models.length,entry,hubModule,storeModule,storeArt:6,menuArtBytes:statSync('public'+menuArt).size,frontendOnly:true}));
  process.exit(0);
}
console.log('Protected staging access prepared; running production browser checks.');
const test=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.production.config.ts','--grep',pattern,'--output','test-results/production-staged-final'],{stdio:'inherit',env:{...process.env,PRODUCTION_TEST_URL:target,PRODUCTION_TEST_WARM_ASSETS:'',PRODUCTION_TEST_BYPASS_COOKIE:JSON.stringify(cookie)}});
test.on('error',()=>{process.exitCode=1;});
test.on('exit',code=>{process.exitCode=code??1;});
