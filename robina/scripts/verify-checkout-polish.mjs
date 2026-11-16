import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const origin=process.env.RIVALS_QA_ORIGIN||'http://127.0.0.1:8099';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('QA requires an isolated loopback server');
await mkdir('test-results/checkout-polish',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,hasTouch:viewport.width<1000,isMobile:viewport.width<1000});let order,checkouts=0;const errors=[];
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname.startsWith('/api/payments/')){
      const now=new Date().toISOString();
      if(url.pathname.endsWith('/checkout')){const input=request.postDataJSON();if(input.sku!=='support'||input.amountCents!==1234)throw Error('Incorrect custom support amount');checkouts++;order={id:'0123456789abcdef01234567',sku:'support',name:'SUPPORT THE DEVELOPER',cents:1234,currency:'USD',environment:'sandbox',status:'pending',createdAt:now,expiresAt:new Date(Date.now()+600000).toISOString(),serverTime:now,checkoutUrl:'https://checkout.bachs.io/c/isolated-ui-check'};return route.fulfill({json:order});}
      if(url.pathname.endsWith('/store'))return route.fulfill({json:{ownedIds:[],equippedIds:[],grenadeBalance:5,recoveryUntil:null,serverTime:now,spendingBlocked:false,purchases:order?[order]:[],configured:true,environment:'sandbox',catalog:[{id:'support',name:'SUPPORT THE DEVELOPER',cents:100,currency:'USD',kind:'support',enabled:true}]}});
      return route.fulfill({json:order});
    }
    if(url.hostname==='checkout.bachs.io')return route.fulfill({contentType:'text/html',body:'<h1>Original checkout resumed / isolated check</h1>'});
    if(url.origin===new URL(origin).origin)return route.continue();
    return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/tests/rivals3d/support.html',{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.getByRole('heading',{name:/KEEP THE/})).toBeVisible({timeout:45000});await expect(page.getByRole('button',{name:'REVIEW YOUR SUPPORT'})).toBeEnabled({timeout:20000});
  await page.getByLabel('YOUR AMOUNT / USD').fill('12.34');if(checkouts!==0)throw Error('Browsing created an order');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)throw Error('Support page horizontal overflow');
  await page.screenshot({path:`test-results/checkout-polish/support-${viewport.width}x${viewport.height}.png`,fullPage:true});
  await page.getByRole('button',{name:'REVIEW YOUR SUPPORT'}).click();if(checkouts!==0)throw Error('Review created an order');
  await page.getByRole('button',{name:/CONFIRM \/ CONTINUE TO BACHS/}).click();await expect(page.getByRole('button',{name:'CONTINUE PAYMENT'})).toBeVisible();await expect(page.getByRole('timer')).toContainText(/09:|10:/);
  await page.getByRole('button',{name:'Close checkout'}).click();await page.getByRole('link',{name:'YOUR PAYMENT HISTORY'}).click();
  await page.getByRole('link',{name:'CONTINUE PAYMENT'}).click();await expect(page.getByText('YOUR PAYMENT',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'CONTINUE PAYMENT'})).toBeVisible();if(checkouts!==1)throw Error('Resume created another order');
  await page.screenshot({path:`test-results/checkout-polish/resume-${viewport.width}x${viewport.height}.png`,fullPage:true});
  await page.getByRole('button',{name:'CONTINUE PAYMENT'}).click();await expect(page.getByRole('heading',{name:/Original checkout resumed/})).toBeVisible();
  if(errors.length)throw Error(errors.join('; '));console.log(JSON.stringify({viewport,exactCents:1234,checkouts,resumedOriginal:true,horizontalOverflow:overflow,pageErrors:errors.length}));await context.close();
}}finally{await browser.close();}
