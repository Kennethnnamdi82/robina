import {test,expect,type Page} from '@playwright/test';

const APK='https://github.com/Kennethnnamdi82/rivals-heist-android/releases/latest/download/RIVALS-RIVAL-HEIST.apk';
async function prepare(page:Page,available:boolean,authenticated=false){
 if(process.env.PRODUCTION_TEST_BYPASS_COOKIE){
  const cookie=JSON.parse(process.env.PRODUCTION_TEST_BYPASS_COOKIE);
  if(new URL(cookie.url).origin!==new URL(test.info().project.use.baseURL!).origin)throw Error('Staging cookie target mismatch');
  await page.context().addCookies([cookie]);
 }
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/android-release'){await route.fulfill({json:available?{available:true,url:APK,version:'1.0.1011',versionCode:1011,bytes:40000000,minAndroid:'7.0'}:{available:false}});return;}
  if(url.pathname.startsWith('/api/')){
   if(authenticated&&url.pathname==='/api/auth/me'){await route.fulfill({json:{user:{wallet:'0x1111111111111111111111111111111111111111',chainType:'evm',completedTasks:[]}}});return;}
   await route.fulfill({status:401,json:{error:'unauthenticated'}});return;
  }
  if(url.origin===new URL(test.info().project.use.baseURL!).origin){await route.continue();return;}
  await route.abort();
 });
 return errors;
}
for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
 test(`Android download on the existing login page ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);const errors=await prepare(page,true);await page.goto('/');
  await expect(page.getByRole('heading',{name:'Sign in to RIVALS'})).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'Continue with Google'})).toBeEnabled();
  const download=page.getByRole('link',{name:/DOWNLOAD FOR ANDROID/});await download.scrollIntoViewIfNeeded();
  await expect(download).toBeVisible();await expect(download).toHaveAttribute('href',APK);
  await expect(download).toHaveAttribute('download','RIVALS-RIVAL-HEIST.apk');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
 });
}
test('login never advertises a nonexistent production APK',async({page})=>{
 const errors=await prepare(page,false);await page.goto('/');
 await expect(page.getByRole('button',{name:'ANDROID RELEASE NOT AVAILABLE YET'})).toBeDisabled({timeout:30000});
 await expect(page.getByRole('link',{name:/DOWNLOAD FOR ANDROID/})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Continue with Google'})).toBeEnabled();expect(errors).toEqual([]);
});
test('system-browser handoff asks for consent without launching the web game',async({page})=>{
 const errors=await prepare(page,false,true);await page.goto('/native-sign-in?'+new URLSearchParams({state:'s'.repeat(43),challenge:'c'.repeat(43)}));
 await expect(page.getByRole('button',{name:'AUTHORIZE AND RETURN TO APP'})).toBeVisible({timeout:30000});
 await expect(page.locator('.r3-game')).toHaveCount(0);expect(errors).toEqual([]);
});
