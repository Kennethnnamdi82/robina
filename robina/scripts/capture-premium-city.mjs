import {chromium,expect} from '@playwright/test';import fs from 'node:fs/promises';
const out='docs/rivals-3d/art-direction';await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:900,height:520}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text());}});
await page.goto('http://127.0.0.1:8084/tests/rivals3d/index.html');await page.getByRole('button',{name:'ENTER 3D RAID'}).click();await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:120000});const state=page.getByTestId('three-state');await expect(state).toHaveAttribute('data-pov','third');await page.screenshot({path:out+'/premium-street.png'});console.log('Street captured');
const metrics=await state.evaluate(n=>({...n.dataset}));await fs.writeFile(out+'/premium-audit.json',JSON.stringify({errors,metrics},null,2));
if(process.argv.includes('--day-only')){if(errors.length)throw Error(errors.join('\n'));process.exitCode=0;}else{
await page.getByRole('button',{name:'Pause game',exact:true}).click();await page.getByLabel('City lighting').selectOption('night');await page.getByRole('button',{name:'RESUME RAID'}).click();await page.screenshot({path:out+'/premium-night.png'});console.log('Night captured');
await page.setViewportSize({width:844,height:390});await page.screenshot({path:out+'/premium-phone.png'});console.log('Phone captured');if(errors.length)throw Error(errors.join('\n'));
}
}finally{await browser.close();}
