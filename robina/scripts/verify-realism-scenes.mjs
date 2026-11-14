import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const high=process.argv.includes('--high'),out=`docs/rivals-3d/realism-v3/${high?'high':'balanced'}`;await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});page.setDefaultTimeout(240000);
 const errors=[],failed=[];page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('ERROR',m.text());}});page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
 await page.goto('http://127.0.0.1:8084/tests/realism/index.html?quality='+(high?'high':'balanced'));await page.getByRole('button').click();
 await expect.poll(()=>page.evaluate(()=>window.__realismAudit?.status),{timeout:300000}).toBe('playing');console.log('Actual renderer ready');
 const shots=process.argv.includes('--all')?['street','player','cars','bank','night']:process.argv.includes('--bank')?['bank']:['street'];
 const metrics=[];
 for(const shot of shots){
  await page.evaluate(shot=>window.__realismAudit.pose(shot),shot);
  // Wait for the actual renderer's next presentation, not an arbitrary delay.
  await expect.poll(()=>page.evaluate(()=>window.__realismAudit.diagnostics?.environment?.lighting),{timeout:180000}).toBe(shot==='night'?'night':'daylight');
  await page.screenshot({path:out+'/'+shot+'.png',timeout:180000});metrics.push({scene:shot,data:await page.evaluate(()=>window.__realismAudit.diagnostics)});console.log('Captured',shot);
 }
 await fs.writeFile(out+'/audit.json',JSON.stringify({errors,failed,metrics},null,2));
 if(errors.length||failed.length)throw Error(JSON.stringify({errors,failed}));
}finally{await browser.close();}
