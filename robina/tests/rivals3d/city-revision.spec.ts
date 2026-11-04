import {expect,test} from '@playwright/test';
import {selectPOV} from './controls';
import {writeFile,mkdir,copyFile} from 'node:fs/promises';
test.use({trace:'off',viewport:{width:844,height:480}});
test('revised city keeps fixed architecture while walking in side view and uses authored human gaits',async({page},info)=>{
 test.setTimeout(420000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await page.getByRole('button',{name:'ENTER 3D RAID'}).click();await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:120000});
 const state=page.getByTestId('three-state'),read=()=>state.evaluate(n=>({...n.dataset})),env=async()=>JSON.parse((await read()).environment!);
 const initial=await read(),first=await env();expect(first.architecture).toBe('photo-textured-fixed-meshes');expect(first.civilians.animation).toBe('authored-skeletal-walk-run');
 const capture=async(name:string)=>{await page.screenshot({path:info.outputPath(name+'.png')});await mkdir('docs/rivals-3d/city-revision',{recursive:true});await copyFile(info.outputPath(name+'.png'),'docs/rivals-3d/city-revision/'+name+'.png');};
 await selectPOV(page,'third');await capture('revised-third');
 await selectPOV(page,'side');const x=Number((await read()).x);await page.keyboard.down('KeyD');
 try{await expect.poll(async()=>Number((await read()).x),{timeout:90000,intervals:[500]}).toBeGreaterThan(x+8);}finally{await page.keyboard.up('KeyD');}
 expect((await env()).architectureHash).toBe(first.architectureHash);expect((await read()).run).toBe(initial.run);await capture('revised-side-walking');
 for(const pov of ['tactical','third','first','side']){await selectPOV(page,pov);expect((await env()).architectureHash).toBe(first.architectureHash);await capture('revised-'+pov+'-after-movement');}
 await page.getByRole('button',{name:'Pause game',exact:true}).click();const frozen=await env();await page.waitForTimeout(600);expect((await env()).civilians.walking).toBe(frozen.civilians.walking);
 await page.getByRole('button',{name:'RESUME RAID'}).click();
 await page.mouse.move(550,350);await page.mouse.down();try{await expect.poll(async()=>(await env()).civilians.fled,{timeout:30000}).toBeGreaterThan(0);}finally{await page.mouse.up();}
 const final=await read();await writeFile(info.outputPath('revision-audit.json'),JSON.stringify({errors,initial,final},null,2));await copyFile(info.outputPath('revision-audit.json'),'docs/rivals-3d/city-revision/revision-audit.json');expect(errors).toEqual([]);
});
