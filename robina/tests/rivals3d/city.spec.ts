import { expect,test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { selectPOV } from './controls';

test('supplied city loads, four cameras preserve the raid, presets scale vegetation and pause freezes wind',async({page},info)=>{
  test.setTimeout(360000);
  const errors:string[]=[],failed:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)failed.push(r.url()+':'+r.status());});
  await page.goto('/');await page.getByRole('button',{name:'ENTER 3D RAID'}).click();
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:120000});
  const state=page.getByTestId('three-state'),read=()=>state.evaluate(n=>({...n.dataset}));
  await expect.poll(async()=>JSON.parse((await read()).environment!).models).toBe(18);
  const before=await read(),measurements=[];
  for(const pov of ['tactical','side','third','first']){
    await selectPOV(page,pov);await page.waitForTimeout(1200);const data=await read();
    expect(data.run).toBe(before.run);expect(Number(data.x)).toBeCloseTo(Number(before.x),2);expect(Number(data.z)).toBeCloseTo(Number(before.z),2);
    expect(Number(data.enemyCount)).toBe(3);expect(Number(data.drawCalls)).toBeGreaterThan(0);
    measurements.push({pov,...data});await page.screenshot({path:info.outputPath(pov+'.png')});
  }
  await page.getByRole('button',{name:'Pause game',exact:true}).click();
  await page.waitForTimeout(800);const frozen=JSON.parse((await read()).environment!).windTime;
  await page.waitForTimeout(800);expect(JSON.parse((await read()).environment!).windTime).toBe(frozen);
  const presets=[];
  for(const [quality,count] of [['high',540],['balanced',324],['low',135]] as const){
    await page.getByLabel('3D graphics quality').selectOption(quality);await expect(state).toHaveAttribute('data-quality',quality);
    await expect.poll(async()=>JSON.parse((await read()).environment!).grass).toBe(count);
    presets.push({quality,...await read()});
  }
  await page.getByRole('button',{name:'RESUME RAID'}).click();await expect.poll(async()=>JSON.parse((await read()).environment!).windTime).toBeGreaterThan(frozen);
  await page.getByRole('button',{name:'Pause game',exact:true}).click();await page.getByRole('button',{name:'EXIT SANDBOX'}).click();await expect(page.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);expect(failed).toEqual([]);
  await writeFile(info.outputPath('city-validation.json'),JSON.stringify({measurements,presets,errors,failed,method:'Actual Chrome WebGL, desktop hardware/software renderer; not physical Android certification.'},null,2));
});
