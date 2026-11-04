import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),out='docs/rivals-3d/art-direction';
try{
 const page=await browser.newPage({viewport:{width:600,height:320}}),errors=[];page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:8084/tests/rivals3d/index.html');
 for(const quality of ['LOW','MEDIUM','HIGH']){await page.getByRole('button',{name:quality+' graphics',exact:true}).click();await expect(page.getByRole('button',{name:quality+' graphics',exact:true})).toHaveAttribute('aria-pressed','true');}
 await page.reload();await expect(page.getByRole('button',{name:'HIGH graphics',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'LOW graphics',exact:true}).click();
 await page.screenshot({path:out+'/graphics-presets.png'});console.log('All three choices and persistence verified');
 const start=Date.now();await page.getByRole('button',{name:'ENTER 3D RAID'}).click();await page.locator('.r3-game[data-status=playing]').waitFor();console.log('LOW playing',Date.now()-start);
 await expect(page.getByRole('button',{name:'Graphics settings',exact:true})).toHaveCount(0);
 // Dispatch the real button's click handler without waiting for multiple
 // software-rendered RAFs of Playwright pointer-stability sampling.
 await page.getByRole('button',{name:'Pause game',exact:true}).dispatchEvent('click');await expect(page.locator('.r3-game')).toHaveAttribute('data-status','paused');
 await expect(page.getByLabel('3D graphics quality')).toHaveValue('low');const state=await page.getByTestId('three-state').evaluate(n=>({...n.dataset}));
 await fs.writeFile(out+'/graphics-presets-audit.json',JSON.stringify({errors,lowClickToPlayingMs:Date.now()-start,state,method:'Preset selection/persistence and actual Low-mode shader smoke; not a real-device or full-input benchmark.'},null,2));
 if(errors.length)throw Error(errors.join('\n'));console.log('Clean gameplay HUD, pause graphics, Low scene and shaders verified');
}finally{await browser.close();}
