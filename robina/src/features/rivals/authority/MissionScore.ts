// Shared presentation/verification score. The server calculates it independently
// from replayed gameplay; a client preview is never accepted as reward evidence.
export const SCORE_VERSION=1;
export const REPLAY_SCORE_VERSION=2;
export const SCORE_WEIGHTS=Object.freeze({time:25,enemies:25,survival:20,accuracy:15,optional:15});
export interface ScoreInputs {durationSeconds:number;enemiesDefeated:number;expectedEnemies:number;remainingHealth:number;maxHealth:number;shotsFired:number;successfulHits:number;optionalCompleted:number;optionalTotal:number}
export function scoreVerifiedRun({durationSeconds,enemiesDefeated,expectedEnemies,remainingHealth,maxHealth,shotsFired,successfulHits,optionalCompleted,optionalTotal}:ScoreInputs){
  const numbers=[durationSeconds,enemiesDefeated,expectedEnemies,remainingHealth,maxHealth,shotsFired,successfulHits,optionalCompleted,optionalTotal];
  if(numbers.some(value=>!Number.isFinite(value)||value<0)||durationSeconds<1||durationSeconds>172800||maxHealth<100||maxHealth>500||
    remainingHealth>maxHealth||expectedEnemies<1||expectedEnemies>1000||enemiesDefeated>10000||shotsFired>1000000||successfulHits>shotsFired||
    optionalCompleted>optionalTotal||optionalTotal>32||numbers.slice(1).some(value=>!Number.isInteger(value)))throw Error('invalid_verified_stats');
  const clamp=(value:number)=>Math.max(0,Math.min(1,value));
  const parts={time:clamp((1800-durationSeconds)/1500),enemies:clamp(enemiesDefeated/expectedEnemies),survival:clamp(remainingHealth/maxHealth),
    accuracy:shotsFired?clamp(successfulHits/shotsFired):0,optional:optionalTotal?clamp(optionalCompleted/optionalTotal):1};
  return Math.round((Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]).reduce((total,key)=>total+parts[key]*SCORE_WEIGHTS[key]*100,0));
}
