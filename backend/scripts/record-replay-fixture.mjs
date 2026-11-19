import {initializeReplay,MissionRecorder,replayMission} from '../generated/missionReplay.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';
const permit={id:'0123456789abcdef01234567',missionId:'assignment-reserve',seed:42,issuedAt:Date.now()-3600000,maxTicks:432000,simulationVersion:3,initial:{grenades:5,ownedIds:['elite'],weapon:'elite',appearance:{outfit:null,finish:null,emote:null,effect:null,identity:null}}};
const sim=initializeReplay(permit),recorder=new MissionRecorder();let route=[],goalKey='',stuck=0,lastX=sim.body.position.x,lastZ=sim.body.position.z;
for(let tick=0;tick<60*600&&sim.mission.state==='ACTIVE';tick++){
 const snap=sim.mission.snapshot(),objective=snap.objectives.find(o=>o.id===snap.activeId),target=sim.campaign.destination??objective?.marker;
 const player={x:sim.body.position.x*40,y:sim.body.position.z*40};
 if(target&&(tick%30===0||goalKey!==snap.activeId)){route=sim.navigation.path(player,target);goalKey=snap.activeId;}
 while(route.length&&Math.hypot(route[0].x-player.x,route[0].y-player.y)<18)route.shift();
 let dx=(route[0]?.x??target?.x??player.x)-player.x,dz=(route[0]?.y??target?.y??player.y)-player.y,len=Math.hypot(dx,dz);
 const targetDistance=target?Math.hypot(target.x-player.x,target.y-player.y):Infinity;
 if(targetDistance<60||sim.campaign.holdActive){dx=dz=0;len=0;}
 const enemies=sim.enemies.filter(e=>e.alive).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
 const enemy=enemies[0],ex=enemy?enemy.x*.025:sim.body.position.x,ez=enemy?enemy.y*.025:sim.body.position.z-20;
 const ax=ex-sim.body.position.x,az=ez-sim.body.position.z,al=Math.hypot(ax,az)||1;
 const frame={x:len?dx/len:0,y:len?dz/len:0,aimX:ax/al,aimY:az/al,aim:[ex,1.1,ez],aiming:Boolean(enemy),sprint:true,dodge:false,interact:targetDistance<74,fire:Boolean(enemy&&al<65),reload:false,jump:stuck>100,jumpHeld:false,highJump:false,touchRepeat:true,throttle:0,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0};
 sim.input(recorder.input(frame));sim.step();sim.drainEvents();
 if(sim.campaign.handoff==='waiting'){const action={type:'handoff'};recorder.action(action);sim.action(action);}
 if(Math.hypot(sim.body.position.x-lastX,sim.body.position.z-lastZ)<.0001&&len)stuck++;else stuck=0;lastX=sim.body.position.x;lastZ=sim.body.position.z;
 if(tick%600===0)console.log(JSON.stringify({tick,state:sim.mission.state,objective:snap.activeId,health:sim.controller.health,x:lastX,z:lastZ,route:route.length,message:sim.campaign.message}));
}
console.log(JSON.stringify({state:sim.mission.state,health:sim.controller.health,ticks:recorder.tape.ticks,completed:[...sim.mission.completed],message:sim.campaign.message}));
if(sim.mission.state==='SUCCESS'){const replay=replayMission(permit,recorder.tape);console.log('REPLAY_SUCCESS',replay.mission.elapsed);fs.writeFileSync(new URL('../test/fixtures/reserve-replay-v1.json.gz',import.meta.url),zlib.gzipSync(JSON.stringify({permit,tape:recorder.tape})));}
