// Local-only Playwright fixture. Never start this script as a production server.
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import mongoose from 'mongoose';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
process.env.DOTENV_CONFIG_PATH='test/nonexistent-browser-env';process.env.NODE_ENV='test';
process.env.JWT_SECRET='isolated-browser-mission-secret-32-characters';process.env.BOUNTY_PAYOUTS_ENABLED='false';
process.env.CORS_ORIGIN='http://127.0.0.1:8086';process.env.SIWE_DOMAIN='127.0.0.1:8086';process.env.SIWE_URI='http://127.0.0.1:8086';
const {createApp}=await import('../src/app.js');
const {LiveMissionAuthority}=await import('../src/missions/liveAuthority.js');
const {signSession}=await import('../src/middleware/auth.js');
const {User}=await import('../src/models/User.js');
const {RevokedToken}=await import('../src/models/RevokedToken.js');
const models=await import('../src/missions/models.js');
const binary=fileURLToPath(new URL('../.cache/test-mongodb/mongod.exe',import.meta.url));
const mongo=await MongoMemoryReplSet.create({binary:{version:'7.0.24',...(process.platform==='win32'&&existsSync(binary)?{systemBinary:binary}:{})},
  replSet:{count:1,storageEngine:'wiredTiger'},instanceOpts:[{ip:'127.0.0.1'}]});
await mongoose.connect(mongo.getUri(),{dbName:'isolated-browser-missions'});
await Promise.all([User.init(),RevokedToken.init(),...Object.values(models).map(model=>model.init())]);
const authority=new LiveMissionAuthority({origins:['http://127.0.0.1:8086'],publicOrigin:'http://127.0.0.1:4106',maxSessions:4});
const app=createApp(()=>true,{missionAuthority:authority});let counter=700;
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4106');
  if(!url.pathname.startsWith('/__test/'))return app(req,res);
  res.setHeader('Content-Type','application/json');
  res.setHeader('Connection','close');
  try{
    if(url.pathname==='/__test/ready')return res.end('{"ok":true}');
    if(url.pathname==='/__test/session'){
      const id=++counter,user=await User.create({wallet:'0x'+id.toString(16).padStart(40,'0'),referralCode:`browser-${id}`});
      return res.end(JSON.stringify({token:signSession(user.wallet),playerId:String(user._id)}));
    }
    const playerId=url.searchParams.get('playerId');
    if(url.pathname==='/__test/state'){
      const [life,results]=await Promise.all([models.MissionLife.findOne({playerId}).lean(),models.VerifiedMissionResult.find({playerId}).lean()]);
      const live=[...authority.entries.values()].find(e=>e.playerId===playerId);
      return res.end(JSON.stringify({life,results,live:live?{ready:live.ready,paused:live.paused,connected:Boolean(live.socket),health:live.sim.controller.health,elapsed:live.sim.mission.elapsed,faulted:live.faulted,position:live.sim.body.position.toArray(),vehicle:live.sim.vehicles.snapshot}:null}));
    }
    const entry=[...authority.entries.values()].find(e=>e.playerId===playerId);
    if(!entry){res.statusCode=409;return res.end('{"error":"operation_not_ready"}');}
    if(url.pathname==='/__test/motion-setup'){
      const sim=entry.sim;sim.neutral();sim.controller.stop();sim.police.end();
      sim.enemies.forEach(e=>{e.health.current=0;});sim.body.position.set(8,0,8);
      // An empty, real avenue isolates motion from traffic collisions. Never
      // spawn the test car inside an existing traffic vehicle's collision box.
      for(const car of sim.traffic.cars)if(car.id!==28)Object.assign(car,{x:-1000-car.id*10,z:-1000,speed:0,mode:'parked'});
      if(url.searchParams.get('vehicle')==='true'){
        const car=sim.traffic.cars[28];Object.assign(car,{x:8,z:12,dx:0,dz:1,speed:0,mode:'parked'});
        sim.body.position.set(5.9,0,12);
      }
      await authority.checkpoint(entry,'test-motion');entry.socket?.emit('mission:state',sim.snapshot());
      return res.end('{"ok":true}');
    }
    if(url.pathname==='/__test/combat'){
      const enemy=entry.sim.enemies[0];enemy.x=8*40;enemy.y=26*40;enemy.angle=Math.PI/2;
      await authority.checkpoint(entry,'test-encounter');
      return res.end('{"ok":true}');
    }
    if(url.pathname==='/__test/extraction-checkpoint'){
      const wasPaused=entry.paused;entry.paused=true;
      await entry.work;
      const sim=entry.sim;
      for(const objective of sim.mission.definition.objectives)if(objective.id!=='extract')sim.mission.event(objective.event);
      sim.campaign.carrying=true;sim.campaign.handoff='waiting';sim.police.end();
      sim.body.position.set(sim.campaign.assignment.extraction.x,0,sim.campaign.assignment.extraction.z);
      await authority.checkpoint(entry,'test-extraction');
      entry.paused=wasPaused;
      entry.socket?.emit('mission:state',sim.snapshot());
      return res.end('{"ok":true}');
    }
    res.statusCode=404;res.end('{"error":"not_found"}');
  }catch(error){res.statusCode=500;res.end(JSON.stringify({error:error.message}));}
});
authority.attach(server);server.listen(4106,'127.0.0.1',()=>console.log('isolated mission browser fixture ready'));
let closing=false;
async function close(){if(closing)return;closing=true;await authority.close();await mongoose.disconnect();await mongo.stop();process.exit(0);}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
