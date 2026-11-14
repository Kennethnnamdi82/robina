import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const out='docs/rivals-3d/realism-v3';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.setDefaultTimeout(180000);
 const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
 await page.addInitScript(()=>{localStorage.setItem('rivals_3d_graphics_v1','high');localStorage.setItem('rivals_3d_camera_preferences_v1',JSON.stringify({third:1,first:1,side:1,tactical:1}));});
 await page.goto('http://127.0.0.1:8084/tests/rivals3d/index.html');
 await page.getByRole('button',{name:'ENTER 3D RAID'}).click();
 await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:240000});
 const state=page.getByTestId('three-state');await expect(state).toHaveAttribute('data-pov','third');
 await page.screenshot({path:out+'/street.png',timeout:120000});
 console.log('Captured actual gameplay',await state.evaluate(n=>n.dataset));
 if(process.argv.includes('--all')){
  await page.getByRole('button',{name:'Pause game',exact:true}).click();await page.getByLabel('City lighting').selectOption('night');await page.getByRole('button',{name:'RESUME RAID'}).click();await page.screenshot({path:out+'/night.png',timeout:120000});
 }
 await fs.writeFile(out+'/audit.json',JSON.stringify({errors,failed,metrics:await state.evaluate(n=>({...n.dataset}))},null,2));
 if(errors.length||failed.length)throw Error(JSON.stringify({errors,failed}));
}finally{await browser.close();}
