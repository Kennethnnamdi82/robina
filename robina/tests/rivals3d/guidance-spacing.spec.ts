import {expect,test} from '@playwright/test';
test('readable objective arrow stays clear of Enter Vehicle on small screens',async({page})=>{
  await page.route('**/tests/rivals3d/entry.tsx',r=>r.fulfill({contentType:'application/javascript',body:''}));await page.goto('/tests/rivals3d/index.html');
  await page.evaluate(async()=>{
    const load=(url:string)=>import(/* @vite-ignore */url);
    for(const url of ['/src/features/rivals/rivals.css','/src/features/rivals/three/sandbox.css','/src/features/rivals/three/command-hud.css','/src/features/rivals/three/gameplay-clarity.css'])await load(url);
    const React=(await load('/node_modules/.vite-rivals3d/deps/react.js')).default,{createRoot}=(await load('/node_modules/.vite-rivals3d/deps/react-dom_client.js')).default,{DirectionGuide}=await load('/src/features/rivals/three/DirectionGuide.tsx');
    document.body.innerHTML='<main class="rivals-shell r3-shell"><section class="rivals-game-view r3-game"><div id="fixture"></div></section></main>';
    createRoot(document.getElementById('fixture')).render(React.createElement(React.Fragment,null,React.createElement(DirectionGuide,{metrics:{navigation:{goal:{x:400,y:400},distance:52,bearing:0},vehicle:{nearby:'sedan',driving:false}}}),React.createElement('button',{className:'r3-enter-car'},'ENTER SEDAN · F')));
  });
  for(const [width,height]of [[320,740],[390,844],[568,320],[844,390]]){
    await page.setViewportSize({width,height});const arrow=await page.getByRole('img',{name:'Red direction arrow'}).boundingBox(),entry=await page.getByRole('button',{name:'ENTER SEDAN · F'}).boundingBox();expect(arrow&&entry&&(arrow.y+arrow.height<=entry.y||arrow.y>=entry.y+entry.height),`${width}x${height}`).toBe(true);const cue=page.locator('.r3-direction-guide');expect(await cue.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');const rect=await cue.boundingBox();expect(rect!.width).toBeLessThanOrEqual(105);expect(rect!.height).toBeLessThanOrEqual(40);expect(rect!.y+rect!.height).toBeLessThan(height*.4);
  }
});
