import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
process.env.DOTENV_CONFIG_PATH='test/nonexistent-completion-env';process.env.NODE_ENV='test';
process.env.JWT_SECRET='mission-completion-isolated-test-secret-only-32chars';
const {createApp}=await import('../src/app.js');
const {signSession}=await import('../src/middleware/auth.js');
const {initializeMongoModels}=await import('../src/db/mongo.js');
const {User}=await import('../src/models/User.js');
const {MissionSession,MissionCheckpoint,MissionCombatEvent,VerifiedMissionResult}=await import('../src/missions/models.js');
const {StoreInventory,StoreLedger}=await import('../src/payments/storeModels.js');
const {MissionCompletions}=await import('../src/missions/completions.js');
const {storeEnvironment}=await import('../src/payments/service.js');
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/reserve-replay-v1.json.gz',import.meta.url))).toString());
let mongo,server,origin,counter=0;const completions=new MissionCompletions();
before(async()=>{
  const binary=fileURLToPath(new URL('../.cache/test-mongodb/mongod.exe',import.meta.url));
  mongo=await MongoMemoryReplSet.create({binary:{version:'7.0.24',...(process.platform==='win32'&&existsSync(binary)?{systemBinary:binary}:{})},replSet:{count:1,storageEngine:'wiredTiger'},instanceOpts:[{ip:'127.0.0.1'}]});
  await mongoose.connect(mongo.getUri(),{dbName:'rivals-completion-isolated-tests'});await initializeMongoModels();
  server=createApp(()=>true,{missionCompletions:completions}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
},{timeout:240000});
after(async()=>{await completions.close();if(server)await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();await mongo?.stop();});
beforeEach(async()=>{await completions.close();completions.closing=false;});
async function account(){
  const wallet='0x'+(++counter).toString(16).padStart(40,'0'),user=await User.create({wallet,referralCode:'completion-'+counter});
  await StoreInventory.create({playerId:user._id,environment:storeEnvironment(),ownedIds:['elite'],equippedWeapon:'elite',grenades:5});
  return {user,cookie:'bd_session='+signSession(wallet)};
}
async function request(account,path,method='GET',body){
  const response=await fetch(origin+'/api/missions'+path,{method,headers:{cookie:account.cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json()};
}
async function permit(account){return (await request(account,'/permits','POST',{missionId:'assignment-reserve',seed:42})).body.permit;}
async function upload(account,p,tape=fixture.tape){
  // Only this isolated test has the issuer key, so a recorded run needs no real-time wait.
  const {token,...claims}=p;claims.issuedAt=Date.now()-60000;
  const signed=jwt.sign(claims,process.env.JWT_SECRET,{audience:'rivals-mission-replay-v1',issuer:'rivals',subject:String(account.user._id),expiresIn:'7d'});
  const replay=gzipSync(JSON.stringify(tape)).toString('base64'),count=Math.ceil(replay.length/40000);let response;
  for(let index=0;index<count;index++)response=await request(account,'/completions','POST',{permit:signed,index,count,chunk:replay.slice(index*40000,(index+1)*40000)});
  return {response,signed,replay,count};
}
async function waitFor(account,id){
  for(let i=0;i<240;i++){const response=await request(account,'/completions/'+id);if(['verified','rejected'].includes(response.body.status))return response.body;await delay(250);}
  assert.fail('Replay did not finish');
}
test('launch permit and unfinished play write no mission sessions, health, checkpoints or results',async()=>{
  const a=await account(),p=await permit(a);assert.equal(p.initial.weapon,'elite');assert.equal(p.initial.grenades,5);
  assert.equal(p.simulationVersion,3);
  const upgraded=await request(a,'/permits','POST',{missionId:'assignment-reserve',seed:42,simulationVersion:4});
  assert.equal(upgraded.status,200);assert.equal(upgraded.body.permit.simulationVersion,4);
  const visibleCars=await request(a,'/permits','POST',{missionId:'assignment-reserve',seed:42,simulationVersion:5});
  assert.equal(visibleCars.status,200);assert.equal(visibleCars.body.permit.simulationVersion,5);
  for(const model of [MissionSession,MissionCheckpoint,MissionCombatEvent,VerifiedMissionResult])assert.equal(await model.countDocuments({playerId:a.user._id}),0);
  assert.equal((await StoreInventory.findOne({playerId:a.user._id})).grenades,5);
});
test('completion rejects an unsigned or different-account permit before accepting any replay',async()=>{
  const a=await account(),b=await account(),p=await permit(a),body={permit:p.token,index:0,count:1,chunk:'AAAA'};
  assert.equal((await request(b,'/completions','POST',body)).status,403);
  assert.equal((await request(a,'/completions','POST',{...body,permit:p.token.slice(0,-5)+'wrong'})).status,403);
  assert.equal(await MissionSession.countDocuments({playerId:a.user._id}),0);
});
test('a claimed success with an incomplete real replay creates no mission or reward record',async()=>{
  const a=await account(),p=await permit(a);
  const tape={version:1,ticks:1,frames:[[...fixture.tape.frames[0]]],actions:[]};tape.frames[0][0]=1;
  const {response}=await upload(a,p,tape);assert.equal(response.status,202);
  const result=await waitFor(a,p.id);assert.equal(result.status,'rejected');assert.equal(result.error,'mission_replay_not_successful');
  assert.equal(await MissionSession.countDocuments({playerId:a.user._id}),0);assert.equal(await VerifiedMissionResult.countDocuments({playerId:a.user._id}),0);
  assert.equal(await StoreLedger.countDocuments({playerId:a.user._id}),0);
},{timeout:70000});
test('rejected uploads cannot occupy the queue and prevent another player from submitting',async()=>{
  const tape={version:1,ticks:1,frames:[[...fixture.tape.frames[0]]],actions:[]};tape.frames[0][0]=1;
  for(let i=0;i<3;i++){
    const a=await account(),p=await permit(a),sent=await upload(a,p,tape);assert.equal(sent.response.status,202);
    assert.equal((await waitFor(a,p.id)).error,'mission_replay_not_successful');
  }
},{timeout:70000});
test('natural successful replay commits once; retransmission and duplicate chunks cannot award twice',async()=>{
  const a=await account(),p=await permit(a),sent=await upload(a,p);assert.equal(sent.response.status,202);
  const saved=await waitFor(a,p.id);assert.equal(saved.status,'verified');assert.equal(saved.result.outcome,'success');assert.equal(saved.result.remainingHealth,72);assert.equal(saved.result.durationSeconds,49);assert.equal(saved.result.firstCompletion,true);assert.equal(saved.result.scoreVersion,2);
  const session=await MissionSession.findById(p.id);assert.equal(session.status,'verified_success');assert.equal(session.verificationSource,'replay');
  const duplicate=await request(a,'/completions','POST',{permit:sent.signed,index:0,count:sent.count,chunk:sent.replay.slice(0,40000)});
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.result._id,saved.result._id);
  assert.equal(await MissionSession.countDocuments({playerId:a.user._id}),1);assert.equal(await VerifiedMissionResult.countDocuments({playerId:a.user._id}),1);
  assert.equal(await MissionCheckpoint.countDocuments({playerId:a.user._id}),0);assert.equal(await MissionCombatEvent.countDocuments({sessionId:p.id}),0);
  assert.equal((await request(await account(),'/completions/'+p.id)).body.status,'missing');
  const again=await permit(a);await upload(a,again);const repeated=await waitFor(a,again.id);
  assert.equal(repeated.status,'verified');assert.equal(repeated.result.firstCompletion,false);assert.equal(repeated.result.rewardEligible,false);
},{timeout:70000});
