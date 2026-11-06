import {test,expect} from '@playwright/test';

test('eight real outfits have distinct photos, complete assets and responsive readable cards',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/tests/rivals3d/store.html?page=/store/characters');
  await expect(page.locator('.rs-card')).toHaveCount(8);
  const photos=await page.locator('.rs-card img').evaluateAll(images=>images.map(n=>(n as HTMLImageElement).src));expect(new Set(photos).size).toBe(8);
  await page.locator('.rs-card img').evaluateAll(images=>images.forEach(n=>{(n as HTMLImageElement).loading='eager';}));
  await expect.poll(()=>page.locator('.rs-card img').evaluateAll(images=>images.every(n=>(n as HTMLImageElement).complete&&(n as HTMLImageElement).naturalWidth>0))).toBe(true);
  for(const [width,height]of [[1440,1000],[390,844],[320,740],[844,390]]){
    await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await expect(page.locator('canvas')).toHaveCount(0);
  }
  for(const photo of photos){const r=await page.request.get(photo);expect(r.ok()).toBe(true);}
  await expect(page.getByText(/MODEL NOT AVAILABLE|BASE OPERATIVE|Outfit concept|unavailable/i)).toHaveCount(0);
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:info.outputPath('uniform-collection-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:info.outputPath('uniform-collection-phone.png'),fullPage:true});
  for(const [name,id]of [['SHADOW RAIDER','shadow'],['CYBER PHANTOM','cyber']]){
    await page.getByRole('button',{name:'Details for '+name,exact:true}).click();await page.getByRole('button',{name:'INSPECT IN 3D'}).click();
    await expect(page.getByRole('img',{name:'Interactive '+id+' collection model'})).toBeVisible();await expect(page.getByText('OPENING THE STUDIO',{exact:true})).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(1);await page.screenshot({path:info.outputPath(id+'-uniform-studio.png')});
    await page.getByRole('button',{name:'Close product details'}).click();await expect(page.locator('canvas')).toHaveCount(0);
  }expect(errors).toEqual([]);
});

test('real hand-mounted rifle remains held during front, rear and side camera observation',async({page},info)=>{
  await page.setViewportSize({width:700,height:800});await page.goto('/tests/rivals3d/equipment-studio.html');await expect(page.locator('canvas')).toBeVisible();
  type Studio={view:(v:string)=>void;aim:(a:boolean)=>void;walk:(a:boolean)=>void;metrics:()=>{grip:number;support:number;supported:boolean;gun:number[];yaw:number;visible:boolean}};
  const metrics=()=>page.evaluate(()=>(window as unknown as {equipmentStudio:Studio}).equipmentStudio.metrics());
  await expect.poll(async()=>{try{return (await metrics()).supported;}catch{return false;}}).toBe(true);
  for(const view of ['front','right','rear','left']){
    await page.evaluate(v=>(window as unknown as {equipmentStudio:Studio}).equipmentStudio.view(v),view);
    await page.waitForTimeout(120);const m=await metrics();expect(m.grip).toBeLessThan(.002);expect(m.support).toBeLessThan(.06);expect(m.visible).toBe(true);
    // The held rifle stays in front of the body, even with an observing camera
    // facing the character. A camera ray must not tuck it behind their chest.
    expect(m.gun[0]*Math.sin(m.yaw)+m.gun[2]*Math.cos(m.yaw)).toBeGreaterThan(.15);await page.screenshot({path:info.outputPath(view+'-gun-hold.png')});
  }
  await page.evaluate(()=>{const s=(window as unknown as {equipmentStudio:Studio}).equipmentStudio;s.aim(true);s.walk(true);});
  await page.waitForTimeout(500);expect((await metrics()).grip).toBeLessThan(.002);expect((await metrics()).support).toBeLessThan(.06);
});
