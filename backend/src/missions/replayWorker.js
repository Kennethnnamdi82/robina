import { parentPort, workerData } from 'node:worker_threads';
import { gunzipSync } from 'node:zlib';
import { replayMission,completedMissionProof } from '../../generated/missionReplay.mjs';
try {
  const raw=gunzipSync(Buffer.from(workerData.replay,'base64'),{maxOutputLength:64*1024*1024});
  const sim=replayMission(workerData.permit,JSON.parse(raw.toString('utf8')));
  parentPort.postMessage({ok:true,proof:completedMissionProof(sim)});
}catch(error){parentPort.postMessage({ok:false,error:['mission_version_mismatch','mission_replay_not_successful'].includes(error.message)?error.message:'invalid_mission_replay'});}
