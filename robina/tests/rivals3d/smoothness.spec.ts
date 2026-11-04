import {test,expect} from '@playwright/test';
import {selectPOV} from './controls';
test.use({viewport:{width:600,height:320},trace:'off',actionTimeout:120000});
test('optimized city preserves movement, geometry, recoil aim and pause',async({page})=>{
 test.setTimeout(600000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await page.getByRole('button',{name:'ENTER 3D RAID'}).click();await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:180000});
 const state=page.getByTestId('three-state'),read=()=>state.evaluate(n=>({...n.dataset})),first=await read(),hash=JSON.parse(first.environment!).architectureHash;
 expect(first.quality).toBe('balanced');expect(first.pov).toBe('third');expect(JSON.parse(first.environment!).traffic.active).toBe(24);
 await page.getByRole('button',{name:'Pause game',exact:true}).click();await page.getByLabel('3D graphics quality').selectOption('low');await page.getByRole('button',{name:'RESUME RAID'}).click();
 await page.keyboard.down('KeyW');try{await expect.poll(async()=>Number((await read()).z),{timeout:90000}).toBeGreaterThan(Number(first.z)+.3);}finally{await page.keyboard.up('KeyW');}
 const before=JSON.parse((await read()).combat!);await page.mouse.move(422,195);await page.mouse.down();try{await expect.poll(async()=>JSON.parse((await read()).combat!).inventory.shots,{timeout:90000}).toBeGreaterThanOrEqual(2);}finally{await page.mouse.up();}
 const combat=JSON.parse((await read()).combat!);expect(combat.view.yaw).toBe(before.view.yaw);expect(combat.view.feedback.shots).toBeGreaterThanOrEqual(2);
 for(const pov of ['first','side','tactical','third']){await selectPOV(page,pov);expect(JSON.parse((await read()).environment!).architectureHash).toBe(hash);}
 await page.getByRole('button',{name:'Pause game',exact:true}).click();const frozen=JSON.parse((await read()).environment!).traffic.clock;await page.waitForTimeout(300);expect(JSON.parse((await read()).environment!).traffic.clock).toBe(frozen);
 await page.getByRole('button',{name:'RESUME RAID'}).click();await expect(page.getByTestId('movement-stick')).toBeVisible();await expect(page.getByTestId('aim-stick')).toBeVisible();
 expect(errors).toEqual([]);
});
