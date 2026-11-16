import test from 'node:test';
import assert from 'node:assert/strict';
import {MissionSimulation} from '../generated/missionSimulation.mjs';

test('prediction labels acknowledge simulated input but cannot grant extra movement time or change health',()=>{
  const normal=new MissionSimulation('assignment-reserve',42,'normal-time'),forged=new MissionSimulation('assignment-reserve',42,'forged-label');
  const command={seq:1,x:1,y:0,aimX:1,aimY:0,aim:[20,1,20],aiming:false,sprint:true,dodge:false,interact:false,fire:false,reload:false,jump:false,jumpHeld:false,highJump:false,touchRepeat:false,throttle:0,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0};
  normal.input({...command,tick:1});forged.input({...command,tick:1000000000});
  assert.equal(normal.snapshot().prediction.tick,null,'receiving input must not acknowledge an unsimulated step');
  for(let i=0;i<15;i++){normal.step();forged.step();}
  assert.deepEqual(normal.body.position,forged.body.position);assert.equal(normal.controller.health,forged.controller.health);
  assert.equal(normal.snapshot().prediction.steps,15);assert.equal(forged.snapshot().prediction.steps,15);
  assert.equal(forged.snapshot().prediction.tick,1000000000);assert.equal(normal.mission.elapsed,forged.mission.elapsed);
  const checkpoint=normal.checkpoint(),restored=new MissionSimulation('assignment-reserve',42,'restored-label');restored.restore(checkpoint,0);
  assert.equal(restored.snapshot().prediction.tick,null);assert.deepEqual(restored.body.position,normal.body.position);
});

test('authoritative idle grenades follow facing instead of the camera target behind the soldier',()=>{
  const sim=new MissionSimulation('assignment-reserve',42,'forward-grenade');
  sim.body.position.set(8,0,8);sim.controller.aimAngle=0;sim.aim.set(-100,1,8);
  assert.equal(sim.action({type:'grenade'}),true);
  for(let i=0;i<12;i++)sim.step();const bomb=sim.field.bombs.find(b=>b.active);
  assert.ok(bomb);assert.ok(bomb.velocity.x>0);assert.equal(sim.grenadesSpent,1);
});

test('server-confirmed pedestrian impacts survive checkpoints without replaying visual events',()=>{
  const sim=new MissionSimulation('assignment-reserve',42,'cinematic-pedestrian'),p=sim.crowd.people[0];
  const origin=sim.body.position.clone().set(p.x,.9,p.z+.7),direction=origin.clone().set(0,0,-1);
  assert.equal(sim.pool.fire(origin,direction,240,1,20,20,'operative','operative'),true);
  sim.step();const events=sim.drainEvents(),hit=events.find(e=>e.type==='impact'&&e.body);
  assert.ok(hit);assert.equal(hit.damage,20);assert.equal(p.health,40);assert.equal(hit.owner,'operative');assert.equal(sim.crowd.combat.hits,1);
  assert.ok(sim.crowd.people.slice(1).some(person=>person.panicUntil>0),'nearby civilians retain their existing crime reaction');
  const saved=sim.checkpoint(),restored=new MissionSimulation('assignment-reserve',42,'cinematic-pedestrian');restored.restore(saved,0);
  assert.equal(restored.snapshot().civilians[0].health,40);assert.equal(restored.crowd.combat.checkpoint().health[0].current,40);assert.equal(restored.drainEvents().length,0);
  assert.equal(restored.snapshot().civilians[0].distance,p.distance);assert.equal(restored.snapshot().civilians[0].panicUntil,p.panicUntil);
});

test('real server grenade fuse emits exactly one presentation blast and does not alter its damage radius',()=>{
  const sim=new MissionSimulation('assignment-reserve',42,'cinematic-grenade'),bomb=sim.field.bombs[0];
  bomb.active=true;bomb.serial=1;bomb.life=.005;bomb.position.set(8,1,26);bomb.velocity.set(0,0,0);
  sim.step();const blasts=sim.drainEvents().filter(e=>e.type==='blast'&&!e.vehicle);
  assert.equal(blasts.length,1);assert.equal(blasts[0].radius,7);assert.equal(sim.field.exploded,1);
  sim.step();assert.equal(sim.drainEvents().filter(e=>e.type==='blast'&&!e.vehicle).length,0);
});

test('server car chain reactions terminate and only emit one blast per destroyed car',()=>{
  const sim=new MissionSimulation('assignment-reserve',42,'cinematic-chain');const cars=sim.traffic.cars.slice(0,2);
  cars.forEach((c,i)=>Object.assign(c,{x:8+i,z:6,health:35,mode:'parked',speed:0,dx:1,dz:0}));sim.vehicles.damage(cars[0],500);
  let blasts=0;for(let i=0;i<6;i++){sim.step();blasts+=sim.drainEvents().filter(e=>e.type==='blast'&&e.vehicle).length;}
  assert.equal(cars[0].exploded,true);assert.equal(cars[1].exploded,true);assert.equal(blasts,2);assert.equal(sim.vehicles.explosions,2);
});
