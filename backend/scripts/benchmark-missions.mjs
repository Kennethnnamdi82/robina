import { performance } from 'node:perf_hooks';
import { MissionSimulation } from '../generated/missionSimulation.mjs';
const count=Math.max(1,Math.min(32,Number(process.env.MISSION_BENCHMARK_SESSIONS)||4));
const simulations=Array.from({length:count},(_,i)=>new MissionSimulation(i%2?'assignment-reactor':'assignment-reserve',42+i*21,`benchmark-${i}`));
const seconds=10,start=performance.now(),cpuStart=process.cpuUsage();
for(let tick=0;tick<seconds*60;tick++)for(const sim of simulations)sim.step();
const elapsedMs=performance.now()-start,cpu=process.cpuUsage(cpuStart);
console.log(JSON.stringify({sessions:count,simulationSeconds:seconds,elapsedMs:Math.round(elapsedMs),
  cpuMs:Math.round((cpu.user+cpu.system)/1000),estimatedSingleCorePercent:Math.round((cpu.user+cpu.system)/(seconds*10000)),heapMB:Math.round(process.memoryUsage().heapUsed/1048576),
  ownerSnapshotBytes:Buffer.byteLength(JSON.stringify(simulations[0].snapshot())),scenario:'idle bank/lab; excludes network/database and active pursuit'},null,2));
