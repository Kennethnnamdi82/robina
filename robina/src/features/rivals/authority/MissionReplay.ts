import { MissionSimulation, COLLISION_SIMULATION_VERSION,SIMULATION_VERSION, type AuthorityAction, type AuthorityInput } from './MissionSimulation';
import { emptyCommand } from '../input/InputBuffer';

export const REPLAY_VERSION = 1;
export const MAX_REPLAY_TICKS = 432000; // Two hours of fixed 60Hz simulation.
export interface MissionPermit {
  id: string; missionId: string; seed: number; issuedAt: number; maxTicks: number;
  simulationVersion: number; token: string;
  initial: { grenades: number; ownedIds: string[]; weapon: string | null; appearance: MissionSimulation['appearance'] };
}
export interface ReplayTape { version: 1; ticks: number; frames: number[][]; actions: { tick: number; action: AuthorityAction }[] }
const flags = ['aiming','sprint','dodge','interact','fire','reload','jump','jumpHeld','highJump','touchRepeat','brake'] as const;
export function packReplayInput(input: Omit<AuthorityInput,'seq'>) {
  return [1,input.x,input.y,input.aimX,input.aimY,...input.aim,flags.reduce((bits,key,i)=>bits|Number(input[key])<<i,0),
    input.throttle,input.steer,input.stickX,input.stickY,input.cameraYaw];
}
export function unpackReplayInput(frame: number[], tick: number): AuthorityInput {
  const input: AuthorityInput = {...emptyCommand(),seq:tick,aim:[frame[5],frame[6],frame[7]],x:frame[1],y:frame[2],aimX:frame[3],aimY:frame[4],
    jump:false,jumpHeld:false,highJump:false,touchRepeat:false,brake:false,throttle:frame[9],steer:frame[10],stickX:frame[11],stickY:frame[12],cameraYaw:frame[13]};
  flags.forEach((key,i)=>{input[key]=Boolean(frame[8]&(1<<i));});
  return input;
}
export class MissionRecorder {
  readonly tape: ReplayTape = {version:REPLAY_VERSION,ticks:0,frames:[],actions:[]};
  input(input: Omit<AuthorityInput,'seq'>) {
    if(this.tape.ticks>=MAX_REPLAY_TICKS)throw Error('mission_replay_limit');
    const frame=packReplayInput(input),last=this.tape.frames.at(-1);
    if(last&&frame.every((n,i)=>i===0||n===last[i]))last[0]++;
    else this.tape.frames.push(frame);
    this.tape.ticks++;
    return {...input,seq:this.tape.ticks};
  }
  action(action: AuthorityAction) {
    if(this.tape.actions.length>=20000)throw Error('mission_replay_limit');
    this.tape.actions.push({tick:this.tape.ticks,action:{...action}});
  }
}
export function initializeReplay(permit: Omit<MissionPermit,'token'>) {
  if(permit.simulationVersion!==SIMULATION_VERSION&&permit.simulationVersion!==COLLISION_SIMULATION_VERSION)throw Error('mission_version_mismatch');
  const sim=new MissionSimulation(permit.missionId,permit.seed,permit.id,permit.simulationVersion);
  sim.field.quantity=permit.initial.grenades;
  sim.appearance=structuredClone(permit.initial.appearance);
  if(permit.initial.weapon)sim.loadout.equipCollection(permit.initial.weapon,permit.initial.ownedIds,0);
  return sim;
}
export function completedMissionProof(sim:MissionSimulation){
  if(sim.mission.state!=='SUCCESS'||sim.controller.health<=0)throw Error('mission_replay_not_successful');
  const optional=sim.mission.definition.objectives.filter(o=>o.optional);
  return {durationSeconds:Math.max(1,Math.ceil(sim.mission.elapsed)),health:sim.controller.health,maxHealth:sim.controller.maxHealth,
    grenadeBalance:sim.field.quantity,grenadesSpent:sim.grenadesSpent,metrics:{enemiesDefeated:sim.enemies.filter(e=>!e.alive).length,
      expectedEnemies:sim.campaign.assignment.security,shotsFired:sim.firearmShots,successfulHits:Math.min(sim.firearmShots,sim.firearmHits),
      optionalCompleted:optional.filter(o=>sim.mission.completed.has(o.id)).length,optionalTotal:optional.length}};
}
function validAction(action: unknown): action is AuthorityAction {
  if(!action||typeof action!=='object'||Array.isArray(action))return false;
  const a=action as Record<string,unknown>;
  if(['vehicle','grenade','handoff','cancelHandoff','cancelPickup'].includes(String(a.type)))return Object.keys(a).length===1;
  return ['weapon','pickup'].includes(String(a.type))&&Object.keys(a).length===2&&Number.isInteger(a.slot)&&Number(a.slot)>=0&&Number(a.slot)<=2;
}
export function validateReplay(input: unknown, maximum=MAX_REPLAY_TICKS): asserts input is ReplayTape {
  const tape=input as ReplayTape;
  if(!tape||tape.version!==REPLAY_VERSION||!Number.isSafeInteger(tape.ticks)||tape.ticks<1||tape.ticks>maximum||
    !Array.isArray(tape.frames)||tape.frames.length>tape.ticks||!Array.isArray(tape.actions)||tape.actions.length>20000)throw Error('invalid_mission_replay');
  let ticks=0;
  for(const f of tape.frames){
    if(!Array.isArray(f)||f.length!==14||f.some(n=>typeof n!=='number'||!Number.isFinite(n))||
      !Number.isSafeInteger(f[0])||f[0]<1||f[0]>maximum||
      [1,2,3,4,9,10,11,12].some(i=>Math.abs(f[i])>1)||Math.abs(f[5])>1000||Math.abs(f[6])>100||Math.abs(f[7])>1000||
      !Number.isInteger(f[8])||f[8]<0||f[8]>2047||Math.abs(f[13])>100000)throw Error('invalid_mission_replay');
    ticks+=f[0];if(ticks>maximum)throw Error('invalid_mission_replay');
  }
  if(ticks!==tape.ticks)throw Error('invalid_mission_replay');
  let previous=0;
  for(const row of tape.actions){if(!row||!Number.isSafeInteger(row.tick)||row.tick<previous||row.tick>ticks||!validAction(row.action))throw Error('invalid_mission_replay');previous=row.tick;}
}
/** Verification runs the unchanged gameplay rules; it never restores a client
 * checkpoint or accepts client positions, damage, stats or a victory flag. */
export function replayMission(permit: Omit<MissionPermit,'token'>, tape: unknown) {
  validateReplay(tape,Math.min(permit.maxTicks,MAX_REPLAY_TICKS));
  const sim=initializeReplay(permit);
  let frameIndex=0,remaining=tape.frames[0][0],actionIndex=0;
  for(let tick=0;tick<=tape.ticks;tick++){
    while(tape.actions[actionIndex]?.tick===tick)sim.action(tape.actions[actionIndex++].action);
    if(tick===tape.ticks)break;
    if(sim.mission.state!=='ACTIVE')throw Error('mission_replay_not_successful');
    sim.input(unpackReplayInput(tape.frames[frameIndex],tick+1));sim.step();sim.drainEvents();
    if(--remaining===0&&tick+1<tape.ticks)remaining=tape.frames[++frameIndex][0];
  }
  if(sim.mission.state!=='SUCCESS'||sim.controller.health<=0)throw Error('mission_replay_not_successful');
  return sim;
}
