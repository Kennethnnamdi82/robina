import {test,expect} from '@playwright/test';
test('real on-foot HUD touch targets remain separated on compact phones',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/tests/rivals3d/entry.tsx',r=>r.fulfill({contentType:'application/javascript',body:''}));await page.goto('/tests/rivals3d/index.html');
  await page.evaluate(async()=>{
    const load=(url:string)=>import(/* @vite-ignore */url);
    for(const url of ['/src/features/rivals/rivals.css','/src/features/rivals/missions.css','/src/features/rivals/three/sandbox.css','/src/features/rivals/three/command-hud.css','/src/features/rivals/three/gameplay-clarity.css'])await load(url);
    const React=(await load('/node_modules/.vite-rivals3d/deps/react.js')).default,{createRoot}=(await load('/node_modules/.vite-rivals3d/deps/react-dom_client.js')).default;
    const {SandboxSession}=await load('/src/features/rivals/three/SandboxSession.ts'),{Loadout}=await load('/src/features/rivals/three/Loadout.ts'),{SoldierControls,SoldierDock}=await load('/src/features/rivals/three/SoldierHUD.tsx'),{ArenaHUD}=await load('/src/features/rivals/ui/ArenaHUD.tsx'),{DirectionGuide}=await load('/src/features/rivals/three/DirectionGuide.tsx');
    const session=new SandboxSession();session.update({status:'playing',player:{x:288,y:288},soldier:{...new Loadout().snapshot(),bombs:3,canThrow:true,blocked:false}});
    const {MissionRadar}=await load('/src/features/rivals/three/MissionRadar.tsx');
    document.body.innerHTML='<main class="rivals-shell r3-shell"><section class="rivals-game-view r3-game" id="fixture"></section></main>';
    createRoot(document.getElementById('fixture')).render(React.createElement(React.Fragment,null,
      React.createElement(ArenaHUD,{session,onAudio:()=>{},securityOnMap:true,level:session.operation.level}),
      React.createElement(MissionRadar,{session,metrics:{navigation:{goal:{x:800,y:800},route:[],distance:48}}}),
      React.createElement(DirectionGuide,{metrics:{navigation:{goal:{x:800,y:800},distance:48,bearing:.4}}}),
      React.createElement(SoldierControls,{session,pov:'third'}),React.createElement(SoldierDock,{session}),
      React.createElement('div',{className:'r3-utility'},React.createElement('button',{'aria-label':'Cycle camera view'},'TPS'),React.createElement('button',{'aria-label':'Camera zoom'},'1.0×'))));
  });
  await expect(page.getByTestId('aim-stick')).toBeVisible();
  await expect(page.locator('.r3-mission-radar .rivals-minimap')).toBeVisible();
  for(const[width,height]of [[390,844],[320,568],[844,390],[568,320]]){
    await page.setViewportSize({width,height});
    const bad=await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll<HTMLElement>('.rv-action-buttons button,.rv-sprint-control,.r3-slots button,.r3-utility button,.rivals-minimap,.rv-vitals,.rv-objective,[data-testid=movement-stick],[data-testid=aim-stick]')].filter(n=>getComputedStyle(n).display!=='none'&&n.getClientRects().length),bad:string[]=[];
      for(let i=0;i<nodes.length;i++){const a=nodes[i].getBoundingClientRect();if(a.left<0||a.right>innerWidth+1||a.top<0||a.bottom>innerHeight+1)bad.push('bounds: '+(nodes[i].getAttribute('aria-label')??nodes[i].className));for(let j=i+1;j<nodes.length;j++){const b=nodes[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)bad.push((nodes[i].getAttribute('aria-label')??nodes[i].className)+' / '+(nodes[j].getAttribute('aria-label')??nodes[j].className));}}
      return bad;
    });
    if(bad.length)console.log(await page.locator('.rv-hud-left,.rv-vitals,.rv-objective').evaluateAll(nodes=>nodes.map(n=>({name:n.className,rect:n.getBoundingClientRect().toJSON(),width:getComputedStyle(n).width,box:getComputedStyle(n).boxSizing}))));
    await page.screenshot({path:info.outputPath('hud-'+width+'x'+height+'.png')});expect(bad,width+'x'+height).toEqual([]);
  }
});
