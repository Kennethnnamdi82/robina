import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const output='docs/rivals-3d/city-revision';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const sideOnly=process.argv.includes('--side-only');const page=await browser.newPage({viewport:sideOnly?{width:844,height:480}:{width:1100,height:700}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
 page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE ERROR',m.text());}});
 await page.goto('http://127.0.0.1:8084/tests/rivals3d/index.html');await page.getByRole('button',{name:'ENTER 3D RAID'}).click();
 await page.locator('.r3-game[data-status="playing"]').waitFor({timeout:120000});
 const state=page.getByTestId('three-state');
 for(const pov of sideOnly?['side']:['tactical','side','third','first']){
  for(let i=0;i<4&&await state.getAttribute('data-pov')!==pov;i++){await page.getByRole('button',{name:'Cycle camera view'}).click();await page.waitForTimeout(500);}
  await page.screenshot({path:output+'/'+(sideOnly?'side-fog-corrected':pov)+'.png'});console.log('Captured',pov,await state.evaluate(n=>({fps:n.dataset.fps,calls:n.dataset.drawCalls,triangles:n.dataset.triangles,environment:JSON.parse(n.dataset.environment)})));
 }
 await fs.writeFile(output+'/'+(sideOnly?'side-fog-check':'audit')+'.json',JSON.stringify({errors,state:await state.evaluate(n=>({...n.dataset}))},null,2));
 if(errors.length)throw new Error('City rendering errors: '+errors.join('\n'));
}finally{await browser.close();}
