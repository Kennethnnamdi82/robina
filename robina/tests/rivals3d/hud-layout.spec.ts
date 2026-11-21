import {test,expect} from '@playwright/test';
test.use({hasTouch:true});
test('icon controls stay readable and separated across raid views on compact phones',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/tests/rivals3d/entry.tsx',r=>r.fulfill({contentType:'application/javascript',body:''}));await page.goto('/tests/rivals3d/index.html');
  await page.evaluate(async()=>{
    const load=(url:string)=>import(/* @vite-ignore */url);
    for(const url of ['/src/features/rivals/rivals.css','/src/features/rivals/missions.css','/src/features/rivals/three/sandbox.css','/src/features/rivals/three/command-hud.css','/src/features/rivals/three/gameplay-clarity.css','/src/features/rivals/three/cinematic-hud.css','/src/features/rivals/three/cinematic-gameplay.css','/src/features/rivals/three/touch-hud.css'])await load(url);
    const React=(await load('/node_modules/.vite-rivals3d/deps/react.js')).default,{createRoot}=(await load('/node_modules/.vite-rivals3d/deps/react-dom_client.js')).default;
    const {SandboxSession}=await load('/src/features/rivals/three/SandboxSession.ts'),{Loadout}=await load('/src/features/rivals/three/Loadout.ts'),{SoldierControls,SoldierDock}=await load('/src/features/rivals/three/SoldierHUD.tsx'),{ArenaHUD}=await load('/src/features/rivals/ui/ArenaHUD.tsx'),{DirectionGuide}=await load('/src/features/rivals/three/DirectionGuide.tsx');
    const session=new SandboxSession();session.update({status:'playing',player:{x:288,y:288},nearby:{id:'sample',name:'Field kit',description:'Collect equipment',active:false},soldier:{...new Loadout().snapshot(),bombs:3,canThrow:true,blocked:false}});
    const {MissionRadar}=await load('/src/features/rivals/three/MissionRadar.tsx');
    document.body.innerHTML='<main class="rivals-shell r3-shell"><section class="rivals-game-view r3-game" id="fixture" data-status="playing"></section></main>';
    const root=createRoot(document.getElementById('fixture'));
    const draw=(pov:string)=>root.render(React.createElement(React.Fragment,null,
      React.createElement(ArenaHUD,{session,onAudio:()=>{},securityOnMap:true,level:session.operation.level}),
      React.createElement(MissionRadar,{session,metrics:{navigation:{goal:{x:800,y:800},route:[],distance:48}}}),
      React.createElement(DirectionGuide,{metrics:{navigation:{goal:{x:800,y:800},distance:48,bearing:.4}}}),
      React.createElement(SoldierControls,{session,pov}),React.createElement(SoldierDock,{session}),
      React.createElement('button',{className:'r3-enter-car r3-touch-key','aria-label':'Enter sedan'}),
      React.createElement('div',{className:'r3-utility'},React.createElement('button',{className:'r3-touch-key','aria-label':'Cycle camera view'}),React.createElement('button',{className:'r3-touch-key','aria-label':'Camera zoom'}))));
    Reflect.set(window,'setHudView',draw);draw('third');
  });
  await expect(page.getByTestId('aim-stick')).toBeVisible();
  await expect(page.locator('.r3-mission-radar .rivals-minimap')).toBeVisible();
  for(const pov of ['third','first','side','tactical'])for(const[width,height]of [[390,844],[320,568],[844,390],[568,320]]){
    await page.setViewportSize({width,height});
    await page.evaluate(view=>Reflect.get(window,'setHudView')(view),pov);
    await expect(page.locator('.r3-soldier-controls')).toHaveAttribute('data-pov',pov);
    await expect(page.getByRole('button',{name:pov==='first'?'Shoot weapon':'Fire weapon'})).toBeVisible();
    const bad=await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll<HTMLElement>('button.r3-touch-key,.r3-slots button,.rivals-minimap,.rv-vitals,[data-testid=movement-stick],[data-testid=aim-stick]')].filter(n=>getComputedStyle(n).display!=='none'&&n.getClientRects().length),bad:string[]=[];
      for(const key of document.querySelectorAll<HTMLButtonElement>('.r3-action-controls button,.r3-fps-shoot')){
        if(!key.querySelector('svg')||/[a-z]/i.test(key.textContent??''))bad.push('Missing icon or visible text: '+key.getAttribute('aria-label'));
        if(key.getClientRects().length&&(key.offsetWidth<44||key.offsetHeight<44))bad.push('Small target: '+key.getAttribute('aria-label'));
      }
      for(let i=0;i<nodes.length;i++){const a=nodes[i].getBoundingClientRect();if(a.left<0||a.right>innerWidth+1||a.top<0||a.bottom>innerHeight+1)bad.push('bounds: '+(nodes[i].getAttribute('aria-label')??nodes[i].className));for(let j=i+1;j<nodes.length;j++){const b=nodes[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)bad.push((nodes[i].getAttribute('aria-label')??nodes[i].className)+' / '+(nodes[j].getAttribute('aria-label')??nodes[j].className));}}
      return bad;
    });
    if(bad.length)console.log(await page.locator('.rv-hud-left,.rv-vitals,.rv-objective').evaluateAll(nodes=>nodes.map(n=>({name:n.className,rect:n.getBoundingClientRect().toJSON(),width:getComputedStyle(n).width,box:getComputedStyle(n).boxSizing}))));
    if((width===390||width===844)&&(pov==='first'||pov==='third'))await page.screenshot({path:info.outputPath('hud-'+pov+'-'+width+'x'+height+'.png')});
    expect(bad,pov+' '+width+'x'+height).toEqual([]);
  }
});
