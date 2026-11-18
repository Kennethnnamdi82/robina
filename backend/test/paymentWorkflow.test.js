import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
process.env.DOTENV_CONFIG_PATH='test/no-payment-env';process.env.NODE_ENV='test';
process.env.JWT_SECRET='isolated-payments-test-session-secret';process.env.ADMIN_EMAIL='payments@example.invalid';
process.env.BACHS_WEBHOOK_SECRET='isolated-test-webhook-secret';process.env.BACHS_API_KEY='sk_sandbox_test_fake_not_a_real_key';
await import('../src/db/mongo.js');
const {env}=await import('../src/config/env.js');
const {createApp}=await import('../src/app.js');
const {signSession}=await import('../src/middleware/auth.js');
const {User}=await import('../src/models/User.js');
const {StoreOrder,StoreInventory,StoreLedger,StoreSeason,StoreSeasonClaim,StorePurchaseLock}=await import('../src/payments/storeModels.js');
const {publishSeason,claimReward,closeSeason}=await import('../src/payments/seasons.js');
const {MissionLife,MissionSession}=await import('../src/missions/models.js');
const {createPaymentService,inventory,reserveMissionGrenade}=await import('../src/payments/service.js');
let mongo,server,origin,provider,service,serial=1000;
function fakeProvider(){
  const checkouts=new Map(),payments=new Map();let calls=0;
  return {environment:'sandbox',checkouts,payments,failRead:false,unknownWrite:false,get calls(){return calls;},
    async product(p){return 'prod_'+p.id;},
    async createCheckout(order){
      calls++;const checkout_id='chk_'+order._id;
      const remote={checkout_id,checkout_url:'https://checkout.bachs.io/c/'+order._id,status:'open',payment_status:'requires_payment_method',
        reference:String(order._id),amount:(order.cents/100).toFixed(2),currency:'USD',metadata:{rivals_order:String(order._id),rivals_player:String(order.playerId),rivals_environment:'sandbox'},expires_at:new Date(Date.now()+3600000).toISOString(),created_at:new Date().toISOString()};
      checkouts.set(checkout_id,remote);if(this.unknownWrite)throw new Error('private provider timeout with sensitive content');return remote;
    },
    async recoverCheckout(order){return [...checkouts.values()].find(c=>c.reference===String(order._id))||null;},
    async checkout(id){if(this.failRead)throw new Error('secret provider response');return structuredClone(checkouts.get(id));},
    async payment(id){if(this.failRead)throw new Error('secret provider response');return structuredClone(payments.get(id));},
    paid(order,overrides={}){
      const checkout=this.checkouts.get('chk_'+order.id),payment={payment_id:'pay_'+order.id,checkout_id:checkout.checkout_id,reference:order.id,status:'succeeded',amount:checkout.amount,amount_paid:checkout.amount,amount_remaining:'0.00',currency:'USD',...overrides};
      payments.set(payment.payment_id,payment);Object.assign(checkout,{status:'completed',payment_status:'succeeded',charge:structuredClone(payment)});return payment;
    },
  };
}
test('custom support is verified exactly once and never grants gameplay inventory',async()=>{
  const user=await player(),key=randomUUID(),order=await service.checkout(user._id,'support',key,1234);
  assert.equal(order.cents,1234);assert.equal(order.name,'SUPPORT THE DEVELOPER');assert.equal(provider.calls,1);
  assert.equal((await service.checkout(user._id,'support',key,1234)).id,order.id);
  await assert.rejects(service.checkout(user._id,'support',key,999),e=>e.code==='idempotency_key_conflict');
  provider.paid(order);await Promise.all([service.reconcile(user._id,order.id),service.reconcile(user._id,order.id)]);
  const saved=await StoreOrder.findById(order.id);assert.equal(saved.status,'fulfilled');
  const account=await StoreInventory.findOne({playerId:user._id});assert.deepEqual(account.ownedIds.toObject(),[]);assert.equal(account.grenades,5);
  assert.equal(await StoreLedger.countDocuments({key:'grant:'+order.id}),1);
  assert.ok((await service.snapshot(user._id)).purchases.some(p=>p.id===order.id));
});
test('support amount validation and fixed-price tampering are rejected before contacting Bachs',async()=>{
  const user=await player();
  for(const amount of [undefined,0,-1,1.5,1000001,NaN])await assert.rejects(service.checkout(user._id,'support',randomUUID(),amount),e=>e.code==='invalid_request');
  assert.equal((await api(user,'/api/payments/checkout',{sku:'mp5',amountCents:1})).status,400);
  assert.equal((await api(user,'/api/payments/checkout',{sku:'support'})).status,400);assert.equal(provider.calls,0);
});
test('ten-minute abandoned orders leave player history without deleting payment audit evidence',async()=>{
  const user=await player(),order=await service.checkout(user._id,'mp5',randomUUID());
  await StoreOrder.collection.updateOne({_id:new mongoose.Types.ObjectId(order.id)},{$set:{createdAt:new Date(Date.now()-601000)}});
  assert.equal((await service.snapshot(user._id)).purchases.length,0);assert.equal(await StoreOrder.countDocuments({_id:order.id}),1);
  assert.equal((await service.reconcile(user._id,order.id)).checkoutUrl,null);
  // A browser clock cannot release a provider session that remains open.
  await assert.rejects(service.checkout(user._id,'mp5',randomUUID()),e=>e.code==='purchase_already_pending');
  provider.checkouts.get('chk_'+order.id).status='expired';const next=await service.checkout(user._id,'mp5',randomUUID());
  assert.notEqual(next.id,order.id);assert.equal(await StorePurchaseLock.countDocuments({orderId:next.id}),1);
});
test('a late verified payment is preserved and credited even after its checkout disappears from history',async()=>{
  const user=await player(),order=await service.checkout(user._id,'support',randomUUID(),500);
  await StoreOrder.collection.updateOne({_id:new mongoose.Types.ObjectId(order.id)},{$set:{createdAt:new Date(Date.now()-601000)}});
  assert.equal((await service.snapshot(user._id)).purchases.length,0);provider.paid(order);
  await service.reconcile(user._id,order.id);const snapshot=await service.snapshot(user._id);
  assert.equal(snapshot.purchases.length,1);assert.equal(snapshot.purchases[0].status,'fulfilled');
});
before(async()=>{
  const binary=fileURLToPath(new URL('../.cache/test-mongodb/mongod.exe',import.meta.url));
  mongo=await MongoMemoryReplSet.create({binary:{version:'7.0.24',...(process.platform==='win32'&&existsSync(binary)?{systemBinary:binary}:{})},replSet:{count:1,storageEngine:'wiredTiger'},instanceOpts:[{ip:'127.0.0.1'}]});
  await mongoose.connect(mongo.getUri(),{dbName:'isolated-bachs-payments-only'});
},{timeout:240000});
beforeEach(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();
  for(const model of Object.values(mongoose.models)){await model.createCollection();await model.createIndexes();}
  provider=fakeProvider();service=createPaymentService(provider);
  server=createApp(()=>true,{paymentProvider:provider,bachsWebhookLogger:()=>{}}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();await mongo?.stop();});
const player=()=>{const id=++serial;return User.create({wallet:'0x'+id.toString(16).padStart(40,'0'),referralCode:'pay-'+id});};
async function api(user,path,body,method='POST',key=randomUUID(),headers={}){
    const response=await fetch(origin+path,{method,headers:{'content-type':'application/json','x-rivals-payments':'1','x-rivals-store-version':'2','idempotency-key':key,...(user?{cookie:'bd_session='+signSession(user.wallet)}:{}),...headers},...(method!=='GET'?{body:JSON.stringify(body??{})}:{})});
  return {status:response.status,body:await response.json()};
}
const checkout=(user,sku='mp5',key=randomUUID())=>api(user,'/api/payments/checkout',{sku},'POST',key);
async function webhook(order,type='collection.succeeded',eventId='evt_'+randomUUID()){
  const raw=JSON.stringify({id:eventId,type,created_at:new Date().toISOString(),organization_id:'acct_test',data:{checkout_id:'chk_'+order.id,charge_id:'pay_'+order.id,reference:order.id}});
  const timestamp=Math.floor(Date.now()/1000),signature=createHmac('sha256',env.bachsWebhookSecret).update(timestamp+'.'+raw).digest('hex');
  const response=await fetch(origin+'/api/payments/bachs/webhook',{method:'POST',headers:{'content-type':'application/json','x-bachs-signature-v2':`t=${timestamp},v1=${signature}`},body:raw});return {status:response.status,body:await response.json()};
}
test('authenticated checkout → independently verified webhook → durable ownership → equip → history',async()=>{
  const user=await player(),order=(await checkout(user)).body;assert.equal(order.cents,300);assert.equal(order.status,'pending');
  assert.deepEqual((await inventory(user._id)).ownedIds.toObject(),[]);
  provider.paid(order);assert.equal((await webhook(order)).status,200);
  const snapshot=(await api(user,'/api/payments/store',undefined,'GET')).body;
  assert.deepEqual(snapshot.ownedIds,['mp5']);assert.equal(snapshot.purchases[0].status,'fulfilled');assert.equal(snapshot.grenadeBalance,5);
  assert.equal((await api(user,'/api/payments/equipment',{sku:'mp5'},'PUT')).status,200);
  assert.deepEqual((await service.snapshot(user._id)).equippedIds,['mp5']);assert.equal(await StoreLedger.countDocuments({kind:'grant'}),1);
});
test('replayed and concurrent webhooks across app instances grant a pack exactly once',async()=>{
  const user=await player(),order=(await checkout(user,'grenades-20')).body;provider.paid(order);
  const results=await Promise.all(Array.from({length:12},()=>webhook(order,'collection.succeeded','evt_repeat')));
  assert(results.every(r=>r.status===200));assert.equal((await inventory(user._id)).grenades,25);assert.equal(await StoreLedger.countDocuments({key:'grant:'+order.id}),1);
  const second=createPaymentService(provider);await second.reconcile(user._id,order.id);assert.equal((await inventory(user._id)).grenades,25);
});
test('checkout completed without a paid charge and forged redirects grant nothing',async()=>{
  const user=await player(),order=(await checkout(user)).body;provider.checkouts.get('chk_'+order.id).status='completed';
  assert.equal((await webhook(order,'checkout.completed')).status,200);assert.equal((await inventory(user._id)).ownedIds.length,0);
  assert.equal((await api(user,'/api/payments/orders/'+order.id+'/check',{paid:true})).status,400);
});
test('authentication, origin, CSRF, admin authorization, ownership and strict prices fail closed',async()=>{
  const user=await player(),other=await player(),order=(await checkout(user)).body;
  assert.equal((await checkout(null)).status,401);
  assert.equal((await api(user,'/api/payments/checkout',{sku:'mp5',cents:1})).status,400);
  assert.equal((await api(user,'/api/payments/checkout',{sku:'mp5'},'POST',randomUUID(),{'x-rivals-payments':''})).status,403);
  assert.equal((await api(user,'/api/payments/checkout',{sku:'mp5'},'POST',randomUUID(),{origin:'https://evil.invalid'})).status,403);
  assert.equal((await api(other,'/api/payments/orders/'+order.id,undefined,'GET')).status,404);
  assert.equal((await api(other,'/api/payments/equipment',{sku:'elite'},'PUT')).status,409);
  assert.equal((await api(user,'/api/admin/payments/orders',undefined,'GET')).status,401);
  assert.equal((await api(user,'/api/payments/verify',{paid:true})).status,404);
});
test('idempotency survives retries, conflicts and concurrent permanent-item requests',async()=>{
  const user=await player(),key=randomUUID(),first=await checkout(user,'mp5',key),again=await checkout(user,'mp5',key);
  assert.equal(first.body.id,again.body.id);assert.equal(provider.calls,1);
  assert.equal((await checkout(user,'m4a1',key)).status,409);
  const results=await Promise.all(Array.from({length:8},()=>checkout(user,'m4a1')));
  assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(await StoreOrder.countDocuments({sku:'m4a1'}),1);
});
test('an expired initialization lease cannot later issue another provider checkout',async()=>{
  const user=await player(),key=randomUUID();let release,entered;
  const waiting=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});let calls=0;
  provider.product=async()=>{if(++calls===1){entered();await gate;}return 'prod_mp5';};
  const first=service.checkout(user._id,'mp5',key);await waiting;
  await StoreOrder.updateOne({playerId:user._id,key},{$set:{leaseUntil:new Date(Date.now()-1)}});
  const second=await createPaymentService(provider).checkout(user._id,'mp5',key);release();const prior=await first;
  assert.equal(second.id,prior.id);assert.equal(provider.calls,1);assert.equal(prior.status,'pending');
});
test('an uncertain checkout write is looked up, not blindly sent again',async()=>{
  const user=await player(),key=randomUUID();provider.unknownWrite=true;
  const first=(await checkout(user,'mp5',key)).body;assert.equal(first.status,'initializing');assert.equal(provider.calls,1);
  const second=(await checkout(user,'mp5',key)).body;assert.equal(second.id,first.id);assert.equal(provider.calls,1);assert.equal(second.status,'verification_pending');
  provider.paid(second);await service.reconcile(user._id,second.id);assert.deepEqual((await service.snapshot(user._id)).ownedIds,['mp5']);
});
test('unknown unlocatable writes remain unresolved without another provider write',async()=>{
  const user=await player(),key=randomUUID();provider.unknownWrite=true;
  const first=(await checkout(user,'mp5',key)).body;provider.checkouts.clear();
  const second=(await checkout(user,'mp5',key)).body;assert.equal(second.status,'initializing');assert.equal(provider.calls,1);assert.equal((await inventory(user._id)).ownedIds.length,0);
});
test('failed verification is sanitized, retryable, and paid fulfillment can recover without paying again',async()=>{
  const user=await player(),order=(await checkout(user)).body;provider.paid(order);provider.failRead=true;
  assert.equal((await webhook(order,'collection.succeeded','evt_retry')).status,503);assert.equal((await inventory(user._id)).ownedIds.length,0);
  provider.failRead=false;assert.equal((await webhook(order,'collection.succeeded','evt_retry')).status,200);assert.equal((await inventory(user._id)).ownedIds.length,1);
});
test('amount, currency, environment, reference and charge mismatches never deliver',async()=>{
  for(const mutate of [c=>{c.amount='0.01';},c=>{c.currency='NGN';},c=>{c.reference='other';},c=>{c.metadata.rivals_environment='production';},c=>{c.charge.amount='1.00';provider.payments.get(c.charge.payment_id).amount='1.00';}]){
    const user=await player(),order=(await checkout(user)).body;provider.paid(order);mutate(provider.checkouts.get('chk_'+order.id));
    await webhook(order);assert.equal((await inventory(user._id)).ownedIds.length,0);
  }
});
test('Bachs-converted billing uses provider-confirmed base price, linked charge and exact billing currency',async()=>{
  const user=await player(),order=(await checkout(user)).body;
  provider.paid(order,{amount:'4500.123456',amount_paid:'4500.123456',currency:'NGN'});provider.checkouts.get('chk_'+order.id).billing_currency='USD';
  assert.equal((await webhook(order)).status,200);assert.equal((await inventory(user._id)).ownedIds.length,1);
});
test('failure and expiration never grant; terminal unpaid checkout releases eligibility safely',async()=>{
  const user=await player(),order=(await checkout(user)).body;provider.paid(order,{status:'failed'});
  await webhook(order,'collection.failed');assert.equal((await inventory(user._id)).ownedIds.length,0);
  Object.assign(provider.checkouts.get('chk_'+order.id),{status:'expired',payment_status:'failed',charge:null});
  await webhook(order,'checkout.expired');assert.equal((await StoreOrder.findById(order.id)).status,'expired');
  assert.equal((await checkout(user)).status,200);
});
test('retired recovery is unavailable even with an old death cooldown and never contacts the payment provider',async()=>{
  const user=await player(),until=new Date(Date.now()+7200000);await MissionLife.create({playerId:user._id,deaths:3,recoveryUntil:until});
  const state=await service.snapshot(user._id);
  assert.equal(state.recoveryUntil,null);
  assert.equal(state.catalog.find(p=>p.id==='revive').enabled,false);
  assert.equal((await checkout(user,'revive')).body.error,'product_unavailable');
  assert.equal(provider.calls,0);assert.equal(await StoreOrder.countDocuments({playerId:user._id}),0);
});

test('payments for recovery checkouts opened before retirement retain their receipt for refund review without a new grant',async()=>{
  for(const changed of [{},{recoveryUntil:new Date(Date.now()-1)},{deaths:9}]){
    const user=await player(),until=new Date(Date.now()+7200000);
    await MissionLife.create({playerId:user._id,deaths:1,recoveryUntil:until});
    const legacy=await StoreOrder.create({playerId:user._id,key:randomUUID(),sku:'revive',name:'INSTANT RECOVERY',cents:200,kind:'recovery',version:2,environment:'sandbox',recoveryDeaths:1,recoveryUntil:until});
    const remote=await provider.createCheckout(legacy),order={id:String(legacy._id)};
    await StoreOrder.updateOne({_id:legacy._id},{$set:{checkoutId:remote.checkout_id,checkoutUrl:remote.checkout_url,status:'pending'}});
    assert.equal((await service.snapshot(user._id)).purchases.find(p=>p.id===order.id).checkoutUrl,null);
    if(Object.keys(changed).length)await MissionLife.updateOne({playerId:user._id},{$set:changed});
    provider.paid(order);await webhook(order);await webhook(order);
    const saved=await StoreOrder.findById(order.id);assert.equal(saved.status,'review');assert.equal(saved.issue,'recovery_service_retired_refund_required');
    assert.equal(saved.chargeId,'pay_'+order.id);assert.ok(saved.verifiedAt);
    assert.equal(await StoreLedger.countDocuments({key:'grant:'+order.id}),0);
  }
});
test('starter grenades are granted once and concurrent server reservations cannot overspend',async()=>{
  const user=await player();await Promise.all(Array.from({length:12},()=>inventory(user._id)));
  const mission=await MissionSession.create({playerId:user._id,missionId:'ember',configVersion:3,authority:true,authorityOwner:'test-server'});
  const results=await Promise.allSettled(Array.from({length:9},()=>reserveMissionGrenade(user._id,mission._id,'test-server')));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,5);assert.equal((await inventory(user._id)).grenades,0);assert.equal((await MissionSession.findById(mission._id)).grenadesSpent,5);
});
test('refunds revoke durable equipment; spent consumables never become negative; disputes block spending',async()=>{
  const user=await player(),order=(await checkout(user)).body;const payment=provider.paid(order);await webhook(order);await service.equip(user._id,'mp5');
  payment.status='refunded';provider.payments.set(payment.payment_id,payment);await webhook(order,'refund.paid');await service.reconcile(user._id,order.id);
  const state=await service.snapshot(user._id);assert.equal(state.grenadeBalance,5);assert.deepEqual(state.ownedIds,[]);assert.deepEqual(state.equippedIds,[]);assert.equal(state.spendingBlocked,true);
  const other=await player(),pack=(await checkout(other,'grenades-10')).body;provider.paid(pack);await webhook(pack);await StoreInventory.updateOne({playerId:other._id},{$set:{grenades:0}});await webhook(pack,'dispute.created');
  assert.equal((await inventory(other._id)).grenades,0);assert.equal((await checkout(other,'grenades-10')).status,409);
});
test('sandbox inventory cannot become production ownership or revenue',async()=>{
  const user=await player(),order=(await checkout(user)).body;provider.paid(order);await webhook(order);
  const production=createPaymentService({...provider,environment:'production'});const snapshot=await production.snapshot(user._id);
  assert.deepEqual(snapshot.ownedIds,[]);assert.deepEqual(snapshot.purchases,[]);assert.equal(snapshot.grenadeBalance,5);
  await assert.rejects(()=>production.reconcile(user._id,order.id),/payment_environment_changed/);
});
test('refund revocation ignores fulfilled purchases in the other payment environment',async()=>{
  const user=await player(),order=(await checkout(user)).body,payment=provider.paid(order);
  await webhook(order);await service.equip(user._id,'mp5');
  await StoreOrder.create({playerId:user._id,key:randomUUID(),sku:'mp5',version:1,name:'MP5',cents:300,kind:'weapon',environment:'production',status:'fulfilled'});
  await inventory(user._id,undefined,'production');
  await StoreInventory.updateOne({playerId:user._id,environment:'production'},{$set:{ownedIds:['mp5'],equippedWeapon:'mp5'}});
  payment.status='refunded';provider.payments.set(payment.payment_id,payment);await service.reconcile(user._id,order.id);
  const sandbox=await service.snapshot(user._id),production=await createPaymentService({...provider,environment:'production'}).snapshot(user._id);
  assert.deepEqual(sandbox.ownedIds,[]);assert.deepEqual(sandbox.equippedIds,[]);
  assert.deepEqual(production.ownedIds,['mp5']);assert.deepEqual(production.equippedIds,['mp5']);assert.equal(production.spendingBlocked,false);
});

test('an unconfigured season and unknown products cannot be sold',async()=>{
  const user=await player();assert.equal((await checkout(user,'pass')).body.error,'season_not_active');assert.equal((await checkout(user,'not-a-product')).body.error,'product_unavailable');assert.equal(provider.calls,0);
});
test('older clients cannot pay for collection types they cannot equip',async()=>{
  const user=await player(),headers={'x-rivals-store-version':''};
  const legacy=await api(user,'/api/payments/store',undefined,'GET',randomUUID(),headers);
  assert.equal(legacy.body.catalog.find(p=>p.id==='urban').enabled,false);assert.equal(legacy.body.catalog.find(p=>p.id==='mp5').enabled,true);
  assert.equal((await api(user,'/api/payments/checkout',{sku:'starter'},'POST',randomUUID(),headers)).body.error,'store_update_required');assert.equal(provider.calls,0);
  assert.equal((await checkout(user,'starter')).body.status,'pending');
});

test('every soldier outfit is delivered and selected with server-owned appearance',async()=>{
  const user=await player();
  for(const sku of ['urban','neon','shadow','cyber','crimson','golden','midnight','commander']){
    const order=(await checkout(user,sku)).body;assert.equal(order.status,'pending');assert.equal((await service.snapshot(user._id)).ownedIds.includes(sku),false);
    provider.paid(order);await webhook(order);assert.equal((await api(user,'/api/payments/equipment',{sku},'PUT')).status,200);
    assert.equal((await service.snapshot(user._id)).appearance.outfit,sku);await assert.rejects(()=>service.checkout(user._id,sku,randomUUID()),/already_owned/);
  }
  assert.equal((await api(user,'/api/payments/equipment',{sku:'urban',slot:'weapon'},'PUT')).status,409);
  assert.equal((await api(user,'/api/payments/equipment',{sku:null,slot:'outfit'},'PUT')).status,200);assert.equal((await service.snapshot(user._id)).appearance.outfit,null);
});

test('all four packs grant every promised item once and equip their distinct slots',async()=>{
  for(const [sku,expected]of [['starter',['urban','desert','salute']],['raider',['shadow','steel','celebration']],['warrior',['cyber','frost','trail','neon-celebrate']],['legend',['commander','protocol','pose','explosion']]]){
    const user=await player(),order=(await checkout(user,sku)).body;provider.paid(order);
    await Promise.all(Array.from({length:4},()=>webhook(order,'collection.succeeded','evt-pack-'+sku)));
    const state=await service.snapshot(user._id);for(const id of [sku,...expected])assert(state.ownedIds.includes(id));assert.equal(await StoreLedger.countDocuments({key:'grant:'+order.id}),1);
    await service.equip(user._id,sku);const equipped=await service.snapshot(user._id);for(const id of expected)assert(equipped.equippedIds.includes(id));
    assert.equal(equipped.appearance.outfit,expected[0]);assert.equal(equipped.appearance.finish,expected[1]);
  }
});

test('bundle grants are all-or-nothing on delivery failure and recover on the same order',async()=>{
  const user=await player(),order=(await checkout(user,'legend')).body;provider.paid(order);
  const original=StoreLedger.create;StoreLedger.create=async()=>{throw new Error('isolated bundle delivery rollback');};
  try{assert.equal((await webhook(order)).status,503);}finally{StoreLedger.create=original;}
  assert.deepEqual((await service.snapshot(user._id)).ownedIds,[]);assert.equal((await StoreOrder.findById(order.id)).status,'paid');
  await service.reconcile(user._id,order.id);assert.equal((await service.snapshot(user._id)).ownedIds.length,5);assert.equal(provider.calls,1);
});

test('refunded bundles revoke selections but preserve independently purchased included items',async()=>{
  const user=await player(),direct=(await checkout(user,'urban')).body;provider.paid(direct);await webhook(direct);
  const pack=(await checkout(user,'starter')).body,payment=provider.paid(pack);await webhook(pack);await service.equip(user._id,'starter');
  await StoreOrder.updateOne({_id:pack.id},{$set:{includes:['commander']}});assert.deepEqual((await StoreOrder.findById(pack.id)).includes.toObject(),['urban','desert','salute']);
  payment.status='refunded';provider.payments.set(payment.payment_id,payment);await service.reconcile(user._id,pack.id);
  const state=await service.snapshot(user._id);assert.deepEqual(state.ownedIds,['urban']);assert.equal(state.appearance.outfit,'urban');assert.equal(state.appearance.finish,null);assert.equal(state.appearance.emote,null);
});

test('founder delivery unlocks its actual uniform, victory presentation and profile identity',async()=>{
  const user=await player(),order=(await checkout(user,'founder')).body;provider.paid(order);await webhook(order);await service.equip(user._id,'founder');
  const state=await service.snapshot(user._id);assert.deepEqual(state.ownedIds,['founder','pose','extraction']);assert.equal(state.appearance.outfit,'founder');assert.equal(state.appearance.identity,'founder');assert.equal(state.appearance.emote,'pose');assert.equal(state.appearance.effect,'extraction');
});

test('all finishes and expressions have real ownership and isolated selection slots',async()=>{
  const user=await player();
  for(const sku of ['desert','pulse','steel','fire','frost','protocol','diamond','salute','celebration','dance','taunt','pose','trail','thunder','entrance','neon-celebrate','dissolve','extraction','explosion']){
    const order=await service.checkout(user._id,sku,randomUUID());assert.equal(order.status,'pending');provider.paid(order);await webhook(order);await service.equip(user._id,sku);
    assert((await service.snapshot(user._id)).equippedIds.includes(sku));
  }
  const state=await service.snapshot(user._id);assert.equal(state.appearance.trail,'trail');assert.equal(state.appearance.entrance,'entrance');assert.equal(state.appearance.effect,'explosion');
});

test('published seasons use verified wins, paid premium access and exactly-once reward claims',async()=>{
  const user=await player(),season=await publishSeason({_id:'season-a',name:'Real owner campaign',startsAt:new Date(Date.now()-60000),endsAt:new Date(Date.now()+86400000),free:[{id:'one',sku:'desert',wins:1}],premium:[{id:'one',sku:'cyber',wins:1}]},'test-owner');
  assert.equal((await service.snapshot(user._id)).catalog.find(p=>p.id==='pass').enabled,true);
  await assert.rejects(()=>claimReward(user._id,season.id,'free','one','sandbox'),/season_progress_required/);
  await assert.rejects(()=>claimReward(user._id,season.id,'premium','one','sandbox'),/premium_pass_required/);
  await MissionSession.create({playerId:user._id,missionId:'test',configVersion:3,status:'verified_success',authority:true,integrity:'verified',endedAt:new Date()});
  await Promise.all(Array.from({length:6},()=>claimReward(user._id,season.id,'free','one','sandbox')));
  const order=(await checkout(user,'pass')).body;provider.paid(order);await webhook(order);await claimReward(user._id,season.id,'premium','one','sandbox');
  const state=await service.snapshot(user._id);assert.equal(state.season.wins,1);assert.equal(state.season.hasPass,true);assert(state.ownedIds.includes('cyber'));assert.equal(await StoreSeasonClaim.countDocuments({playerId:user._id}),2);
  assert.equal((await api(user,'/api/payments/season/claim',{seasonId:season.id,track:'premium',rewardId:'one',wins:100})).status,400);
  await assert.rejects(()=>StoreSeason.updateOne({_id:season.id},{$set:{premium:[{id:'one',sku:'commander',wins:0}]}}),/immutable_season_terms/);
  await assert.rejects(()=>StoreSeason.updateOne({_id:season.id},{$set:{'premium.0.sku':'commander'}}),/immutable_season_terms/);assert.equal((await StoreSeason.findById(season.id)).premium[0].sku,'cyber');
  const payment=provider.payments.get('pay_'+order.id);payment.status='refunded';await service.reconcile(user._id,order.id);
  const revoked=await service.snapshot(user._id);assert(revoked.ownedIds.includes('desert'));assert(!revoked.ownedIds.includes('cyber'));assert.equal(revoked.season.hasPass,false);
  await assert.rejects(()=>claimReward(user._id,season.id,'premium','one','sandbox'),/payment_account_under_review/);
  await closeSeason(season.id,'test-owner');assert.equal((await service.snapshot(user._id)).season,null);
});

test('season administration is owner-only, strict and cannot overlap active publications',async()=>{
  const user=await player();assert.equal((await api(user,'/api/admin/payments/seasons',undefined,'GET')).status,401);
  const input={_id:'admin-season',name:'Campaign',startsAt:new Date(Date.now()-1000),endsAt:new Date(Date.now()+86400000),free:[{id:'one',sku:'desert',wins:1}],premium:[{id:'one',sku:'urban',wins:2}]};
  const token=jwt.sign({sub:'admin',role:'admin',email:env.adminEmail},env.jwtSecret,{issuer:'basedrop-admin',audience:'basedrop-admin',expiresIn:'1h',jwtid:randomUUID()});
  const {_id,...body}=input;const created=await api(null,'/api/admin/payments/seasons',{...body,startsAt:body.startsAt.toISOString(),endsAt:body.endsAt.toISOString()},'POST',randomUUID(),{cookie:'bd_admin='+token});assert.equal(created.status,201);
  await assert.rejects(()=>publishSeason({...input,_id:'other'},'test-owner'),/close_existing_season_first/);
  await assert.rejects(()=>publishSeason({...input,_id:'invalid',free:[{id:'one',sku:'pass',wins:1}]},'test-owner'),/invalid_season_reward/);
});

test('a closed season never substitutes an old pass for the next season or credits a late payment',async()=>{
  const user=await player(),input={_id:'season-old',name:'Owner campaign',startsAt:new Date(Date.now()-60000),endsAt:new Date(Date.now()+86400000),free:[{id:'one',sku:'desert',wins:1}],premium:[{id:'one',sku:'urban',wins:1}]};
  await publishSeason(input,'owner');const first=await service.checkout(user._id,'pass',randomUUID());provider.paid(first);await service.reconcile(user._id,first.id);
  await closeSeason(input._id,'owner');await publishSeason({...input,_id:'season-next'},'owner');assert.equal((await service.snapshot(user._id)).season.hasPass,false);assert(!(await service.snapshot(user._id)).ownedIds.includes('pass'));
  const next=await service.checkout(user._id,'pass',randomUUID());assert.notEqual(next.id,first.id);await closeSeason('season-next','owner');provider.paid(next);await service.reconcile(user._id,next.id);
  const saved=await StoreOrder.findById(next.id);assert.equal(saved.status,'review');assert.equal(saved.issue,'season_ended_refund_required');
});
test('a delivery transaction failure retains a paid order and retries one grant without another checkout',async()=>{
  const user=await player(),order=(await checkout(user,'grenades-10')).body;provider.paid(order);
  const original=StoreLedger.create;StoreLedger.create=async()=>{throw new Error('test delivery failure');};
  try{assert.equal((await webhook(order,'collection.succeeded','evt_paid_retry')).status,503);}finally{StoreLedger.create=original;}
  const saved=await StoreOrder.findById(order.id);assert.equal(saved.status,'paid');assert(saved.verifiedAt);assert.equal(saved.issue,'fulfillment_pending');
  assert.equal((await inventory(user._id)).grenades,5);
  assert.equal((await webhook(order,'collection.succeeded','evt_paid_retry')).status,200);assert.equal((await inventory(user._id)).grenades,15);assert.equal(provider.calls,1);
});
test('payment ledger and order terms are immutable through application operations',async()=>{
  const user=await player(),order=(await checkout(user)).body;provider.paid(order);await webhook(order);
  await assert.rejects(()=>StoreLedger.updateMany({},{$set:{quantity:999}}),/immutable_store_ledger/);
  await assert.rejects(()=>StoreLedger.deleteMany({}),/immutable_store_ledger/);
  await StoreOrder.updateOne({_id:order.id},{$set:{cents:1,sku:'elite'}});const saved=await StoreOrder.findById(order.id);assert.equal(saved.cents,300);assert.equal(saved.sku,'mp5');
});
test('admin revenue and recovery tools require the existing owner session and never accept manual paid',async()=>{
  const user=await player(),order=(await checkout(user)).body;
  const token=jwt.sign({sub:'admin',role:'admin',email:env.adminEmail},env.jwtSecret,{issuer:'basedrop-admin',audience:'basedrop-admin',expiresIn:'1h',jwtid:randomUUID()});
  const headers={cookie:'bd_admin='+token};
  const summary=await api(null,'/api/admin/payments/orders',undefined,'GET',randomUUID(),headers);
  assert.equal(summary.status,200);assert.equal(summary.body.items[0].id,order.id);assert.equal(summary.body.totals[0]._id.environment,'sandbox');
  assert.equal((await api(null,'/api/admin/payments/orders/'+order.id+'/paid',{paid:true},'POST',randomUUID(),headers)).status,404);
  assert.equal((await api(null,'/api/admin/payments/orders/'+order.id+'/reconcile',{paid:true},'POST',randomUUID(),headers)).status,400);
});
