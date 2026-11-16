import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {signSession,setSessionCookie,web3Middleware} from '../src/middleware/auth.js';
import {User} from '../src/models/User.js';
import {RevokedToken} from '../src/models/RevokedToken.js';
import {env} from '../src/config/env.js';
import {me} from '../src/controllers/authController.js';
const DAY=86400;
test('user cookies remain valid after hours and days, not just one visit',()=>{
  const token=signSession('0xabc',0),payload=jwt.decode(token);
  assert.equal(payload.exp-payload.iat,14*DAY);
  for(const age of [3600,7*3600,DAY,7*DAY,13*DAY])assert.equal(jwt.verify(token,env.jwtSecret,{clockTimestamp:payload.iat+age}).sub,'0xabc');
  assert.throws(()=>jwt.verify(token,env.jwtSecret,{clockTimestamp:payload.iat+14*DAY+1}));
  let cookie;setSessionCookie({cookie:(name,value,options)=>{cookie={name,value,options};}},token);
  assert.equal(cookie.options.httpOnly,true);assert.equal(cookie.options.path,'/');assert.ok(cookie.options.maxAge>13*DAY*1000);
});
test('rolling renewal preserves the revocation family and enforces a 30-day maximum',()=>{
  const now=Math.floor(Date.now()/1000),original={started:now-29*DAY,iat:now-DAY,jti:'one-revocable-session'};
  const payload=jwt.decode(signSession('user',4,original));
  assert.equal(payload.started,original.started);assert.equal(payload.jti,original.jti);assert.equal(payload.sv,4);assert.ok(payload.exp<=original.started+30*DAY);
  assert.throws(()=>signSession('user',4,{...original,started:now-31*DAY}));
});
test('daily renewal still validates the user and respects logout revocation',async t=>{
  let revoked=false;t.mock.method(RevokedToken,'exists',async()=>revoked);t.mock.method(User,'findOne',()=>({select:async()=>({sessionVersion:2,accountStatus:'active'})}));
  const now=Math.floor(Date.now()/1000),old=jwt.sign({sub:'user',sv:2,iat:now-3*DAY,started:now-8*DAY},env.jwtSecret,{expiresIn:14*DAY,issuer:'basedrop',audience:'basedrop-users',jwtid:'one-family'});
  let issued,continued=0,status=0;const res={cookie:(_name,value)=>{issued=value;},status:code=>{status=code;return res;},json:()=>res};
  await web3Middleware({method:'GET',path:'/me',cookies:{bd_session:old}},res,()=>continued++);
  assert.equal(continued,1);assert.equal(jwt.decode(issued).jti,'one-family');assert.equal(jwt.decode(issued).started,now-8*DAY);
  revoked=true;await web3Middleware({method:'GET',path:'/me',cookies:{bd_session:issued}},res,()=>continued++);assert.equal(status,401);assert.equal(continued,1);
});

test('temporary revocation database outages never turn a valid cookie into a 401 logout',async t=>{
  t.mock.method(RevokedToken,'exists',async()=>{throw Error('database temporarily unavailable');});
  const token=signSession('returning-user',0);let status,body,continued=false,cookies=0;const headers={};
  const res={setHeader:(name,value)=>{headers[name]=value;},cookie:()=>cookies++,status:code=>{status=code;return res;},json:value=>{body=value;return res;}};
  await web3Middleware({method:'GET',path:'/me',cookies:{bd_session:token}},res,()=>{continued=true;});
  assert.equal(status,503);assert.equal(body.error,'session_verification_unavailable');assert.equal(headers['Retry-After'],'3');assert.equal(continued,false);assert.equal(cookies,0);
});

test('temporary account lookup failures remain service failures, including the final profile read',async t=>{
  t.mock.method(RevokedToken,'exists',async()=>false);
  t.mock.method(User,'findOne',()=>({select:async()=>{throw Error('database unavailable');},then:(_resolve,reject)=>reject(Error('database unavailable'))}));
  let status,body;const res={setHeader:()=>{},status:code=>{status=code;return res;},json:value=>{body=value;return res;}};
  await web3Middleware({method:'GET',path:'/me',cookies:{bd_session:signSession('user',0)}},res,()=>assert.fail('must not authorize without checking account'));
  assert.equal(status,503);assert.equal(body.error,'session_verification_unavailable');
  await me({wallet:'user'},res);assert.equal(status,503);assert.equal(body.error,'session_verification_unavailable');
});

test('invalid and expired credentials still fail closed rather than being retried as outages',async()=>{
  const now=Math.floor(Date.now()/1000),expired=jwt.sign({sub:'user',iat:now-15*DAY},env.jwtSecret,{expiresIn:14*DAY,issuer:'basedrop',audience:'basedrop-users'});
  for(const token of ['bad-token',expired]){
    let status;const res={status:code=>{status=code;return res;},json:()=>res};
    await web3Middleware({cookies:{bd_session:token}},res,()=>assert.fail('invalid credential'));
    assert.equal(status,401);
  }
});

test('remembering a device never lifts a permanent account suspension',async t=>{
  t.mock.method(RevokedToken,'exists',async()=>false);t.mock.method(User,'findOne',()=>({select:async()=>({sessionVersion:0,accountStatus:'suspended',suspendedUntil:null})}));
  t.mock.method(User,'updateOne',async()=>assert.fail('permanent suspension cannot be automatically lifted'));
  let status,body;const res={status:code=>{status=code;return res;},json:value=>{body=value;return res;}};
  await web3Middleware({cookies:{bd_session:signSession('blocked-user',0)}},res,()=>assert.fail('suspended account'));
  assert.equal(status,403);assert.equal(body.error,'account_suspended');
});
