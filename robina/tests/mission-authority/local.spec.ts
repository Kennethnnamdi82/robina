import {expect,test,type Page,type APIRequestContext} from '@playwright/test';
import type {RaidRuntime} from '../../src/features/rivals/three/RaidRuntime';
import type {LocalMission} from '../../src/services/localMission';
const backend='http://127.0.0.1:4106';
test.use({hasTouch:true,isMobile:true});
async function deploy(page:Page,request:APIRequestContext){
  const session=await(await request.get(backend+'/__test/session')).json();
  await page.context().addCookies([{name:'bd_session',value:session.token,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax',secure:false}]);
  await page.goto('/tests/mission-authority/index.html');await page.getByRole('button',{name:'ENTER 3D RAID'}).click();await page.bringToFront();
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:180000});
  await expect.poll(()=>page.evaluate(()=>Boolean(Reflect.get(window,'localMission'))),{timeout:30000}).toBeTruthy();
  expect(await page.evaluate(()=>Reflect.get(window,'localMission').permit.simulationVersion)).toBe(5);
  return session.playerId as string;
}
test('rendered walking, running and driving keep held touch input through a resize offline',async({page,request},info)=>{
  const errors:string[]=[],gameplayRequests:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('websocket',socket=>{if(socket.url().includes('/socket.io/'))errors.push('Unexpected gameplay socket: '+socket.url());});
  const playerId=await deploy(page,request),state=page.getByTestId('three-state');
  page.on('request',req=>{if(/\/api\/missions\//.test(req.url()))gameplayRequests.push(req.url());});
  await page.context().setOffline(true);
  await page.evaluate(()=>{
    const client=Reflect.get(window,'localMission') as LocalMission,runtime=Reflect.get(window,'raidRuntime') as RaidRuntime,sim=client.localSimulation;
    sim.neutral();sim.controller.stop();sim.police.end();sim.enemies.forEach(enemy=>enemy.health.current=0);sim.body.position.set(8,0,8);
    for(const car of sim.traffic.cars)Object.assign(car,{x:-1000-car.id*10,z:-1000,speed:0,mode:'parked'});
    runtime.rig.yaw=-Math.PI;client.flushMovement();Reflect.get(window,'movementAudit').recording=true;
  });
  const touch=await page.context().newCDPSession(page);
  const holdForward=async(stick:'movement-stick'|'driving-stick',distance:number)=>{
    const bounds=(await page.getByTestId(stick).boundingBox())!;
    const start=Number(await state.getAttribute('data-z'));
    const finger={id:1,x:bounds.x+bounds.width/2,y:bounds.y+bounds.height*.15};
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});
    try{
      await expect.poll(async()=>Number(await state.getAttribute('data-z')),{timeout:60000}).toBeGreaterThan(start+2);
      const afterResize=await page.evaluate(stick=>{
        const runtime=Reflect.get(window,'raidRuntime') as RaidRuntime;
        window.dispatchEvent(new Event('resize'));
        return stick==='movement-stick'?runtime.session.input.touchMoving:Reflect.get(runtime,'drivingInput').stickY<-.9;
      },stick);
      expect(afterResize).toBe(true);
      await expect.poll(async()=>Number(await state.getAttribute('data-z')),{timeout:60000}).toBeGreaterThan(start+distance);
    }finally{await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  };
  await holdForward('movement-stick',6);
  const walked=Number(await state.getAttribute('data-z'));
  const sprint=page.getByRole('button',{name:'Toggle sprint'});
  await sprint.tap();await expect(sprint).toHaveAttribute('aria-pressed','true');
  await holdForward('movement-stick',5);
  await sprint.tap();
  const samples=await page.evaluate(()=>{const audit=Reflect.get(window,'movementAudit');audit.recording=false;return audit.samples as {at:number;z:number}[];});
  expect(samples.length).toBeGreaterThanOrEqual(5);for(let i=2;i<samples.length;i++)expect(samples[i].z-samples[i-1].z).toBeGreaterThanOrEqual(-.01);
  for(const pov of ['third','first'] as const){
    await page.evaluate(pov=>(Reflect.get(window,'raidRuntime') as RaidRuntime).setPOV(pov),pov);
    const shoot=page.getByRole('button',{name:pov==='first'?'Shoot weapon':'Fire weapon'});await expect(shoot).toBeVisible();const bounds=(await shoot.boundingBox())!;
    const before=await page.evaluate(()=>({yaw:Reflect.get(window,'raidRuntime').rig.yaw,shots:Reflect.get(window,'localMission').localSimulation.firearmShots}));
    const finger={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,id:3};
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});
    try{
      await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...finger,x:finger.x+60,y:finger.y-12}]});
      const yaw=await page.evaluate(()=>Reflect.get(window,'raidRuntime').rig.yaw);expect(yaw-before.yaw).toBeCloseTo(-.18,2);
      await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'localMission').localSimulation.firearmShots),{timeout:30000}).toBeGreaterThan(before.shots);
    }finally{await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  }
  await page.evaluate(()=>{
    const client=Reflect.get(window,'localMission') as LocalMission,runtime=Reflect.get(window,'raidRuntime') as RaidRuntime,sim=client.localSimulation;
    sim.controller.stop();sim.body.position.set(5.9,0,12);Object.assign(sim.traffic.cars[28],{x:8,z:12,dx:0,dz:1,speed:0,mode:'parked'});
    Object.assign(sim.traffic.cars[14],{x:6.6,z:12,dx:0,dz:1,speed:0,mode:'traffic'});
    runtime.setPOV('third');runtime.rig.yaw=-Math.PI;
  });
  const enter=page.getByRole('button',{name:'Enter sedan'});
  await expect(enter).toBeVisible({timeout:30000});
  await enter.tap();
  await expect.poll(async()=>JSON.parse((await state.getAttribute('data-vehicle'))!).id,{timeout:30000}).toBe(28);
  const exit=page.getByRole('button',{name:'Exit vehicle'});
  await expect(exit).toBeVisible({timeout:30000});
  await page.evaluate(()=>{const audit=Reflect.get(window,'movementAudit');audit.samples=[];audit.recording=true;});
  await holdForward('driving-stick',8);
  await touch.detach();
  const rendered=await page.evaluate(()=>{
    const runtime=Reflect.get(window,'raidRuntime') as RaidRuntime;
    const traffic=Reflect.get(runtime,'art').city.traffic;
    const z=(Reflect.get(runtime,'renderPosition') as {z:number}).z;
    const meshZ:number[]=[];
    // Inspect actual live body mesh transforms, not the vehicle controller
    // coordinates or separately drawn headlights and doors.
    for(const {mesh} of Reflect.get(traffic,'batches')){
      const transforms=mesh.instanceMatrix.array;
      for(let i=0;i<mesh.count;i++)meshZ.push(transforms[i*16+14]);
    }
    return {z,meshZ};
  });
  expect(rendered.meshZ.length).toBeGreaterThan(0);
  expect(rendered.meshZ.every(z=>Math.abs(z-rendered.z)<4)).toBe(true);
  const drivingSamples=await page.evaluate(()=>{const audit=Reflect.get(window,'movementAudit');audit.recording=false;return audit.samples as {at:number;z:number}[];});
  for(let i=2;i<drivingSamples.length;i++)expect(drivingSamples[i].z-drivingSamples[i-1].z).toBeGreaterThanOrEqual(-.01);
  await expect.poll(async()=>JSON.parse((await state.getAttribute('data-vehicle'))!).speed,{timeout:30000}).toBeLessThanOrEqual(2);
  await exit.tap();
  await expect.poll(async()=>JSON.parse((await state.getAttribute('data-vehicle'))!).driving,{timeout:30000}).toBe(false);
  const parked=await page.evaluate(()=>{
    const client=Reflect.get(window,'localMission') as LocalMission,runtime=Reflect.get(window,'raidRuntime') as RaidRuntime;
    const sim=client.localSimulation,car=sim.traffic.cars[28];
    runtime.setPOV('tactical');sim.controller.stop();
    const edge=car.x-(car.collisionWidth??1.85)/2;
    sim.body.position.set(edge-1.1,0,car.z);
    return {edge,x:sim.body.position.x};
  });
  await page.keyboard.down('KeyD');
  try{
    await expect.poll(async()=>Number(await state.getAttribute('data-x')),{timeout:30000}).toBeGreaterThan(parked.x+.5);
    // Hold against the visible car for a simulated half second.
    const start=await page.evaluate(()=>Reflect.get(window,'localMission').recorder.tape.ticks);
    await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'localMission').recorder.tape.ticks),{timeout:30000}).toBeGreaterThan(start+30);
    expect(Number(await state.getAttribute('data-x'))).toBeLessThanOrEqual(parked.edge-.3);
  }finally{await page.keyboard.up('KeyD');}
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing');expect(gameplayRequests).toEqual([]);expect(errors).toEqual([]);
  await page.context().setOffline(false);
  const stored=await(await request.get(`${backend}/__test/state?playerId=${playerId}`)).json();expect(stored).toMatchObject({sessions:0,checkpoints:0,events:0,life:null,live:null,results:[]});
  await info.attach('offline-rendered-movement',{body:JSON.stringify({samples,drivingSamples,walkingZ:walked,drivingZ:await state.getAttribute('data-z'),fps:await state.getAttribute('data-fps'),frameMs:await state.getAttribute('data-frame-ms')}),contentType:'application/json'});
});
test('a natural victory is durably queued offline and verified once after reconnecting',async({page,request})=>{
  const session=await(await request.get(backend+'/__test/session')).json(),playerId=session.playerId;
  await page.context().addCookies([{name:'bd_session',value:session.token,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax',secure:false}]);
  await page.goto('/tests/mission-authority/completion.html');await expect.poll(()=>page.evaluate(()=>Boolean(Reflect.get(window,'completionTools')))).toBeTruthy();
  const recording=await(await request.get(`${backend}/__test/recording?playerId=${playerId}`)).json();
  await page.context().setOffline(true);
  const outcome=await page.evaluate(async recording=>{
    const {LocalMission,unpackReplayInput,pendingMissions}=Reflect.get(window,'completionTools');
    const client=new LocalMission(recording.permit,'browser-completion-test');client.ready();let tick=0,action=0;
    for(const frame of recording.tape.frames)for(let repeat=0;repeat<frame[0];repeat++){
      while(recording.tape.actions[action]?.tick===tick)client.action(recording.tape.actions[action++].action);
      client.submit(unpackReplayInput(frame,++tick));
    }
    while(recording.tape.actions[action]?.tick===tick)client.action(recording.tape.actions[action++].action);
    client.flushMovement();await client.retrySave();
    while(client.saving==='saving')await new Promise(resolve=>setTimeout(resolve,50));
    Reflect.set(window,'completedMission',client);return {state:client.localSimulation.mission.state,saving:client.saving,count:(await pendingMissions.list('browser-completion-test')).length};
  },recording);
  expect(outcome).toEqual({state:'SUCCESS',saving:'pending',count:1});
  expect((await(await request.get(`${backend}/__test/state?playerId=${playerId}`)).json()).results).toHaveLength(0);
  await page.context().setOffline(false);
  await page.evaluate(async()=>{await(Reflect.get(window,'completedMission') as LocalMission).retrySave();});
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'completedMission').saving),{timeout:180000}).toBe('verified');
  expect(await page.evaluate(()=>{const client=Reflect.get(window,'completedMission');return {saving:client.saving,error:client.saveError};})).toEqual({saving:'verified',error:''});
  const stored=await(await request.get(`${backend}/__test/state?playerId=${playerId}`)).json();expect(stored.sessions).toBe(1);expect(stored.results).toHaveLength(1);expect(stored.results[0]).toMatchObject({outcome:'success',remainingHealth:68,firstCompletion:true});expect(stored.checkpoints).toBe(0);expect(stored.events).toBe(0);
});
