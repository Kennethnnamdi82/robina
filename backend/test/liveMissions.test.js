import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { io } from 'socket.io-client';

process.env.DOTENV_CONFIG_PATH = 'test/nonexistent-live-env';
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'live-mission-test-only-secret-32-characters';
const { createApp } = await import('../src/app.js');
const { LiveMissionAuthority, liveInput } = await import('../src/missions/liveAuthority.js');
const { MissionSimulation } = await import('../generated/missionSimulation.mjs');
const { User } = await import('../src/models/User.js');
const { RevokedToken } = await import('../src/models/RevokedToken.js');
const { signSession } = await import('../src/middleware/auth.js');
const models = await import('../src/missions/models.js');
const storeModels=await import('../src/payments/storeModels.js');
const {reserveMissionGrenade}=await import('../src/payments/service.js');
const {consumeVerifiedLifeRecovery}=await import('../src/missions/recoveryEntitlement.js');
let mongo, authority, server, origin, counter = 0; const sockets = [];
before(async () => {
  const binary = fileURLToPath(new URL('../.cache/test-mongodb/mongod.exe', import.meta.url));
  mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.24', ...(process.platform === 'win32' && existsSync(binary) ? { systemBinary: binary } : {}) },
    replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ ip: '127.0.0.1' }] });
  await mongoose.connect(mongo.getUri(), { dbName: 'isolated-live-mission-tests' });
  authority = new LiveMissionAuthority({ autoTick: false, origins: ['http://localhost:8080'] });
  server = createApp(() => true, { missionAuthority: authority }).listen(0, '127.0.0.1'); await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`; authority.attach(server);
}, { timeout: 240000 });
after(async () => { await authority?.close(); if (server?.listening) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => {
  sockets.splice(0).forEach(socket => socket.disconnect());
  await Promise.allSettled([...authority.entries.values()].map(entry => entry.work));
  authority.entries.clear(); authority.tickets.clear();
  authority.utilisation=0;
  await mongoose.connection.dropDatabase();
  await Promise.all([User.createIndexes(), RevokedToken.createIndexes(), ...Object.values(models).map(model => model.createIndexes())]);
  for(const model of Object.values(storeModels)){await model.createCollection();await model.createIndexes();}
});
async function player() { const id = ++counter; return User.create({ wallet: '0x' + id.toString(16).padStart(40, '0'), referralCode: `live-${id}` }); }
async function api(user, path, body) {
  const response = await fetch(origin + '/api/missions' + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { cookie: 'bd_session=' + signSession(user.wallet), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function connect(user, id) {
  const response = await api(user, `/sessions/${id}/connect`, {}); assert.equal(response.status, 200);
  const socket = io(origin, { transports: ['websocket'], autoConnect: false, reconnection: false, auth: { ticket: response.body.ticket } });
  sockets.push(socket); const connected = once(socket, 'connect'); socket.connect(); await connected;
  return { socket, ticket: response.body.ticket, entry: authority.entries.get(id) };
}
async function start(user) {
  const response = await api(user, '/sessions', { missionId: 'assignment-reserve', seed: 42 }); assert.equal(response.status, 201);
  return response.body.session;
}
const action = (socket, input) => new Promise(resolve => socket.emit('mission:action', input, resolve));

test('ordered movement batches survive the real socket and acknowledge only server-owned steps',async()=>{
  const user=await player(),mission=await start(user),{socket,entry}=await connect(user,mission._id);
  const frame={seq:1,tick:24,x:1,y:0,aimX:1,aimY:0,aim:[20,1,20],aiming:false,sprint:false,dodge:false,
    interact:false,fire:false,reload:false,jump:false,jumpHeld:false,highJump:false,touchRepeat:false,
    throttle:0,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0,
    movement:{epoch:0,frames:Array.from({length:24},(_,i)=>[i+1,1,0,1,0,0,0,0,0,0,0])}};
  const received=once(entry.socket,'mission:input');socket.emit('mission:input',frame);await received;
  assert.equal(entry.sim.snapshot().prediction.stream.ack,null);
  entry.sim.solids.length=0;entry.sim.enemies.forEach(e=>e.health.current=0);
  const startX=entry.sim.body.position.x;
  for(let i=0;i<15;i++)entry.sim.step();
  assert.equal(entry.sim.snapshot().prediction.stream.ack,15);
  assert.ok(entry.sim.body.position.x>startX);assert.ok(entry.sim.body.position.x-startX<=5.875/4);
  const elapsed=entry.sim.mission.elapsed,position=entry.sim.body.position.toArray();
  const duplicate=once(entry.socket,'mission:input');socket.emit('mission:input',frame);await duplicate;
  assert.equal(entry.sim.mission.elapsed,elapsed);assert.deepEqual(entry.sim.body.position.toArray(),position);
  entry.sim.neutral();const epoch=entry.sim.snapshot().prediction.stream.epoch;
  const stale=once(entry.socket,'mission:input');socket.emit('mission:input',{...frame,seq:2});await stale;
  entry.sim.step();assert.equal(entry.sim.snapshot().prediction.stream.epoch,epoch);assert.equal(entry.sim.snapshot().prediction.stream.ack,null);
  assert.equal(entry.sim.firearmShots,0);assert.equal(entry.sim.controller.health,100);
  assert.equal(liveInput.safeParse({...frame,movement:{epoch,frames:[...frame.movement.frames,frame.movement.frames[0]]}}).success,false);
  assert.equal(liveInput.safeParse({...frame,movement:{epoch,frames:[[1,20,0,1,0,0,0,0,0,0,0]]}}).success,false);
  assert.equal(liveInput.safeParse({...frame,movement:{...frame.movement,health:100}}).success,false);
});

test('the live scheduler drains a short stall and pauses a long outage without changing health',async()=>{
  const user=await player(),mission=await start(user),{entry}=await connect(user,mission._id);
  entry.ready=true;entry.sim.enemies.forEach(e=>e.health.current=0);entry.lastInputAt=Date.now();
  const elapsed=entry.sim.mission.elapsed;authority.lastTick=performance.now()-250;authority.tick();
  // Catch-up must yield, then consume the remaining debt on the event loop.
  assert.ok(entry.sim.mission.elapsed-elapsed<=.100001);
  for(let i=0;i<20&&entry.sim.mission.elapsed-elapsed<.249;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.ok(entry.sim.mission.elapsed-elapsed>=.249);assert.equal(entry.paused,false);
  clearImmediate(authority.catchup);authority.catchup=undefined;
  const before=entry.sim.mission.elapsed;authority.lastTick=performance.now()-1500;authority.tick();
  assert.equal(entry.paused,true);assert.equal(entry.sim.snapshot().movementInterrupted,true);
  assert.equal(entry.sim.mission.elapsed,before);assert.equal(entry.sim.controller.health,100);
  assert.equal(await models.VerifiedMissionResult.countDocuments({sessionId:mission._id}),0);
});

test('confirmed impacts are delivered through the authenticated mission socket, not inferred from client projectiles',async()=>{
  const user=await player(),mission=await start(user),{socket,entry}=await connect(user,mission._id),p=entry.sim.crowd.people[0];
  const origin=entry.sim.body.position.clone().set(p.x,.9,p.z+.7),direction=origin.clone().set(0,0,-1);
  entry.sim.pool.fire(origin,direction,240,1,20,20,'operative','operative');entry.sim.step();
  const effect=once(socket,'mission:effect');authority.flush(entry);await entry.work;const [message]=await effect;
  assert.equal(message.type,'impact');assert.equal(message.body,true);assert.equal(message.damage,20);assert.equal(p.health,40);
  assert.equal(message.point.length,3);assert.equal(message.direction.length,3);
});

test('trusted inventory appearance reaches gameplay and refunded items are removed on refresh',async()=>{
  const user=await player();
  await storeModels.StoreInventory.create({playerId:user._id,environment:'production',ownedIds:['commander','protocol','pose'],equippedOutfit:'commander',equippedFinish:'protocol',equippedEmote:'pose'});
  const mission=await start(user),{entry}=await connect(user,mission._id);
  assert.equal(entry.sim.snapshot().appearance.outfit,'commander');assert.equal(entry.sim.snapshot().appearance.finish,'protocol');
  await storeModels.StoreInventory.updateOne({playerId:user._id},{$set:{ownedIds:[]}});
  entry.lastPersist=0;authority.tick();await entry.work;
  assert.equal(entry.sim.snapshot().appearance.outfit,null);assert.equal(entry.sim.snapshot().appearance.finish,null);
});

test('live server AI damage persists one death and result, then permits an immediate full-health retry', async () => {
  const user = await player(), mission = await start(user); assert.equal(mission.authority, true);
  const { socket, entry } = await connect(user, mission._id);
  // Trusted fixture positions one real guard on the insertion street. Damage
  // is generated by the existing AI/weapon/projectile pipeline, never an API.
  const enemy = entry.sim.enemies[0]; enemy.x = 8 * 40; enemy.y = 26 * 40; enemy.angle = Math.PI / 2;
  await models.MissionSession.collection.updateOne({ _id: new mongoose.Types.ObjectId(mission._id) }, { $set: { createdAt: new Date(Date.now() - 120000) } });
  let steps = 0; while (entry.sim.controller.health > 0 && steps++ < 3600) entry.sim.step();
  assert.equal(entry.sim.controller.health, 0, 'guard projectiles must kill the idle player');
  assert.equal(entry.sim.mission.state, 'FAILED');
  const finished = once(socket, 'mission:result'); authority.flush(entry); await entry.work;
  const [message] = await finished;
  assert.equal(message.result.outcome, 'failure'); assert.equal(message.state.health, 0);
  assert.equal(message.result.rewardEligible, false);
  const life = await models.MissionLife.findOne({ playerId: user._id });
  assert.equal(life.deaths, 1); assert.equal(life.recoveryUntil, null);
  assert.equal(message.recoveryUntil, null);
  const eligibility = await api(user, '/eligibility');
  assert.equal(eligibility.body.eligible, true); assert.equal(eligibility.body.recoveryUntil, null);
  const retry = await api(user, '/sessions', { missionId: 'assignment-reactor' });
  assert.equal(retry.status, 201); assert.equal(retry.body.session.health, 100);
  assert.equal((await api(user, `/sessions/${mission._id}/abandon`, {})).status, 409);
  assert.equal((await api(user, `/sessions/${mission._id}/report`, { outcome: 'success' })).status, 409);
  assert.equal(await models.VerifiedMissionResult.countDocuments({ sessionId: mission._id }), 1);
});

test('client wins are rejected; validated server extraction settles once and replays earn nothing', async () => {
  const user = await player();
  for (const first of [true, false]) {
    const mission = await start(user), { socket, entry } = await connect(user, mission._id);
    entry.ready = true;
    assert.equal((await api(user, `/sessions/${mission._id}/report`, { outcome: 'success' })).status, 409);
    assert.deepEqual(await action(socket, { type: 'handoff' }), { ok: false });
    assert.equal(await models.VerifiedMissionResult.countDocuments({ sessionId: mission._id }), 0);
    // A trusted extraction checkpoint fixture represents completed prior play.
    // The public action must still pass the actual carrying, objective, police
    // and position checks in CampaignGameplay before the server records a win.
    const sim = entry.sim;
    for (const objective of sim.mission.definition.objectives) if (objective.id !== 'extract') sim.mission.event(objective.event);
    sim.campaign.carrying = true; sim.campaign.handoff = 'waiting'; sim.police.end();
    sim.body.position.set(sim.campaign.assignment.extraction.x, 0, sim.campaign.assignment.extraction.z);
    sim.mission.elapsed = 180;
    await models.MissionSession.collection.updateOne({ _id: new mongoose.Types.ObjectId(mission._id) }, { $set: { createdAt: new Date(Date.now() - 200000) } });
    const finished = once(socket, 'mission:result'); assert.deepEqual(await action(socket, { type: 'handoff' }), { ok: true });
    await entry.work; const [message] = await finished;
    assert.equal(message.result.outcome, 'success'); assert.equal(message.result.firstCompletion, first); assert.equal(message.result.rewardEligible, first);
    assert.equal((await api(user, `/sessions/${mission._id}/report`, { outcome: 'success' })).status, 409);
    assert.equal(await models.VerifiedMissionResult.countDocuments({ sessionId: mission._id }), 1);
    socket.disconnect();
  }
  assert.equal((await api(user, '/leaderboard')).body.items.length, 2);
});

test('reconnect restores trusted checkpoint health, ammo, enemies and pickups but preserves grenade spending', async () => {
  const user = await player(), mission = await start(user), { socket, entry } = await connect(user, mission._id);
  const sim = entry.sim;
  sim.controller.vitality.current = 70; sim.loadout.slots[0].controller.ammo = 6; sim.enemies[0].health.current = 0;
  await reserveMissionGrenade(user._id,mission._id,authority.owner);
  sim.field.quantity = 4; sim.grenadesSpent = 1;
  await models.MissionSession.updateOne({ _id: mission._id }, { $set: { health: 70 } });
  await authority.checkpoint(entry, 'locate');
  sim.controller.vitality.current = 30; sim.loadout.slots[0].controller.ammo = 2; sim.enemies[1].health.current = 0;
  sim.field.pickups[0].consumed = true;
  await reserveMissionGrenade(user._id,mission._id,authority.owner);
  await models.MissionSession.updateOne({ _id: mission._id }, { $set: { health: 30 } });
  const disconnected = once(socket, 'disconnect'); socket.disconnect(); await disconnected;
  await new Promise(resolve => setTimeout(resolve, 30)); await entry.work;
  const resumed = await connect(user, mission._id);
  assert.equal(resumed.entry.sim.controller.health, 70); assert.equal(resumed.entry.sim.loadout.slots[0].controller.ammo, 6);
  assert.equal(resumed.entry.sim.enemies[0].alive, false); assert.equal(resumed.entry.sim.enemies[1].alive, true);
  assert.equal(resumed.entry.sim.field.pickups[0].consumed, false); assert.equal(resumed.entry.sim.field.quantity, 3);
});

test('socket tickets enforce ownership and single use; input cannot carry health, damage, position or success', async () => {
  const user = await player(), other = await player(), mission = await start(user);
  assert.equal((await api(other, `/sessions/${mission._id}/connect`, {})).status, 409);
  const { ticket, socket } = await connect(user, mission._id);
  const deadline=(await models.MissionSession.findById(mission._id)).reconnectDeadline;
  assert.equal((await api(user,`/sessions/${mission._id}/heartbeat`,{})).status,409,'HTTP keepalives cannot extend a live reconnect window');
  assert.equal((await models.MissionSession.findById(mission._id)).reconnectDeadline.getTime(),deadline.getTime());
  const replay = io(origin, { transports: ['websocket'], autoConnect: false, reconnection: false, auth: { ticket } }); sockets.push(replay);
  const rejected = once(replay, 'connect_error'); replay.connect(); assert.match((await rejected)[0].message, /invalid_connection_ticket/);
  assert.equal(liveInput.safeParse({ health: 100, damage: 0, outcome: 'success' }).success, false);
  const rejectedInput = once(socket, 'mission:rejected'); socket.emit('mission:input', { position: [44, 0, 20], outcome: 'success' });
  assert.equal((await rejectedInput)[0].reason, 'invalid_input');
  assert.equal((await models.MissionSession.findById(mission._id)).status, 'active');
});

test('actual bank and laboratory objective rules reject out-of-range and out-of-order extraction', () => {
  for (const id of ['assignment-reserve', 'assignment-reactor']) {
    const sim = new MissionSimulation(id, 42, 'rules');
    assert.equal(sim.action({ type: 'handoff' }), false); assert.equal(sim.campaign.interact(sim.body.position), false);
    assert.equal(sim.mission.event('extraction'), false); assert.equal(sim.mission.state, 'ACTIVE');
    const restored = new MissionSimulation(id, 42, 'restored'); restored.restore(JSON.parse(JSON.stringify(sim.checkpoint())), 0);
    assert.deepEqual(restored.snapshot().position, sim.snapshot().position);
  }
});

test('unused connection tickets cannot bypass logout revocation or a session-version reset',async()=>{
  for(const mode of ['logout','reset']){
    const user=await player(),mission=await start(user);
    const response=await api(user,`/sessions/${mission._id}/connect`,{});assert.equal(response.status,200);
    const ticket=[...authority.tickets.values()].find(value=>value.sessionId===mission._id);
    if(mode==='logout')await RevokedToken.create({jti:ticket.jti,kind:'user',expiresAt:new Date(Date.now()+60000)});
    else await User.updateOne({_id:user._id},{$inc:{sessionVersion:1}});
    const socket=io(origin,{transports:['websocket'],autoConnect:false,reconnection:false,auth:{ticket:response.body.ticket}});sockets.push(socket);
    const rejected=once(socket,'connect_error');socket.connect();
    assert.match((await rejected)[0].message,mode==='logout'?/session_revoked/:/account_unavailable/);
    assert.equal(await models.VerifiedMissionResult.countDocuments({sessionId:mission._id}),0);
  }
});

test('paused and loading operations do not stream redundant owner snapshots',async(t)=>{
  const user=await player(),mission=await start(user),{socket,entry}=await connect(user,mission._id);
  const emit=t.mock.method(entry.socket,'emit'),states=()=>emit.mock.calls.filter(call=>call.arguments[0]==='mission:state');
  entry.ready=true;entry.paused=true;authority.tick();
  assert.equal(states().length,0);
  const active=once(socket,'mission:state');entry.paused=false;authority.tick();await active;
  assert.equal(states().length,1);entry.ready=false;entry.lastSnapshot=0;authority.tick();
  assert.equal(states().length,1);
});

test('an expired reconnect has no rewards or death penalty and cannot restore a session',async()=>{
  const user=await player(),mission=await start(user),connected=await connect(user,mission._id);
  connected.socket.disconnect();await new Promise(resolve=>setTimeout(resolve,30));await connected.entry.work;
  await models.MissionSession.updateOne({_id:mission._id},{$set:{reconnectDeadline:new Date(Date.now()-1000)}});
  const eligibility=await api(user,'/eligibility');assert.equal(eligibility.body.eligible,true);
  assert.equal((await api(user,`/sessions/${mission._id}/connect`,{})).status,409);
  assert.equal((await models.MissionLife.findOne({playerId:user._id})).deaths,0);
  assert.equal(await models.VerifiedMissionResult.countDocuments({sessionId:mission._id}),0);
});

test('the recovery interface consumes only an already verified payment entitlement once',async()=>{
  const user=await player(),other=await player();
  await models.MissionLife.create({playerId:user._id,recoveryUntil:new Date(Date.now()+7200000),deaths:1});
  const entitlement=await models.MissionRecoveryEntitlement.create({playerId:user._id,providerReference:'isolated-verified-payment',verifiedAt:new Date(),expiresAt:new Date(Date.now()+60000)});
  await assert.rejects(consumeVerifiedLifeRecovery(other._id,entitlement._id),/entitlement_unavailable/);
  assert.deepEqual(await consumeVerifiedLifeRecovery(user._id,entitlement._id),{recovered:true});
  await assert.rejects(consumeVerifiedLifeRecovery(user._id,entitlement._id),/entitlement_unavailable/);
  assert.equal((await api(user,'/eligibility')).body.eligible,true);
  assert.equal((await api(user,'/recover',{paid:true})).status,404);
});
