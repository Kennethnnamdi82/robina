import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:600,height:320}}),errors=[];page.setDefaultTimeout(180000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
  const audit=window.__frameAudit={frame:0,draws:0,resizes:[],afterDrawClears:[],firstPlayingDraws:null,forcedSteps:0};
  const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>raf(time=>{audit.frame++;callback(time);});
  let lastDrawFrame=-1;const targets=new WeakMap(),isGame=canvas=>canvas?.getAttribute('aria-label')==='RIVALS experimental unified 3D raid';
  for(const key of ['width','height']){const descriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);Object.defineProperty(HTMLCanvasElement.prototype,key,{...descriptor,set(value){if(isGame(this)){const entry={frame:audit.frame,key,value};audit.resizes.push(entry);if(lastDrawFrame===audit.frame)audit.afterDrawClears.push(entry);}descriptor.set.call(this,value);}});}
  const proto=WebGL2RenderingContext.prototype,bind=proto.bindFramebuffer;
  proto.bindFramebuffer=function(target,buffer){if(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER)targets.set(this,buffer);return bind.call(this,target,buffer);};
  for(const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const original=proto[key];proto[key]=function(...args){if(isGame(this.canvas)&&targets.get(this)==null){audit.draws++;lastDrawFrame=audit.frame;}return original.apply(this,args);};}
  new MutationObserver(()=>{if(audit.firstPlayingDraws===null&&document.querySelector('.r3-game[data-status=playing]'))audit.firstPlayingDraws=audit.draws;}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-status']});
 });
 await page.goto('http://127.0.0.1:8084/tests/rivals3d/index.html');await page.getByRole('button',{name:'LOW graphics',exact:true}).click();
 // Force two pixel-budget changes in this isolated browser, exercising the
 // former blank-frame path without depending on device speed or waiting.
 const budgetModule=await page.evaluate(async()=>{
  // Vite may attach HMR timestamps. Import the same module URL as the runtime,
  // not a second, unversioned copy whose prototype the game never uses.
  const entries=performance.getEntriesByType('resource');const runtime=entries.find(r=>r.name.includes('/RaidRuntime.ts'));
  const code=runtime?await(await fetch(runtime.name)).text():'';
  const match=code.match(/from\s*["']([^"']*AdaptiveResolution\.ts[^"']*)["']/);
  const url=match?new URL(match[1],location.href).href:entries.find(r=>r.name.includes('/AdaptiveResolution.ts'))?.name;
  if(!url)throw Error('Cannot locate the active adaptive-resolution module');
  const {AdaptiveResolution}=await import(url);const sample=AdaptiveResolution.prototype.sample;
  AdaptiveResolution.prototype.sample=function(seconds){if(window.__frameAudit.forcedSteps<2){window.__frameAudit.forcedSteps++;return this.scale=Math.max(this.floor,this.scale*.8);}return sample.call(this,seconds);};return url;
 });console.log('Using runtime budget module',budgetModule);
 await page.getByRole('button',{name:'ENTER 3D RAID'}).click();await page.locator('.r3-game[data-status=playing]').waitFor();console.log('First frame ready');
 await expect(page.getByRole('button',{name:'Graphics settings',exact:true})).toHaveCount(0);
 await page.waitForFunction(()=>window.__frameAudit.forcedSteps>=2);await page.getByRole('button',{name:'Pause game',exact:true}).dispatchEvent('click');await expect(page.locator('.r3-game')).toHaveAttribute('data-status','paused');
 const audit=await page.evaluate(()=>window.__frameAudit);expect(audit.firstPlayingDraws).toBeGreaterThan(0);expect(audit.afterDrawClears).toEqual([]);expect(audit.resizes.length).toBeGreaterThanOrEqual(6);await expect(page.getByLabel('3D graphics quality')).toHaveValue('low');expect(errors).toEqual([]);
 await fs.writeFile('docs/rivals-3d/art-direction/camera-stability-audit.json',JSON.stringify({errors,audit,method:'Actual game in local software-rendered Chrome. Tracks game-canvas writes vs default-framebuffer draws; forces two adaptive scale changes and verifies the first frame precedes playing UI.'},null,2));
 console.log(JSON.stringify({firstPlayingDraws:audit.firstPlayingDraws,resizeWrites:audit.resizes.length,afterDrawClears:audit.afterDrawClears,errors}));
}finally{await browser.close();}
