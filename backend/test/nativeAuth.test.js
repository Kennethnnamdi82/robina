import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import {createNativeGrant,grantDigest,nativeChallenge,NATIVE_REDIRECT,validNativeParameter} from '../src/services/nativeGrant.js';
import {authorizeNative,exchangeNative} from '../src/controllers/nativeAuthController.js';
import {NativeGrant} from '../src/models/NativeGrant.js';
import {User} from '../src/models/User.js';
const random=()=>crypto.randomBytes(32).toString('base64url');
function response(){return{code:200,body:null,session:null,status(code){this.code=code;return this;},json(value){this.body=value;return this;},cookie(name,value,options){this.session={name,value,options};}};}
test('native grants use random, short-lived, hashed one-time codes with a fixed verified HTTPS return',()=>{
 const verifier=random(),state=random(),grant=createNativeGrant(nativeChallenge(verifier),state,1000);
 assert.equal(NATIVE_REDIRECT,'https://rivals-heist.vercel.app/android/auth/callback');assert.equal(grant.expiresAt.getTime(),121000);assert.equal(grant.digest,grantDigest(grant.code));assert.notEqual(grant.digest,grant.code);
 assert.equal(new URL(grant.redirectUrl).searchParams.get('state'),state);assert.equal(new URL(grant.redirectUrl).searchParams.get('code'),grant.code);assert.equal(grant.redirectUrl.includes(verifier),false);
 for(const value of [null,'','x'.repeat(42),'x'.repeat(44),'../../login','https://attacker.invalid'])assert.equal(validNativeParameter(value),false);
 assert.throws(()=>createNativeGrant('bad',state));assert.notEqual(createNativeGrant(nativeChallenge(verifier),state).code,grant.code);
});
test('authorize requires valid PKCE parameters and binds grants to the already authenticated account',async t=>{
 const rows=[];t.mock.method(User,'findOne',async()=>({wallet:'existing-user',sessionVersion:4}));t.mock.method(NativeGrant,'create',async row=>rows.push(row));
 const res=response();await authorizeNative({wallet:'existing-user',body:{challenge:nativeChallenge(random()),state:random()}},res,error=>{throw error;});
 assert.equal(res.code,200);assert.equal(rows.length,1);assert.equal(rows[0].wallet,'existing-user');assert.equal(rows[0].sessionVersion,4);assert.equal('code'in rows[0],false);assert.equal('verifier'in rows[0],false);
 const invalid=response();await authorizeNative({wallet:'existing-user',body:{challenge:'invalid',state:random()}},invalid,error=>{throw error;});assert.equal(invalid.code,400);assert.equal(rows.length,1);
});
test('only the matching native verifier can atomically exchange a grant; replay cannot create another session',async t=>{
 const verifier=random(),grant=createNativeGrant(nativeChallenge(verifier),random());let available=true;
 t.mock.method(NativeGrant,'findOneAndDelete',async query=>{if(!available||query.digest!==grant.digest||query.challenge!==grant.challenge||grant.expiresAt<=query.expiresAt.$gt)return null;available=false;return{wallet:'existing-user',sessionVersion:3};});
 t.mock.method(User,'findOne',async()=>({wallet:'existing-user',sessionVersion:3,accountStatus:'active'}));
 const wrong=response();await exchangeNative({body:{code:grant.code,verifier:random()}},wrong,error=>{throw error;});assert.equal(wrong.code,401);assert.equal(available,true);
 const correct=response();await exchangeNative({body:{code:grant.code,verifier}},correct,error=>{throw error;});assert.equal(correct.code,200);assert.equal(correct.body.user.wallet,'existing-user');assert.equal(correct.session.name,'bd_session');assert.equal(correct.session.options.httpOnly,true);assert.equal(jwt.decode(correct.session.value).sv,3);
 const replay=response();await exchangeNative({body:{code:grant.code,verifier}},replay,error=>{throw error;});assert.equal(replay.code,401);assert.equal(replay.session,null);
});
test('invalid, expired, suspended or session-version-reset handoffs do not bypass account security',async t=>{
 let result=null,user=null;t.mock.method(NativeGrant,'findOneAndDelete',async()=>result);t.mock.method(User,'findOne',async()=>user);
 for(const body of [{},{code:'bad',verifier:random()}]){const res=response();await exchangeNative({body},res,error=>{throw error;});assert.equal(res.code,400);}
 const request={body:{code:random(),verifier:random()}};
 let res=response();await exchangeNative(request,res,error=>{throw error;});assert.equal(res.code,401);
 result={wallet:'user',sessionVersion:2};user={wallet:'user',sessionVersion:3};res=response();await exchangeNative(request,res,error=>{throw error;});assert.equal(res.code,401);
 user={wallet:'user',sessionVersion:2,accountStatus:'suspended',suspendedUntil:null};res=response();await exchangeNative(request,res,error=>{throw error;});assert.equal(res.code,403);assert.equal(res.session,null);
});
