import {expect,test} from '@playwright/test';
test('tiny direction cue and nonvisual dispatch leave the player unobstructed',async({page},info)=>{
  await page.route('**/tests/rivals3d/entry.tsx',r=>r.fulfill({contentType:'application/javascript',body:''}));await page.goto('/tests/rivals3d/index.html');
  await page.evaluate(async()=>{
    const load=(url:string)=>import(/* @vite-ignore */url);
    for(const url of ['/src/features/rivals/rivals.css','/src/features/rivals/three/sandbox.css','/src/features/rivals/three/command-hud.css','/src/features/rivals/three/gameplay-clarity.css'])await load(url);
    const React=(await load('/node_modules/.vite-rivals3d/deps/react.js')).default,{createRoot}=(await load('/node_modules/.vite-rivals3d/deps/react-dom_client.js')).default,{DirectionGuide}=await load('/src/features/rivals/three/DirectionGuide.tsx'),{PursuitAnnouncement}=await load('/src/features/rivals/three/PursuitAnnouncement.tsx');
    document.body.innerHTML='<main class="rivals-shell r3-shell"><section class="rivals-game-view r3-game"><div id="fixture"></div></section></main>';
    createRoot(document.getElementById('fixture')).render(React.createElement(React.Fragment,null,React.createElement(DirectionGuide,{metrics:{navigation:{goal:{x:400,y:400},distance:52,bearing:0},vehicle:{nearby:'sedan',driving:false}}}),React.createElement(PursuitAnnouncement,{metrics:{pursuit:{active:true,units:3,evading:0}}}),React.createElement('button',{className:'r3-enter-car'},'ENTER SEDAN · F')));
  });
  for(const [width,height]of [[320,740],[390,844],[568,320],[844,390],[1130,340]]){
    await page.setViewportSize({width,height});const arrow=await page.getByRole('img',{name:'Red direction arrow'}).boundingBox(),entry=await page.getByRole('button',{name:'ENTER SEDAN · F'}).boundingBox();expect(arrow&&entry&&(arrow.y+arrow.height<=entry.y||arrow.y>=entry.y+entry.height),`${width}x${height}`).toBe(true);const cue=page.locator('.r3-direction-guide');expect(await cue.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');const rect=await cue.boundingBox();expect(rect!.width).toBeLessThanOrEqual(76);expect(rect!.height).toBeLessThanOrEqual(18);expect(rect!.y+rect!.height).toBeLessThan(height*.4);expect(arrow!.width).toBeLessThanOrEqual(16);
    await expect(page.locator('.r3-dispatch')).toHaveCount(0);
    const announcement=page.getByRole('status');await expect(announcement).toContainText('POLICE RESPONSE / 3 UNITS');
    const hidden=await announcement.evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,clip:getComputedStyle(el).clipPath,pointer:getComputedStyle(el).pointerEvents}));
    expect(hidden).toEqual({width:1,height:1,clip:'inset(50%)',pointer:'none'});
    for(const mode of ['driving','nearby']){await cue.evaluate((el,mode)=>{el.setAttribute('data-driving',String(mode==='driving'));el.setAttribute('data-nearby',String(mode==='nearby'));},mode);expect((await cue.boundingBox())!.height).toBeLessThanOrEqual(18);}
    await page.screenshot({path:info.outputPath(`clear-navigation-${width}x${height}.png`)});
  }
});
