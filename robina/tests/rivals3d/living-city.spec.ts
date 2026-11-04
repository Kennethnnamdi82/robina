import { expect,test } from '@playwright/test';
import { selectPOV } from './controls';
import { writeFile } from 'node:fs/promises';
test.use({trace:'off',viewport:{width:1100,height:700}});
test('outdoor city loads real fleet, walks civilians, freezes simulation and preserves all four views',async({page},info)=>{
  test.setTimeout(360000);
  const errors:string[]=[],failed:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)failed.push(r.url());});
  await page.goto('/');await page.getByRole('button',{name:'ENTER 3D RAID'}).click();
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:120000});
  const state=page.getByTestId('three-state'),read=()=>state.evaluate(n=>({...n.dataset})),environment=async()=>JSON.parse((await read()).environment!);
  await expect.poll(async()=>(await environment())?.detailModels,{timeout:30000}).toBe(21);
  const initial=await read(),city=await environment();expect(initial.quality).toBe('balanced');expect(initial.pov).toBe('third');expect(city.outdoor).toBe(true);expect(city.buildings).toBeGreaterThan(10);expect(city.traffic.active).toBe(24);expect(city.civilians.active).toBe(36);
  await expect.poll(async()=>(await environment()).traffic.travelled,{timeout:60000}).toBeGreaterThan(city.traffic.travelled+3);
  await expect.poll(async()=>(await environment()).civilians.walking).toBeGreaterThan(1);
  for(const pov of ['tactical','third','first','side']){
    await selectPOV(page,pov);const current=await read();expect(current.run).toBe(initial.run);expect((await environment()).signature).toBe(city.signature);
    await page.screenshot({path:info.outputPath('outdoor-'+pov+'.png')});
  }
  await page.getByRole('button',{name:'Pause game',exact:true}).click();const frozen=await environment();await page.waitForTimeout(700);
  expect((await environment()).traffic.clock).toBe(frozen.traffic.clock);expect((await environment()).civilians.walking).toBe(frozen.civilians.walking);
  await page.getByLabel('3D graphics quality').selectOption('high');await expect.poll(async()=>(await environment()).traffic.active).toBe(28);await expect.poll(async()=>(await environment()).civilians.active).toBe(48);
  await page.getByLabel('3D graphics quality').selectOption('low');
  await page.getByRole('button',{name:'RESUME RAID'}).click();await selectPOV(page,'third');
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:info.outputPath('outdoor-mobile-landscape.png')});
  await expect(page.getByTestId('movement-stick')).toBeVisible();await expect(page.getByTestId('aim-stick')).toBeVisible();
  await page.getByRole('button',{name:'Pause game',exact:true}).click();await page.getByRole('button',{name:'RESTART 3D RAID'}).click();
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:120000});
  expect((await environment()).signature).not.toBe(city.signature);
  await page.getByRole('button',{name:'Pause game',exact:true}).click();await page.getByRole('button',{name:'EXIT SANDBOX'}).click();await expect(page.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);expect(failed).toEqual([]);
});

test('city atmosphere renders without shader errors and civilians react to real gunfire',async({page},info)=>{
  test.setTimeout(240000);const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/');await page.getByRole('button',{name:'ENTER 3D RAID'}).click();await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:120000});
  const state=page.getByTestId('three-state'),env=()=>state.evaluate(n=>JSON.parse(n.dataset.environment!));
  await selectPOV(page,'third');await page.screenshot({path:info.outputPath('golden-hour-street.png')});
  const metrics=await state.evaluate(n=>({...n.dataset}));console.log('City rendering:',JSON.stringify({fps:metrics.fps,calls:metrics.drawCalls,triangles:metrics.triangles,environment:JSON.parse(metrics.environment!)}));
  for(const lighting of ['night','daylight','golden']) {
    await page.getByRole('button',{name:'Pause game',exact:true}).click();await page.getByLabel('City lighting').selectOption(lighting);
    await expect.poll(async()=>(await env()).lighting).toBe(lighting);await page.getByRole('button',{name:'RESUME RAID'}).click();
    await page.screenshot({path:info.outputPath(lighting+'-street.png')});
  }
  await page.mouse.move(550,350);await page.mouse.down();await expect.poll(async()=>(await env()).civilians.fled,{timeout:30000}).toBeGreaterThan(0);await page.mouse.up();
  await writeFile(info.outputPath('rendering.json'),JSON.stringify({metrics,errors,final:await env()},null,2));expect(errors).toEqual([]);
});
