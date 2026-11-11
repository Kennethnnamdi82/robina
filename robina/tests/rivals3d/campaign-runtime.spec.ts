import {test,expect} from '@playwright/test';
import type {RaidRuntime,Diagnostics3D} from '../../src/features/rivals/three/RaidRuntime';
import type {SandboxSession} from '../../src/features/rivals/three/SandboxSession';
type RuntimeFixture=Window&{__campaignRuntime:{runtime:RaidRuntime;session:SandboxSession;metrics?:Diagnostics3D}};
test.use({launchOptions:{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
test('real runtime serves food, revives once and pays only after the boss handoff',async({page},info)=>{
  test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/tests/rivals3d/entry.tsx',route=>route.fulfill({contentType:'application/javascript',body:''}));await page.goto('/tests/rivals3d/index.html');
  await page.evaluate(async()=>{
    const load=(path:string)=>import(/* @vite-ignore */path),{RaidRuntime}=await load('/src/features/rivals/three/RaidRuntime.ts'),{SandboxSession}=await load('/src/features/rivals/three/SandboxSession.ts'),{createAssignmentOperation}=await load('/src/features/rivals/three/Operations.ts'),{createPlayerEconomy}=await load('/src/features/rivals/progression/PlayerEconomy.ts');
    Object.defineProperty(window,'devicePixelRatio',{value:.5,configurable:true});const host=document.createElement('div');host.style.cssText='width:800px;height:500px';document.body.replaceChildren(host);
    const economy=createPlayerEconomy(null);economy.award('previous-run',6);const session=new SandboxSession({quality:'low'},createAssignmentOperation(0,43),economy);
    const fixture=(window as unknown as RuntimeFixture).__campaignRuntime={session,runtime:undefined as unknown as RaidRuntime,metrics:undefined};fixture.runtime=new RaidRuntime(host,session,(metrics:Diagnostics3D)=>{fixture.metrics=metrics;});
  });
  await expect.poll(()=>page.evaluate(()=>(window as unknown as RuntimeFixture).__campaignRuntime.session.getSnapshot().status),{timeout:150000}).not.toBe('loading');
  const status=await page.evaluate(()=>{const s=(window as unknown as RuntimeFixture).__campaignRuntime.session.getSnapshot();return{status:s.status,error:s.error};});expect(status,JSON.stringify(status)).toMatchObject({status:'playing'});
  const social=await page.evaluate(()=>{
    const q=(window as unknown as RuntimeFixture).__campaignRuntime;q.session.pause();q.runtime.body.position.set(124,0,68);q.runtime.controller.vitality.current=40;
    (q.runtime as unknown as {interact:()=>void}).interact();const venue=q.metrics?.social?.venue,before=q.session.economy.getSnapshot().cash;
    q.runtime.purchaseSocial('meal');const after=q.session.economy.getSnapshot().cash,health=q.runtime.controller.health;return{venue,before,after,health,gesture:q.metrics?.social?.gesture};
  });expect(social.venue).toBe('restaurant');expect(social.after).toBe(social.before-1200);expect(social.health).toBe(90);expect(social.gesture).toBe('eat');
  const revive=await page.evaluate(()=>{const q=(window as unknown as RuntimeFixture).__campaignRuntime;q.runtime.controller.vitality.current=0;q.session.offerRevive();const before=q.session.economy.getSnapshot().coins,ok=q.runtime.revive(),twice=q.runtime.revive();q.session.pause();return{before,after:q.session.economy.getSnapshot().coins,ok,twice,health:q.runtime.controller.health,protected:q.runtime.controller.vitality.invulnerable};});
  expect(revive).toMatchObject({ok:true,twice:false});expect(revive.before-revive.after).toBe(1000);expect(revive.health).toBeGreaterThan(0);expect(revive.protected).toBeGreaterThan(0);
  const handoff=await page.evaluate(()=>{
    const q=(window as unknown as RuntimeFixture).__campaignRuntime,mission=q.session.mission,game=q.runtime.campaign!;q.runtime.pursuit!.end();
    for(const objective of mission.definition.objectives)if(objective.id!=='extract')mission.event(objective.event);
    game.carrying=true;q.runtime.body.position.set(136,0,32);game.interact(q.runtime.body.position);
    const waiting=game.handoff,previous=q.session.economy.getSnapshot().cash,notPaid=!q.session.economy.getSnapshot().rewards[mission.runId];
    const ok=q.runtime.confirmHandoff(),again=q.runtime.confirmHandoff();return{waiting,previous,notPaid,ok,again,cash:q.session.economy.getSnapshot().cash,state:mission.state,receipt:q.session.economy.getSnapshot().rewards[mission.runId]};
  });expect(handoff).toMatchObject({waiting:'waiting',notPaid:true,ok:true,again:false,state:'SUCCESS',receipt:{cash:20000,coins:1500}});expect(handoff.cash-handoff.previous).toBe(20000);
  await page.screenshot({path:info.outputPath('full-runtime-boss-handoff.png')});
  await page.evaluate(()=>{const q=(window as unknown as RuntimeFixture).__campaignRuntime;q.runtime.dispose();q.session.dispose();});expect(errors).toEqual([]);
});
