import {chromium,expect as baseExpect} from '@playwright/test';
import fs from 'node:fs/promises';
// Software-rendered CI/dev machines can take much longer than simulation time.
const expect=baseExpect.configure({timeout:120000});
const mobile=process.argv.includes('--mobile');
const quality=process.argv.includes('--low')?'low':'balanced';
const output='docs/rivals-3d/smart-camera/'+(mobile?'mobile':'desktop');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try{
 page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:960,height:600},hasTouch:mobile,deviceScaleFactor:1});
 page.setDefaultTimeout(120000);
 const errors=[],failed=[],samples=[];
 page.on('pageerror',error=>{errors.push(error.message);console.error('BROWSER',error.message);});
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
 await page.goto('http://127.0.0.1:8084/tests/realism/index.html?quality='+quality);
 await page.getByRole('button').click();
 await expect.poll(()=>page.evaluate(()=>window.__realismAudit?.status),{timeout:240000}).toBe('playing');
 console.log('Actual renderer ready');
 const state=()=>page.evaluate(()=>window.__realismAudit.camera.state);
 const sample=async name=>{samples.push({name,...await state()});console.log(name,JSON.stringify(samples.at(-1)));};
 await page.evaluate(()=>window.__realismAudit.pose('player'));
 await expect.poll(async()=>!(await state()).settling).toBe(true);
 const initial=await state();
 await page.evaluate(()=>window.__realismAudit.camera.walk(1,0));
 const target=initial.yaw-Math.PI/2;
 await expect.poll(async()=>{const s=await state();return Math.abs(Math.atan2(Math.sin(s.yaw-target),Math.cos(s.yaw-target)));},{timeout:240000}).toBeLessThan(.12);
 await sample('held-stick-follow');
 const beforeOrbit=(await state()).yaw;
 if(mobile){
  const touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:400,y:180}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:350,y:185}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await touch.detach();
 }else{
  await page.mouse.move(450,250);await page.mouse.down({button:'right'});
  await page.mouse.move(400,255,{steps:3});await page.mouse.up({button:'right'});
 }
 await expect.poll(async()=>Math.abs((await state()).yaw-beforeOrbit)).toBeGreaterThan(.05);
 await sample('manual-orbit');
 await page.evaluate(()=>window.__realismAudit.camera.aim(.7,-.4));
 await page.waitForTimeout(300); const aimed=await state();
 await expect.poll(async()=>(await state()).elapsed).toBeGreaterThan(aimed.elapsed+.5); const held=await state();
 expect(Math.abs(held.yaw-aimed.yaw)).toBeLessThan(.04);await sample('combat-aim-lock');
 await page.evaluate(()=>window.__realismAudit.camera.freeze());
 for(const pov of ['tactical','side','first','third']){
  await page.evaluate(pov=>window.__realismAudit.camera.pov(pov),pov);
  await expect.poll(async()=>!(await state()).settling).toBe(true);
  expect((await state()).pov).toBe(pov);await sample(pov);
 }
 await page.evaluate(()=>{window.__realismAudit.camera.enterVehicle();window.__realismAudit.camera.drive(.8,.15);});
 await expect.poll(async()=>(await state()).driving).toBe(true);
 await page.waitForTimeout(1400);await sample('vehicle-chase');
 await page.evaluate(()=>window.__realismAudit.camera.pov('first'));
 await expect.poll(async()=>!(await state()).settling).toBe(true);
 expect((await state()).pov).toBe('first');
 await page.evaluate(()=>window.__realismAudit.camera.drive(0,0,true));
 await expect.poll(async()=>Math.abs((await state()).speed)).toBeLessThan(.2);
 await page.evaluate(()=>window.__realismAudit.camera.drive(-1));
 await expect.poll(async()=>(await state()).speed).toBeLessThan(-.8);
 // Verify the actual reverse-facing view, not just negative vehicle speed.
 await expect.poll(async()=>{const s=await state();return Math.abs(Math.atan2(Math.sin(s.yaw-s.motion.vehicle.heading-Math.PI),Math.cos(s.yaw-s.motion.vehicle.heading-Math.PI)));},{timeout:240000}).toBeLessThan(.2);
 await sample('reverse-chase');
 await page.evaluate(()=>window.__realismAudit.camera.drive(0,0,true));
 await expect.poll(async()=>Math.abs((await state()).speed)).toBeLessThan(.2);
 await page.evaluate(()=>window.__realismAudit.camera.exitVehicle());
 await expect.poll(async()=>(await state()).driving).toBe(false);
 await expect.poll(async()=>!(await state()).settling).toBe(true);
 expect((await state()).pov).toBe('first');await sample('restored-first-person');
 await page.evaluate(()=>window.__realismAudit.camera.freeze());
 await page.screenshot({path:output+'/camera.png',timeout:120000});
 await fs.writeFile(output+'/audit.json',JSON.stringify({mobile,quality,errors,failed,samples},null,2));
 if(errors.length||failed.length)throw Error(JSON.stringify({errors,failed}));
 console.log('Actual renderer camera audit passed');
}catch(error){
 console.error('Camera failure state',await page?.evaluate(()=>window.__realismAudit?.camera?.state).catch(()=>null));
 throw error;
}finally{await browser.close();}
