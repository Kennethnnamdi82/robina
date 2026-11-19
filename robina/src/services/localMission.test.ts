// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {LocalMission} from './localMission';
import {unpackReplayInput,replayMission,validateReplay,type MissionPermit,type ReplayTape} from '@/features/rivals/authority/MissionReplay';
import {prepareCompletion,sendCompletion,type PendingMission} from './missionCompletion';
import {missionsApi} from './missions';
vi.mock('./missionCompletion',async importOriginal=>({...await importOriginal<typeof import('./missionCompletion')>(),prepareCompletion:vi.fn(),sendCompletion:vi.fn(),pendingMissions:{put:vi.fn()}}));
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../../backend/test/fixtures/reserve-replay-v1.json.gz',import.meta.url))).toString()) as {permit:MissionPermit;tape:ReplayTape};
const neutral=()=>({...unpackReplayInput(fixture.tape.frames[0],1),x:0,y:0,fire:false,interact:false});
afterEach(()=>{vi.restoreAllMocks();vi.clearAllMocks();vi.useRealTimers();});
it('keeps one local movement clock through a six-minute connection gap with no reconnect deadline or gameplay requests',async()=>{
  const fetcher=vi.fn(()=>{throw Error('Network unavailable');});vi.stubGlobal('fetch',fetcher);
  const connect=vi.spyOn(missionsApi,'connect'),heartbeat=vi.spyOn(missionsApi,'heartbeat'),client=new LocalMission(fixture.permit,'owner');
  await client.connect();client.ready();const input={...neutral(),x:1};
  for(let tick=0;tick<30;tick++)client.submit(input);client.flushMovement();const before=client.localSimulation.body.position.clone();
  vi.useFakeTimers();vi.advanceTimersByTime(360000);
  for(let tick=0;tick<30;tick++)client.submit(input);client.flushMovement();
  expect(client.localSimulation.mission.elapsed).toBeCloseTo(1);expect(client.localSimulation.body.position.distanceTo(before)).toBeGreaterThan(.1);
  expect(client.movementStalled).toBe(false);expect(client.latest?.movementInterrupted).toBe(false);
  expect(connect).not.toHaveBeenCalled();expect(heartbeat).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();expect(prepareCompletion).not.toHaveBeenCalled();
  const ticks=client.recorder.tape.ticks;client.pause(true);client.submit(input);client.action({type:'grenade'});expect(client.recorder.tape.ticks).toBe(ticks);expect(client.recorder.tape.actions).toHaveLength(0);
  client.dispose();vi.unstubAllGlobals();
});
it('records the actual successful mission and verifies identical health, movement and combat on replay',async()=>{
  const client=new LocalMission(fixture.permit,'owner');client.ready();
  const pending={key:'owner:run'} as PendingMission,result={_id:'verified',outcome:'success' as const,score:1000,durationSeconds:49,firstCompletion:true,rewardEligible:true,verifiedAt:new Date().toISOString()};
  vi.mocked(prepareCompletion).mockResolvedValue(pending);vi.mocked(sendCompletion).mockResolvedValue(result);
  let tick=0,action=0;
  for(const frame of fixture.tape.frames)for(let repeat=0;repeat<frame[0];repeat++){
    while(fixture.tape.actions[action]?.tick===tick)client.action(fixture.tape.actions[action++].action);
    client.submit(unpackReplayInput(frame,++tick));
  }
  // Movement is paused while the actual handoff menu owns input.
  client.pause(true);
  while(fixture.tape.actions[action]?.tick===tick)client.action(fixture.tape.actions[action++].action);
  client.flushMovement();await client.retrySave();await vi.waitFor(()=>expect(client.saving).toBe('verified'));
  expect(client.recorder.tape).toEqual(fixture.tape);expect(prepareCompletion).toHaveBeenCalledTimes(1);expect(sendCompletion).toHaveBeenCalledTimes(1);
  const replay=replayMission(fixture.permit,client.recorder.tape);
  expect(replay.mission.state).toBe('SUCCESS');expect(replay.controller.health).toBe(72);
  expect(replay.body.position.toArray()).toEqual(client.localSimulation.body.position.toArray());
  expect(replay.firearmShots).toBe(client.localSimulation.firearmShots);expect(replay.firearmHits).toBe(client.localSimulation.firearmHits);client.dispose();
},60000);
it('ends an exhausted recording cleanly and never saves failed or abandoned attempts',()=>{
  const client=new LocalMission({...fixture.permit,maxTicks:1},'owner');client.ready();client.submit(neutral());client.submit(neutral());client.flushMovement();
  expect(client.localSimulation.mission.state).toBe('FAILED');expect(client.recorder.tape.ticks).toBe(1);expect(prepareCompletion).not.toHaveBeenCalled();client.dispose();
});
it('rejects malformed, oversized and invented replay controls before simulation',()=>{
  for(const tape of [{...fixture.tape,ticks:432001},{...fixture.tape,frames:[[1,NaN]]},{...fixture.tape,actions:[{tick:0,action:{type:'teleport',x:1}}]}])expect(()=>validateReplay(tape)).toThrow('invalid_mission_replay');
});
it('automatically retries a completed save after a brief connection failure without a minute-long wait',async()=>{
  vi.useFakeTimers();const client=new LocalMission(fixture.permit,'owner');
  vi.mocked(prepareCompletion).mockResolvedValue({key:'retry-run'} as PendingMission);
  vi.mocked(sendCompletion).mockRejectedValueOnce(Error('Offline')).mockResolvedValueOnce({_id:'verified',outcome:'success',score:6000,durationSeconds:49,firstCompletion:true,rewardEligible:true,verifiedAt:new Date().toISOString()});
  client.localSimulation.mission.step(49);for(const objective of client.localSimulation.mission.definition.objectives)client.localSimulation.mission.event(objective.event);
  await client.retrySave();expect(client.saving).toBe('pending');
  await vi.advanceTimersByTimeAsync(1000);expect(client.saving).toBe('verified');expect(sendCompletion).toHaveBeenCalledTimes(2);client.dispose();
});
