import {test,expect} from '@playwright/test';
test('leaderboard has focused personal and exhibition views across screen sizes',async({page},info)=>{
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname==='/api/auth/me'){await route.fulfill({json:{user:{wallet:'0x1111111111111111111111111111111111111111',chainType:'evm',bdBalance:0,level:'Beginner',lastClaimTime:null,autoClaimActive:false,autoClaimExpiry:null,referralCode:'',referralCount:0,completedTasks:[],lastDailyTaskDate:''}}});return;}if(url.pathname.startsWith('/api/')){await route.fulfill({status:401,json:{error:'unauthorized'}});return;}if(url.origin==='http://127.0.0.1:8086')await route.continue();else await route.abort();});
  await page.goto('/leaderboards');await expect(page.getByRole('heading',{name:'LEADERBOARDS',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'SET THE FIRST BENCHMARK.'})).toBeVisible();
  await page.getByRole('button',{name:'EXHIBITION STANDINGS'}).click();await expect(page.getByText(/Exhibition players are fictional/)).toBeVisible();
  for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width+1);await page.screenshot({path:info.outputPath('leaderboard-'+viewport.width+'.png'),fullPage:true});
  }
  await page.getByRole('textbox',{name:'Search leaderboard'}).fill('no such rival');await expect(page.getByRole('heading',{name:'TRY ANOTHER SEARCH'})).toBeVisible();
  await page.getByRole('button',{name:'MY RECORDED RUNS'}).click();await expect(page.getByRole('heading',{name:'SET THE FIRST BENCHMARK.'})).toBeVisible();
});
