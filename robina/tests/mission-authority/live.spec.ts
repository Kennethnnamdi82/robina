import {expect,test} from '@playwright/test';
const backend='http://127.0.0.1:4106';
async function deploy(page:import('@playwright/test').Page,request:import('@playwright/test').APIRequestContext){
  page.on('pageerror',error=>console.error('browser error:',error.message));
  page.on('websocket',socket=>socket.on('framereceived',event=>{if(String(event.payload).includes('mission:error'))console.error('mission transport:',event.payload);}));
  const session=await (await request.get(backend+'/__test/session')).json();
  await page.context().addCookies([{name:'bd_session',value:session.token,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax',secure:false}]);
  await page.goto('/tests/mission-authority/index.html');await page.getByRole('button',{name:'ENTER 3D RAID'}).click();
  await page.bringToFront();
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status',/playing|paused/,{timeout:180000});
  // Software shader compilation can briefly stall Chrome's socket heartbeat.
  // Recovery deliberately opens the existing pause menu; resume as a user does.
  if(await page.getByRole('button',{name:'RESUME RAID'}).isVisible())await page.getByRole('button',{name:'RESUME RAID'}).click();
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing');
  await expect.poll(async()=>{
    const stored=await (await request.get(`${backend}/__test/state?playerId=${session.playerId}`)).json();
    const resume=page.getByRole('button',{name:'RESUME RAID'});
    if(await resume.isVisible())await resume.click();
    return Boolean(stored.live?.ready&&!stored.live?.paused);
  },{timeout:60000,intervals:[1000]}).toBeTruthy();
  return session.playerId as string;
}
test('server guard damage reaches the actual Three.js HUD, death screen and persistent cooldown',async({page,request})=>{
  const playerId=await deploy(page,request);
  expect((await request.post(`${backend}/__test/combat?playerId=${playerId}`)).ok()).toBeTruthy();
  await expect.poll(async()=>{
    const resume=page.getByRole('button',{name:'RESUME RAID'});
    if(await resume.isVisible())await resume.click();
    return page.getByRole('heading',{name:'Mission failed'}).isVisible();
  },{timeout:180000,intervals:[1000]}).toBeTruthy();
  await expect(page.getByRole('status').filter({hasText:'OPERATIVE RECOVERING'})).toBeVisible();
  const stored=await (await request.get(`${backend}/__test/state?playerId=${playerId}`)).json();
  expect(stored.life.deaths).toBe(1);expect(stored.results).toHaveLength(1);expect(stored.results[0].outcome).toBe('failure');
  expect(new Date(stored.life.recoveryUntil).getTime()).toBeGreaterThan(Date.now()+7100000);
});
test('a validated handoff persists a verified result before the actual completion screen',async({page,request})=>{
  const playerId=await deploy(page,request);
  expect((await request.post(`${backend}/__test/extraction-checkpoint?playerId=${playerId}`,{maxRetries:2})).ok()).toBeTruthy();
  await expect(page.getByRole('button',{name:/HAND OVER THE BAG/})).toBeVisible({timeout:60000});
  await page.getByRole('button',{name:/HAND OVER THE BAG/}).click({timeout:60000});
  await expect(page.getByRole('heading',{name:'Mission completed'})).toBeVisible({timeout:60000});
  await expect(page.getByText('MISSION VERIFIED',{exact:true})).toBeVisible();
  const stored=await (await request.get(`${backend}/__test/state?playerId=${playerId}`)).json();
  expect(stored.results).toHaveLength(1);expect(stored.results[0]).toMatchObject({outcome:'success',firstCompletion:true,rewardEligible:true});
});

test('the rendered soldier and entered vehicle move through real acknowledged server updates',async({page,request},info)=>{
  const playerId=await deploy(page,request),state=page.getByTestId('three-state');
  await expect(page.locator('.r3-campaign-status p')).toHaveCount(0);
  await expect(page.locator('.r3-campaign-status')).toBeHidden();
  await expect(page.locator('.rv-objective')).toBeHidden();
  await expect(page.getByRole('img',{name:'Red direction arrow'})).toBeVisible();
  expect((await request.post(`${backend}/__test/motion-setup?playerId=${playerId}`)).ok()).toBeTruthy();
  await expect.poll(async()=>Number(await state.getAttribute('data-z')),{timeout:30000}).toBeLessThan(9);
  // The initial TPS camera faces +Z (yaw=-PI), so W travels down this avenue.
  await page.keyboard.down('KeyW');
  try{await expect.poll(async()=>Number(await state.getAttribute('data-z')),{timeout:45000}).toBeGreaterThan(16);}
  finally{await page.keyboard.up('KeyW');}
  const walking=await state.evaluate(node=>({z:Number(node.getAttribute('data-z')),combat:JSON.parse(node.getAttribute('data-combat')!)}));
  expect(walking.combat.motion.replayedSteps).toBeGreaterThan(0);expect(walking.combat.motion.history).toBeLessThanOrEqual(120);
  const stored=await(await request.get(`${backend}/__test/state?playerId=${playerId}`)).json();expect(stored.live.position[2]).toBeGreaterThan(12);expect(stored.results).toHaveLength(0);
  expect((await request.post(`${backend}/__test/motion-setup?playerId=${playerId}&vehicle=true`)).ok()).toBeTruthy();
  await expect.poll(async()=>Number(await state.getAttribute('data-x')),{timeout:30000}).toBeLessThan(6.5);
  await page.keyboard.press('KeyF');
  await expect.poll(async()=>JSON.parse((await state.getAttribute('data-vehicle'))!).driving,{timeout:30000}).toBe(true);
  await expect(page.locator('.r3-enter-car')).toHaveCount(0);
  const exit=page.getByRole('button',{name:'Exit vehicle'});await expect(exit).toBeVisible();
  await expect(page.locator('.r3-speed,.r3-drive-hint')).toHaveCount(0);
  const bounds=await exit.boundingBox();expect(bounds!.width).toBeLessThanOrEqual(56);expect(bounds!.height).toBeLessThanOrEqual(56);
  expect(bounds!.x).toBeGreaterThan(page.viewportSize()!.width/2);
  const before=Number(await state.getAttribute('data-z'));
  await page.keyboard.down('KeyW');
  try{await expect.poll(async()=>Number(await state.getAttribute('data-z')),{timeout:45000}).toBeGreaterThan(before+5);}
  finally{await page.keyboard.up('KeyW');}
  const driving=await state.evaluate(node=>({z:Number(node.getAttribute('data-z')),combat:JSON.parse(node.getAttribute('data-combat')!),vehicle:JSON.parse(node.getAttribute('data-vehicle')!)}));
  expect(driving.combat.motion.replayedSteps).toBeGreaterThan(walking.combat.motion.replayedSteps);expect(driving.vehicle.health).toBeGreaterThan(0);
  console.log('Real server/render movement audit:',JSON.stringify({walking,driving}));
  await page.screenshot({path:info.outputPath('server-controlled-driving.png')});
});
