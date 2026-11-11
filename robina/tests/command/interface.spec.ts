import {test,expect,type Page} from '@playwright/test';

async function accountFixture(page:Page,signedIn=true){
 const errors:string[]=[],writes:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push(r.method()+' '+new URL(r.url()).pathname);});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.startsWith('/api/')){
   if(signedIn&&u.pathname==='/api/auth/me'){await route.fulfill({json:{user:{wallet:'0x1111111111111111111111111111111111111111',chainType:'evm',bdBalance:0,level:'Beginner',lastClaimTime:null,autoClaimActive:false,autoClaimExpiry:null,referralCode:'',referralCount:0,completedTasks:[],lastDailyTaskDate:''}}});return;}
   await route.fulfill({status:401,json:{error:'unauthorized'}});return;
  }
  if(u.origin===new URL(test.info().project.use.baseURL!).origin){await route.continue();return;}await route.abort();
 });
 return{errors,writes};
}
async function noOverflow(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
}
async function ready(page:Page){
 await expect(page.locator('.rh-topbar')).toBeVisible();await expect(page.locator('.rh-app h1').first()).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 await page.locator('img').evaluateAll(async images=>{for(const image of images)(image as HTMLImageElement).loading='eager';await Promise.all(images.map(image=>(image as HTMLImageElement).decode().catch(()=>{})));});
}
async function navigate(page:Page,path:string){
 const link=page.locator('a:visible[href="'+path+'"]').first();
 if(await link.count())await link.click();
 else await page.evaluate(target=>{history.pushState(null,'',target);dispatchEvent(new PopStateEvent('popstate'));},path);
 await expect(page).toHaveURL(new URL(path,test.info().project.use.baseURL!).href);
}

test('cinematic lobby, every player route and all collection categories remain functional',async({page},info)=>{
 test.setTimeout(240000);const fixture=await accountFixture(page);await page.goto('/');await ready(page);
 await expect(page.getByRole('link',{name:'PLAY',exact:true})).toBeVisible();await expect(page.locator('.r3-game')).toHaveCount(0);
 for(const size of [{width:1440,height:1000},{width:1366,height:768},{width:1024,height:768}]){
  await page.setViewportSize(size);const menu=await page.locator('.rh-command-nav').boundingBox(),deploy=await page.locator('.rh-lobby-deploy').boundingBox();expect(menu!.y+menu!.height).toBeLessThanOrEqual(deploy!.y);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:info.outputPath('lobby-desktop.png'),fullPage:true});
 for(const [path,heading]of [['/missions','OPERATIONS'],['/profile','OPERATIVE PROFILE'],['/leaderboards','LEADERBOARDS'],['/rank','EARN YOUR NAME'],['/customization','MAKE IT YOURS'],['/settings','SETTINGS'],['/inventory','THE EXCHANGE'],['/recovery','RECOVERY PROTOCOL']]){
  await navigate(page,path);await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();await ready(page);await noOverflow(page);await page.screenshot({path:info.outputPath(path.slice(1)+'-desktop.png'),fullPage:true});
 }
 for(const category of ['featured','weapons','grenades','health','characters','cosmetics','effects','bundles','season','founder','inventory','history']){
  await navigate(page,category==='inventory'?'/inventory':category==='history'?'/purchase-history':'/store/'+category);await expect(page.getByRole('heading',{name:'THE EXCHANGE',exact:true})).toBeVisible();await noOverflow(page);await expect(page.locator('.r3-game')).toHaveCount(0);
 }
 await navigate(page,'/play?operation=military');await expect(page.getByRole('heading',{name:'BLACK STANDARD',exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'BLACK STANDARD site plan'})).toBeVisible();await page.screenshot({path:info.outputPath('briefing-desktop.png'),fullPage:true});
 expect(fixture.errors).toEqual([]);expect(fixture.writes).toEqual([]);
});

test('phone portrait and landscape menus, store, profile and dialogs have no page overflow',async({page},info)=>{
 test.setTimeout(240000);const fixture=await accountFixture(page);await page.goto('/');
 for(const size of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(size);
  for(const path of ['/','/missions','/profile','/leaderboards','/customization','/settings','/store','/store/characters','/store/weapons','/inventory','/store/season','/store/founder']){
   await navigate(page,path);await ready(page);await noOverflow(page);
   if(path==='/')await expect(page.getByRole('link',{name:'PLAY',exact:true})).toBeInViewport();
   if(size.width===390)await page.screenshot({path:info.outputPath((path==='/'?'lobby':path.slice(1).replaceAll('/','-'))+'-phone.png'),fullPage:true});
  }
  await navigate(page,'/store/characters');await page.getByRole('button',{name:'Inspect LEGENDARY PHANTOM COMMANDER edition',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await noOverflow(page);const dialog=await page.getByRole('dialog').boundingBox();expect(dialog!.y).toBeGreaterThanOrEqual(0);expect(dialog!.y+dialog!.height).toBeLessThanOrEqual(size.height+1);await page.screenshot({path:info.outputPath('commander-dialog-'+size.width+'.png')});
  await page.getByRole('button',{name:'REVIEW SELECTION',exact:true}).click();await expect(page.getByText('PAYMENT PREVIEW / NO CHARGES')).toBeVisible();await expect(page.getByRole('button',{name:'PURCHASES OPEN SOON',exact:true})).toBeDisabled();await noOverflow(page);await page.getByRole('button',{name:'Close purchase preview'}).click();
 }
 expect(fixture.errors).toEqual([]);expect(fixture.writes).toEqual([]);
});

test('soldier editions expose real distinct hardware and demand-rendered 3D inspection',async({page},info)=>{
 test.setTimeout(240000);const fixture=await accountFixture(page);await page.goto('/store/characters');await ready(page);
 const editions=page.getByRole('region',{name:'Compare soldier editions'});await expect(editions.locator('article')).toHaveCount(3);
 for(const [id,price]of [['shadow','$4.99'],['midnight','$9.99'],['commander','$14.99']])await expect(editions.locator('[data-edition='+id+']')).toContainText(price);
 await expect(editions).toContainText('Quad-lens night optics');await expect(editions).toContainText('split command mantle');
 await editions.locator('img').evaluateAll(async images=>{await Promise.all(images.map(image=>(image as HTMLImageElement).decode()));});
 await page.screenshot({path:info.outputPath('soldier-tier-comparison.png'),fullPage:true});
 await editions.getByRole('button',{name:'Inspect LEGENDARY PHANTOM COMMANDER edition',exact:true}).click();await expect.poll(()=>page.getByRole('dialog').evaluate(d=>d.contains(document.activeElement))).toBe(true);await page.getByRole('button',{name:'INSPECT IN 3D',exact:true}).click();await expect(page.getByRole('img',{name:'Interactive commander collection model'})).toBeVisible({timeout:60000});await expect(page.getByText('OPENING THE STUDIO',{exact:true})).toHaveCount(0,{timeout:60000});await expect(page.getByText('MODEL COULD NOT LOAD',{exact:true})).toHaveCount(0);
 const canvas=page.locator('.rs-model canvas'),bounds=await canvas.boundingBox();expect(bounds).not.toBeNull();await page.mouse.move(bounds!.x+bounds!.width*.6,bounds!.y+bounds!.height*.5);await page.mouse.down();await page.mouse.move(bounds!.x+bounds!.width*.25,bounds!.y+bounds!.height*.5,{steps:12});await page.mouse.up();
 await page.screenshot({path:info.outputPath('commander-real-3d.png'),fullPage:true});await page.getByRole('button',{name:'Close product details'}).click();await expect(page.locator('canvas')).toHaveCount(0);expect(fixture.errors).toEqual([]);expect(fixture.writes).toEqual([]);
});

test('authentication retains the existing sign-in choices in the new shell',async({page},info)=>{
 const fixture=await accountFixture(page,false);
 for(const size of [{width:1440,height:1000},{width:390,height:844},{width:320,height:568}]){
  await page.setViewportSize(size);await page.goto('/');await expect(page.getByRole('heading',{name:'Sign in to RIVALS',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toBeEnabled();await noOverflow(page);await page.screenshot({path:info.outputPath('login-'+size.width+'.png'),fullPage:true});
 }
 expect(fixture.errors).toEqual([]);expect(fixture.writes).toEqual([]);
});
