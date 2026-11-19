// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {gunzipSync} from 'node:zlib';
import {pendingMissions,prepareCompletion,sendCompletion,type PendingMission} from './missionCompletion';
import {missionsApi} from './missions';
import type {MissionPermit,ReplayTape} from '@/features/rivals/authority/MissionReplay';
import type {MissionSnapshot} from '@/features/rivals/missions/types';
afterEach(()=>vi.restoreAllMocks());
const entry:PendingMission={key:'owner:run',owner:'owner',id:'run',token:'signed',replay:'A'.repeat(80004),snapshot:{} as MissionSnapshot,venue:0};
const result={_id:'verified',outcome:'success' as const,score:1000,durationSeconds:49,firstCompletion:true,rewardEligible:true,verifiedAt:new Date().toISOString()};
it('stores a compressed input recording only after success, isolated by account and permit',async()=>{
  const put=vi.spyOn(pendingMissions,'put').mockResolvedValue('saved'),permit={id:'run',token:'signed'} as MissionPermit,tape:ReplayTape={version:1,ticks:1,frames:[],actions:[]};
  await expect(prepareCompletion('owner',permit,tape,{state:'FAILED'} as MissionSnapshot,0)).rejects.toThrow('Only successful');expect(put).not.toHaveBeenCalled();
  const saved=await prepareCompletion('owner',permit,tape,{state:'SUCCESS'} as MissionSnapshot,0);
  expect(saved.key).toBe('owner:run');expect(saved.snapshot.runId).toBe('run');expect(JSON.parse(gunzipSync(Buffer.from(saved.replay,'base64')).toString())).toEqual(tape);expect(put).toHaveBeenCalledWith(saved);
});
it('uploads below the native body limit, coalesces retries, and removes only a verified completion',async()=>{
  const remove=vi.spyOn(pendingMissions,'remove').mockResolvedValue(undefined),upload=vi.spyOn(missionsApi,'upload').mockResolvedValueOnce({status:'uploading',id:'run'}).mockResolvedValueOnce({status:'uploading',id:'run'}).mockResolvedValueOnce({status:'verified',id:'run',result});
  const first=sendCompletion(entry),duplicate=sendCompletion(entry);expect(first).toBe(duplicate);expect(await first).toBe(result);
  expect(upload).toHaveBeenCalledTimes(3);for(const [body]of upload.mock.calls)expect(JSON.stringify(body).length).toBeLessThan(65536);
  expect(upload.mock.calls.map(([body])=>body.index)).toEqual([0,1,2]);expect(remove).toHaveBeenCalledWith(entry.key);
});
it('keeps a completed run after a connection failure so a later retry can finish once',async()=>{
  const remove=vi.spyOn(pendingMissions,'remove').mockResolvedValue(undefined),upload=vi.spyOn(missionsApi,'upload').mockRejectedValueOnce(Error('Offline')).mockResolvedValue({status:'verified',id:'run',result});
  await expect(sendCompletion(entry)).rejects.toThrow('Offline');expect(remove).not.toHaveBeenCalled();
  expect(await sendCompletion(entry)).toBe(result);expect(remove).toHaveBeenCalledTimes(1);expect(upload).toHaveBeenCalledTimes(2);
});
it('can save online when device storage is denied and reports the absence of a durable offline copy',async()=>{
  vi.spyOn(pendingMissions,'put').mockRejectedValue(Error('Quota exceeded'));vi.spyOn(pendingMissions,'remove').mockRejectedValue(Error('Storage denied'));
  vi.spyOn(missionsApi,'upload').mockResolvedValue({status:'verified',id:'run',result});
  const saved=await prepareCompletion('owner',{id:'run',token:'signed'} as MissionPermit,{version:1,ticks:1,frames:[],actions:[]},{state:'SUCCESS'} as MissionSnapshot,0);
  expect(saved.persisted).toBe(false);expect(await sendCompletion(saved)).toBe(result);
});
it('records a final rejection and skips further uploads of that recording',async()=>{
  const rejected={...entry};
  const put=vi.spyOn(pendingMissions,'put').mockResolvedValue(rejected.key);
  const upload=vi.spyOn(missionsApi,'upload').mockRejectedValue(Error('mission_replay_not_successful'));
  await expect(sendCompletion(rejected)).rejects.toThrow('mission_replay_not_successful');
  expect(put).toHaveBeenCalledWith({...entry,rejection:'mission_replay_not_successful'});
  await expect(sendCompletion(rejected)).rejects.toThrow('mission_replay_not_successful');
  expect(upload).toHaveBeenCalledTimes(1);
});
