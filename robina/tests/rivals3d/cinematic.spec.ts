import {test,expect} from '@playwright/test';
import {selectPOV} from './controls';
test.use({hasTouch:true,viewport:{width:390,height:844}});

test('real FPS game supports independent multitouch, centred ADS and all four POVs in portrait and landscape',async({page},info)=>{
  test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/');await page.getByRole('button',{name:'LOW graphics'}).click();await page.getByRole('button',{name:'ENTER 3D RAID'}).click({timeout:120000,noWaitAfter:true});await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:180000});
  const state=page.getByTestId('three-state'),combat=async()=>JSON.parse(await state.getAttribute('data-combat')||'null');
  await selectPOV(page,'first');await expect(page.getByRole('button',{name:'Shoot weapon'})).toBeVisible();await expect(page.getByTestId('aim-stick')).toHaveCount(0);
  await page.getByRole('button',{name:'Aim down sights',exact:true}).click();await expect.poll(async()=>Math.abs((await combat()).view.sight[0]),{timeout:20000}).toBeLessThan(.005);await expect.poll(async()=>Math.abs((await combat()).view.sight[1])).toBeLessThan(.005);
  await page.screenshot({path:info.outputPath('portrait-fps-ads.png')});
  const move=(await page.getByTestId('move-stick').boundingBox())!,look=(await page.getByTestId('fps-look-area').boundingBox())!,shoot=(await page.getByRole('button',{name:'Shoot weapon'}).boundingBox())!;
  const p1={id:1,x:move.x+move.width*.68,y:move.y+move.height*.35},p2={id:2,x:look.x+look.width*.4,y:look.y+look.height*.3},p3={id:3,x:shoot.x+shoot.width/2,y:shoot.y+shoot.height/2};
  const before=await combat(),initial=await state.getAttribute('data-x'),cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2,p3]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p1,{...p2,x:p2.x+26,y:p2.y-12},p3]});
  await expect.poll(async()=>(await combat()).inventory.shots).toBeGreaterThan(before.inventory.shots);
  await expect.poll(async()=>(await combat()).view.yaw).not.toBe(before.view.yaw);
  await expect.poll(async()=>Number(await state.getAttribute('data-x'))).not.toBe(Number(initial));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  await page.getByRole('button',{name:'Aim down sights',exact:true}).click();await expect.poll(async()=>(await combat()).view.ads).toBe(false);
  for(const size of [{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(size);await selectPOV(page,'first');await page.getByRole('button',{name:'Aim down sights',exact:true}).click();await expect.poll(async()=>Math.abs((await combat()).view.sight[1])).toBeLessThan(.005);
    await page.screenshot({path:info.outputPath(`${size.width>size.height?'landscape':'portrait'}-aim.png`)});await page.getByRole('button',{name:'Aim down sights',exact:true}).click();
    for(const pov of ['third','tactical','side','first']){await selectPOV(page,pov);await expect(state).toHaveAttribute('data-pov',pov);}
  }
  expect(errors).toEqual([]);await info.attach('cinematic-mobile-check',{body:JSON.stringify({initial,final:await state.getAttribute('data-x'),combat:await combat()}),contentType:'application/json'});
});
