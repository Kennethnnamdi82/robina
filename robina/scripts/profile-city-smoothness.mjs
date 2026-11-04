import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const label=process.argv[2]??'after',browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:process.argv.includes('--gpu')?['--use-angle=d3d11']:[]});
try{
 const page=await browser.newPage({viewport:{width:844,height:390}});page.setDefaultTimeout(180000);await page.addInitScript(()=>performance.setResourceTimingBufferSize(2000));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:8084/tests/rivals3d/index.html');const start=Date.now();await page.getByRole('button',{name:'ENTER 3D RAID'}).click();
 await page.locator('.r3-game[data-status=playing]').waitFor();const playableMs=Date.now()-start;
 console.log('PLAYABLE',label,playableMs);
 await page.waitForTimeout(1500);
 const data=await page.getByTestId('three-state').evaluate(n=>({...n.dataset}));
 const driver=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).map(r=>({url:new URL(r.name).pathname,bytes:r.encodedBodySize,duration:r.duration})));
 if(label!=='before')await page.screenshot({path:'docs/rivals-3d/art-direction/smooth-city.png',timeout:180000});
 await fs.writeFile('docs/rivals-3d/art-direction/smoothness-'+label+'.json',JSON.stringify({label,playableMs,driver,errors,data,resources},null,2));
 console.log(JSON.stringify({playableMs,driver,errors,calls:data.drawCalls,triangles:data.triangles,fps:data.fps,bytes:resources.reduce((n,r)=>n+r.bytes,0)},null,2));
}finally{await browser.close();}
