import { test, expect, type Page } from '@playwright/test';
import { move } from '../rivals/traversal';

async function prepare(page: Page, response: 'unauthorized' | 'stalled' | 'html' | 'authenticated' | 'admin', pixelRatio=.5) {
  // Optional infrastructure-only cookie for the owning account's protected
  // staged deployment. Never creates an application login or account token.
  if (process.env.PRODUCTION_TEST_BYPASS_COOKIE) {
    const cookie = JSON.parse(process.env.PRODUCTION_TEST_BYPASS_COOKIE);
    if (new URL(cookie.url).origin !== new URL(test.info().project.use.baseURL!).origin) throw new Error('Staging cookie target mismatch');
    await page.context().addCookies([cookie]);
  }
  const errors: string[] = []; page.on('pageerror', error => { errors.push(error.message); console.log('Production startup error: ' + error.message); });
  await page.addInitScript(value => Object.defineProperty(window, 'devicePixelRatio', { value }),pixelRatio);
  // Isolate the app from live auth/payment services; no external writes are allowed in these tests.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      if (response === 'admin' && url.pathname === '/api/admin/me') { await route.fulfill({ json: { admin: { email: 'audit@example.invalid' } } }); return; }
      if (response === 'stalled') { await new Promise(resolve => setTimeout(resolve, 5500)); await route.abort().catch(() => {}); return; }
      if (response === 'html') { await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>fallback</html>' }); return; }
      if (response === 'authenticated' && url.pathname === '/api/auth/me') {
        await route.fulfill({ json: { user: { wallet: '0x1111111111111111111111111111111111111111', chainType: 'evm', bdBalance: 0, level: 'Beginner', lastClaimTime: null, autoClaimActive: false, autoClaimExpiry: null, referralCode: '', referralCount: 0, completedTasks: [], lastDailyTaskDate: '' } } }); return;
      }
      if (response === 'authenticated' && url.pathname === '/api/mining/status') { await route.fulfill({ json: { canClaim: true, cooldownRemainingMs: 0, bdBalance: 0 } }); return; }
      if (response === 'authenticated' && url.pathname === '/api/leaderboard/top') { await route.fulfill({ json: { leaderboard: [] } }); return; }
      await route.fulfill({ status: 401, json: { error: 'unauthorized' } }); return;
    }
    if (url.origin === new URL(test.info().project.use.baseURL!).origin) { await route.continue(); return; }
    await route.abort();
  });
  return errors;
}
for (const response of ['unauthorized', 'stalled', 'html'] as const) {
  test('production login recovers from ' + response + ' backend', async ({ page }) => {
    const errors = await prepare(page, response);
    await page.goto('/');
    expect(errors).toEqual([]);
    await expect(page.getByRole('heading', { name: 'Sign in to RIVALS' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Restoring your secure session...')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}
test('production game route opens 3D and preserves the classic fallback', async ({ page }) => {
  const errors = await prepare(page, 'authenticated');
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'PLAY', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'LOW graphics' })).toHaveCount(0);
  await expect(page.getByText('Development sandbox disabled.')).toHaveCount(0);
  await page.goto('/?engine=2d');
  // This link reloads the page; remote vendor transfer precedes the client redirect.
  await expect(page).toHaveURL(/\/\?engine=2d$/, { timeout: 60000 });
  await expect(page.getByRole('button', { name: 'PLAY', exact: true })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Exit to website' }).click();
  await expect(page).toHaveURL(new URL('/', test.info().project.use.baseURL!).href);
  expect(errors).toEqual([]);
});

test('production 3D and classic game links remain behind login', async ({ page }) => {
  const errors = await prepare(page, 'unauthorized');
  for (const path of ['/', '/gaming?engine=2d', '/play', '/missions', '/settings', '/rank', '/profile']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Sign in to RIVALS' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'ENTER 3D RAID' })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('built production 3D game draws, pauses and exits without changing accounts' + (process.env.PRODUCTION_TEST_WARM_ASSETS === '1' ? ' (warm-cache)' : ''), async ({ page }) => {
  const warmAssets = process.env.PRODUCTION_TEST_WARM_ASSETS === '1';
  const remote = Boolean(process.env.PRODUCTION_TEST_URL);
  // Keep the remote suite's network budget; don't overwrite it with the local
  // renderer budget when intercepted requests must download every model again.
  test.setTimeout(warmAssets ? 480000 : remote ? 300000 : 180000);
  await page.setViewportSize({ width: 600, height: 320 });
  const errors = await prepare(page, 'authenticated');
  const writes: string[] = [];
  const loadedModels = new Set<string>();
  page.on('requestfinished', async request => {
    if (!/\.glb(?:\.gz)?(?:\?|$)/.test(request.url())) return;
    const response = await request.response();
    if (response?.status() === 200) loadedModels.add(new URL(request.url()).pathname.replace(/\.gz$/, ''));
  });
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.url());
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'LOW graphics' }).click({ timeout: 30000 });
  await page.getByRole('navigation', {name:'Game navigation'}).getByRole('link', {name:'LOBBY',exact:true}).click();
  await page.getByRole('link',{name:'PLAY',exact:true}).click();
  await expect(page.getByRole('button',{name:'DEPLOY / START HEIST'})).toBeEnabled();
  // Optional diagnostic isolates actual renderer behavior from cold transfer.
  // It is never reported as a cold-start pass or a phone performance result.
  if (warmAssets) await expect.poll(() => loadedModels.size, { timeout: 240000 }).toBe(14);
  await page.getByRole('button', { name: 'DEPLOY / START HEIST' }).dispatchEvent('click');
  try {
    await page.locator('.r3-game').waitFor({ state: 'attached', timeout: remote ? 240000 : 120000 });
  } catch (error) {
    console.log('Finished city model transfers: ' + loadedModels.size + '/14');
    throw error;
  }
  await expect(page.locator('.r3-game')).not.toHaveAttribute('data-status', 'loading', { timeout: 120000 });
  if (await page.locator('.r3-game').getAttribute('data-status') === 'error') {
    throw new Error('3D startup failed: ' + await page.locator('.rivals-pause-panel').innerText());
  }
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status', 'playing', { timeout: 120000 });
  await expect(page.locator('[data-testid="three-host"] canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Graphics settings' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause game' }).dispatchEvent('click');
  await expect(page.getByRole('button', { name: 'RESUME RAID' })).toBeVisible();
  await page.getByRole('button',{name:'SETTINGS',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Raid settings'})).toBeVisible();
  await expect(page.getByRole('button',{name:'LOW graphics'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'BACK TO RAID'}).click();
  await page.getByRole('button', { name: 'RETURN TO GAME MENU' }).dispatchEvent('click');
  await expect(page.getByRole('link', { name: 'PLAY',exact:true })).toBeVisible();
  await expect(page.locator('[data-testid="three-host"] canvas')).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
test('production deep admin link remains gated without a session', async ({ page }) => {
  const errors = await prepare(page, 'unauthorized');
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByText('Restoring your secure session...')).toHaveCount(0);
  expect(errors).toEqual([]);
});





test('main link and retired mining pages open only the game without mining polling', async ({ page }) => {
  const errors = await prepare(page, 'authenticated');
  const miningRequests: string[] = [];
  page.on('request', request => {
    if (/\/api\/(mining|leaderboard|tasks|payments)(\/|$)/.test(new URL(request.url()).pathname)) miningRequests.push(request.url());
  });
  for (const path of ['/', '/tasks', '/auto-claim', '/marketplace', '/gaming']) {
    await page.goto(path);
    await expect(page).toHaveURL(new URL('/', test.info().project.use.baseURL!).href, { timeout: 60000 });
    await expect(page.getByRole('link', { name: 'PLAY',exact:true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Restoring your secure session...')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Robina could not start' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sign in to RIVALS' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^(BaseDrop|Leaderboard|Auto Claim|Marketplace|Profile|Missions)$/ })).toHaveCount(0);
    await expect(page.getByRole('navigation',{name:'Main menu'})).toBeVisible();
    expect(await page.locator('#root').innerText()).not.toBe('');
    expect(errors).toEqual([]);
  }
  expect(miningRequests).toEqual([]);
});

test('frontend hub has complete mobile pages, saved settings and no new backend calls',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const errors=await prepare(page,'authenticated'),calls:{origin:string;path:string;method:string}[]=[];
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/'))calls.push({origin:url.origin,path:url.pathname,method:request.method()});});
  await page.goto('/');
  await expect(page.getByRole('link',{name:'PLAY',exact:true})).toBeVisible({timeout:30000});
  await page.screenshot({path:'docs/rivals-3d/frontend-hub/lobby-phone.png',fullPage:true});
  await page.getByRole('navigation',{name:'Main menu'}).getByRole('link',{name:/^MISSIONS/}).click();
  await expect(page.getByRole('heading',{name:'OPERATIONS.'})).toBeVisible();
  await expect(page.getByRole('link',{name:'VIEW BRIEFING'})).toHaveCount(1);await expect(page.getByRole('link',{name:'REVIEW UNLOCK REQUIREMENT'})).toHaveCount(6);
  await page.screenshot({path:'docs/rivals-3d/frontend-hub/missions-phone.png',fullPage:true});
  await page.getByRole('navigation',{name:'Game navigation'}).getByRole('link',{name:'CUSTOMIZATION',exact:true}).click();
  await page.getByLabel('Callsign').fill('NIGHT RUNNER');
  await page.getByRole('button',{name:'ice calling card'}).click();
  await page.getByRole('button',{name:'SAVE IDENTITY'}).click();
  await expect(page.getByText('Dossier updated.')).toBeVisible();
  await page.getByRole('navigation',{name:'Game navigation'}).getByRole('link',{name:'PLAYER PROFILE',exact:true}).click();
  await expect(page.getByRole('heading',{name:'NIGHT RUNNER',exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Game navigation'}).getByRole('link',{name:'LEADERBOARDS',exact:true}).click();
  await expect(page.getByText('FRONTEND PREVIEW', {exact:true})).toBeVisible();
  await page.screenshot({path:'docs/rivals-3d/frontend-hub/leaderboard-phone.png',fullPage:true});
  await page.getByRole('button',{name:'MY RECORDED RUNS'}).click();
  await expect(page.getByText('NO FINISHED HEISTS. YET.')).toBeVisible();
  await page.getByRole('navigation',{name:'Game navigation'}).getByRole('link',{name:'RANK',exact:true}).click();
  await expect(page.getByRole('heading',{name:'EARN YOUR NAME.'})).toBeVisible();
  await page.getByRole('navigation',{name:'Game navigation'}).getByRole('link',{name:'SETTINGS',exact:true}).click();
  await page.getByRole('button',{name:'LOW graphics'}).click();
  await page.screenshot({path:'docs/rivals-3d/frontend-hub/settings-phone.png',fullPage:true});
  await page.reload();
  await expect(page.getByRole('button',{name:'LOW graphics'})).toHaveAttribute('aria-pressed','true');
  await page.setViewportSize({width:320,height:740});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('navigation',{name:'Game navigation'}).getByRole('link',{name:'LOBBY',exact:true}).click();
  await expect(page.getByRole('button',{name:'LOW graphics'})).toHaveCount(0);
  await page.setViewportSize({width:1440,height:960});
  await page.screenshot({path:'docs/rivals-3d/frontend-hub/lobby-desktop.png',fullPage:true});
  // Privy's existing sign-in SDK also reads its own public app configuration.
  // Assert against the actual application backend, not unrelated SDK hosts.
  const backendOrigin=calls.find(call=>call.path==='/api/auth/me')?.origin;
  expect(backendOrigin).toBeTruthy();
  expect(calls.filter(call=>call.origin===backendOrigin && (call.method!=='GET'||call.path!=='/api/auth/me'))).toEqual([]);
  expect(errors).toEqual([]);
});



test('admin pages contain service failures without crashing', async ({ page }) => {
  const errors = await prepare(page, 'admin');
  for (const path of ['/admin/users', '/admin/seasons', '/admin/tasks', '/admin/payments', '/admin/ranking', '/admin/analytics', '/admin/activity']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Admin Logout' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Restoring your secure session...')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Robina could not start' })).toHaveCount(0);
    expect(errors).toEqual([]);
  }
});

test('campaign GPS, real driving and landscape action groups remain usable',async({browser},info)=>{
  test.setTimeout(420000);
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage();
  try{
  const errors=await prepare(page,'authenticated');
  await page.goto(new URL('/settings',info.project.use.baseURL).href);await page.getByRole('button',{name:'LOW graphics'}).click();
  await page.getByRole('tab',{name:'Controls'}).click();await page.getByLabel('Default camera').selectOption('tactical');
  await page.getByRole('navigation',{name:'Game navigation'}).getByRole('link',{name:'LOBBY',exact:true}).click();await page.getByRole('link',{name:'PLAY',exact:true}).click();
  await expect(page.getByRole('heading',{name:'MISSION OBJECTIVES'})).toBeVisible();await page.getByRole('button',{name:'DEPLOY / START HEIST'}).click();
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:120000});
  await expect(page.getByRole('img',{name:'Live player and objective navigation'}).last()).toBeVisible();
  await expect(page.locator('.r3-mission-radar [aria-label="Accessible GPS route"]')).toHaveCount(1);
  await expect(page.getByRole('img',{name:'Red direction arrow'})).toBeVisible();
  await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-navigation'))!).roadArrows).toBe(1);
  for(const [width,height]of [[568,320],[667,375],[740,360],[812,375],[844,390],[896,414],[390,844]]){
    await page.setViewportSize({width,height});
    const invalid=await page.evaluate(()=>{const root=document.querySelector('.r3-game')!.getBoundingClientRect(),vitals=document.querySelector('.rv-vitals')!.getBoundingClientRect(),radar=document.querySelector('.r3-mission-radar .rivals-minimap')!.getBoundingClientRect();return [...document.querySelectorAll('.rv-action-buttons>button,.rv-sprint-control')].filter(n=>getComputedStyle(n).display!=='none').map(n=>({name:n.getAttribute('aria-label'),r:n.getBoundingClientRect()})).filter(({r})=>r.width<43||r.height<43||r.top<root.top||r.bottom>root.bottom+1||r.left<root.left||r.right>root.right+1||(r.left<radar.right&&r.right>radar.left&&r.top<radar.bottom&&r.bottom>radar.top)||(r.left<vitals.right&&r.right>vitals.left&&r.top<vitals.bottom&&r.bottom>vitals.top)).map(({name})=>name);});
    expect(invalid,`${width}x${height} controls`).toEqual([]);
    const badgeInside=await page.locator('.r3-bomb').evaluate(button=>{const b=button.getBoundingClientRect(),count=button.querySelector('b')!.getBoundingClientRect();return count.left>=b.left&&count.right<=b.right&&count.top>=b.top&&count.bottom<=b.bottom;});expect(badgeInside,`${width}x${height} grenade count anchor`).toBe(true);
  }
  await page.setViewportSize({width:844,height:390});
  await move(page,'x',720);await move(page,'y',200,8);
  await expect(page.getByRole('button',{name:/ENTER SEDAN/})).toBeVisible();
  await expect.poll(async()=>{const arrow=await page.getByRole('img',{name:'Red direction arrow'}).boundingBox(),entry=await page.getByRole('button',{name:/ENTER SEDAN/}).boundingBox();return Boolean(arrow&&entry&&arrow.y>=entry.y+entry.height+2);}).toBe(true);
  await page.getByRole('button',{name:/ENTER SEDAN/}).click();
  await expect(page.getByRole('group',{name:'Driving joystick'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Steer left'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Steer right'})).toHaveCount(0);
  for(const [width,height]of [[568,320],[844,390],[320,740],[390,844]]){
    await page.setViewportSize({width,height});
    const invalid=await page.locator('.r3-driving-controls').evaluate(root=>{const frame=root.getBoundingClientRect(),stick=root.querySelector('.rivals-stick')!.getBoundingClientRect();return [...root.querySelectorAll('button')].map(button=>({name:button.getAttribute('aria-label')??button.textContent,r:button.getBoundingClientRect()})).filter(({r})=>r.width<48||r.height<44||r.left<frame.left||r.right>frame.right+1||r.top<frame.top||r.bottom>frame.bottom+1||(r.left<stick.right&&r.right>stick.left&&r.top<stick.bottom&&r.bottom>stick.top)).map(({name})=>name);});
    expect(invalid,`${width}x${height} driving pedals`).toEqual([]);
  }
  await page.setViewportSize({width:844,height:390});
  const drivingStick=await page.getByTestId('driving-stick').boundingBox();expect(drivingStick).toBeTruthy();
  const driveCdp=await context.newCDPSession(page),driveFinger={id:1,x:drivingStick!.x+drivingStick!.width/2+28,y:drivingStick!.y+drivingStick!.height/2};
  const startCarX=Number(await page.getByTestId('three-state').getAttribute('data-x'));
  await driveCdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[driveFinger]});
  await expect.poll(async()=>Number(await page.getByTestId('three-state').getAttribute('data-x'))).toBeGreaterThan(startCarX+.6);
  await driveCdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-vehicle'))!).speed,{timeout:15000}).toBe(0);
  const forwardCarX=Number(await page.getByTestId('three-state').getAttribute('data-x'));
  await driveCdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...driveFinger,x:drivingStick!.x+drivingStick!.width/2,y:drivingStick!.y+drivingStick!.height/2+28}]});
  await expect.poll(async()=>Number(await page.getByTestId('three-state').getAttribute('data-x')),{timeout:15000}).toBeLessThan(forwardCarX-.4);
  await driveCdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-vehicle'))!).speed,{timeout:15000}).toBe(0);
  const gas=page.getByRole('button',{name:'Accelerate vehicle'});await gas.hover();await page.mouse.down();
  await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-vehicle'))!).speed).toBeGreaterThan(5);await page.mouse.up();
  const brake=page.getByRole('button',{name:'Brake vehicle'});await brake.hover();await page.mouse.down();await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-vehicle'))!).speed).toBe(0);await page.mouse.up();
  const reverse=page.getByRole('button',{name:'Reverse vehicle'});await reverse.hover();await page.mouse.down();await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-vehicle'))!).speed).toBeGreaterThan(2);await page.mouse.up();await brake.hover();await page.mouse.down();await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-vehicle'))!).speed).toBe(0);await page.mouse.up();
  await page.getByRole('button',{name:'EXIT VEHICLE · F'}).click();await expect(page.getByRole('button',{name:'Jump',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cycle camera view'}).click();await page.getByRole('button',{name:'Cycle camera view'}).click();
  await expect(page.getByTestId('three-state')).toHaveAttribute('data-pov','third');
  const beforeAim=JSON.parse((await page.getByTestId('three-state').getAttribute('data-combat'))!),beforeBody=await page.getByTestId('three-state').evaluate(n=>({x:Number(n.dataset.x),z:Number(n.dataset.z),yaw:JSON.parse(n.dataset.character!).yaw})),aimStick=await page.getByTestId('aim-stick').boundingBox();
  const cdp=await context.newCDPSession(page),finger={id:1,x:aimStick!.x+aimStick!.width/2+24,y:aimStick!.y+aimStick!.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});
  await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-combat'))!).lastShot?.serial??0).toBeGreaterThan(beforeAim.lastShot?.serial??0);
  const rightShot=JSON.parse((await page.getByTestId('three-state').getAttribute('data-combat'))!).lastShot;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...finger,x:aimStick!.x+aimStick!.width/2-24}]});
  await expect.poll(async()=>{const shot=JSON.parse((await page.getByTestId('three-state').getAttribute('data-combat'))!).lastShot;return shot.serial>rightShot.serial&&Math.hypot(...shot.direction.map((v:number,i:number)=>v-rightShot.direction[i]))>.3;}).toBe(true);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const afterAim=JSON.parse((await page.getByTestId('three-state').getAttribute('data-combat'))!),afterBody=await page.getByTestId('three-state').evaluate(n=>({x:Number(n.dataset.x),z:Number(n.dataset.z),yaw:JSON.parse(n.dataset.character!).yaw}));
  expect(afterAim.view.yaw).toBeCloseTo(beforeAim.view.yaw,3);expect(afterBody.x).toBeCloseTo(beforeBody.x,3);expect(afterBody.z).toBeCloseTo(beforeBody.z,3);expect(afterBody.yaw).toBeCloseTo(beforeBody.yaw,2);expect(afterAim.lastShot.direction.every(Number.isFinite)).toBe(true);
  const stoppedYaw=JSON.parse((await page.getByTestId('three-state').getAttribute('data-combat'))!).view.yaw;await page.waitForTimeout(200);
  expect(JSON.parse((await page.getByTestId('three-state').getAttribute('data-combat'))!).view.yaw).toBeCloseTo(stoppedYaw,3);
  const explosions=JSON.parse((await page.getByTestId('three-state').getAttribute('data-combat'))!).field.exploded;
  await page.getByRole('button',{name:'Throw bomb'}).click();
  await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-combat'))!).field.exploded,{timeout:30000}).toBeGreaterThan(explosions);
  await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-combat'))!).fires.aftermath).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('campaign-landscape.png')});expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('High graphics renders authored detail and red road guidance without shader errors',async({browser},info)=>{
  test.setTimeout(240000);
  const context=await browser.newContext({viewport:{width:1000,height:600},hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage();
  try{
  const errors=await prepare(page,'authenticated',1),graphicsErrors:string[]=[];
  page.on('console',message=>{if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GL_INVALID/.test(message.text()))graphicsErrors.push(message.text());});
  await page.goto(new URL('/settings',info.project.use.baseURL).href);await page.getByRole('button',{name:'HIGH graphics'}).click();
  await page.getByRole('tab',{name:'Controls'}).click();await page.getByLabel('Default camera').selectOption('third');
  await page.getByRole('navigation',{name:'Game navigation'}).getByRole('link',{name:'LOBBY',exact:true}).click();await page.getByRole('link',{name:'PLAY',exact:true}).click();await page.getByRole('button',{name:'DEPLOY / START HEIST'}).click();
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:120000});await expect(page.getByTestId('three-state')).toHaveAttribute('data-quality','high');
  await expect(page.getByRole('img',{name:'Red direction arrow'})).toBeVisible();
  await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-navigation'))!).roadArrows).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('high-street-detail.png')});
  await page.getByRole('button',{name:'Cycle camera view'}).click();await expect(page.getByTestId('three-state')).toHaveAttribute('data-pov','first');
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:info.outputPath('high-phone-first-person.png')});
  await page.getByRole('button',{name:'Cycle camera view'}).click();await expect(page.getByTestId('three-state')).toHaveAttribute('data-pov','tactical');
  await page.screenshot({path:info.outputPath('red-road-route.png')});
  expect(graphicsErrors).toEqual([]);expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('bank entrance raises police response and Collect actually takes the briefcase',async({browser},info)=>{
  test.setTimeout(600000);const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage();
  try{
    const errors=await prepare(page,'authenticated');await page.goto(new URL('/settings',info.project.use.baseURL).href);await page.getByRole('button',{name:'LOW graphics'}).click();await page.getByRole('tab',{name:'Controls'}).click();await page.getByLabel('Default camera').selectOption('tactical');
    await page.getByRole('navigation',{name:'Game navigation'}).getByRole('link',{name:'LOBBY',exact:true}).click();await page.getByRole('link',{name:'PLAY',exact:true}).click();await page.getByRole('button',{name:'DEPLOY / START HEIST'}).click();await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{timeout:120000});
    // These much longer legs need a wall-time budget for SwiftShader, not a
    // physics speed change. Walk around the parked van outside the entrance.
    const walk=(axis:'x'|'y',goal:number)=>move(page,axis,goal,8,90000);
    await walk('x',1280);await walk('y',1280);await walk('x',1920);await walk('y',1000);await walk('x',1800);
    await expect(page.getByLabel('Active objective')).toContainText('Recover Classified briefcase');
    await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-pursuit'))!).units).toBeGreaterThan(0);
    await walk('y',750);
    await expect(page.getByLabel('Nearby equipment',{exact:true})).toContainText('Classified briefcase');await expect(page.getByRole('button',{name:'Inspect nearby equipment'})).toBeEnabled();await page.getByRole('button',{name:'Inspect nearby equipment'}).click();
    await expect(page.getByLabel('Active objective')).toContainText('Break police contact');await expect.poll(async()=>JSON.parse((await page.getByTestId('three-state').getAttribute('data-pursuit'))!).hunting).toBe(true);await page.getByRole('button',{name:'Pause game'}).click();await page.screenshot({path:info.outputPath('bank-case-collected.png')});expect(errors).toEqual([]);
  }catch(error){console.log('Bank traversal diagnostics:',await page.getByTestId('three-state').evaluate(n=>({x:n.dataset.x,z:n.dataset.z,fps:n.dataset.fps,character:n.dataset.character,pursuit:n.dataset.pursuit,campaign:n.dataset.campaign})).catch(()=>null));throw error;}finally{await context.close();}
});
