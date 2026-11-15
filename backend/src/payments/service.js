import mongoose from 'mongoose';
import {StoreOrder,StoreInventory,StoreLedger,StorePurchaseLock,StoreProduct} from './storeModels.js';
import {MissionLife,MissionSession,MissionRecoveryEntitlement} from '../missions/models.js';
import {getProduct,CATALOG_VERSION,exactDecimal,usd,paymentCatalog} from './catalog.js';
import {safeCheckoutUrl,logProviderFailure} from './provider.js';
import {env} from '../config/env.js';
export const storeEnvironment=()=>env.bachsApiKey?.startsWith('sk_sandbox_')?'sandbox':'production';

export const fail=(code,status=409)=>{throw Object.assign(new Error(code),{code,status});};
export async function transaction(work) {
  const session=await mongoose.startSession();try {return await session.withTransaction(()=>work(session),{
    readConcern:{level:'snapshot'},writeConcern:{w:'majority',j:true,wtimeoutMS:5000},readPreference:'primary',
  });}finally{await session.endSession();}
}
export async function inventory(playerId,session,environment=storeEnvironment()) {
  // Existing accounts receive the once-only migration grant too; never trust local ownership.
  try{return await StoreInventory.findOneAndUpdate({playerId,environment},{$setOnInsert:{playerId,environment,grenades:5,starterGrantedAt:new Date()}},{upsert:true,new:true,session});}
  catch(e){if(e.code===11000&&!session)return StoreInventory.findOne({playerId,environment});throw e;}
}
const lockKey=(order)=>`${order.environment}:${order.playerId}:${order.kind==='recovery'?'recovery-'+order.recoveryDeaths:order.sku}`;
const locked=order=>['weapon','character','finish','effect','bundle','season','founder','recovery'].includes(order.kind);
const terminal=['fulfilled','review','refund_review','refunded','disputed'];
export function publicOrder(order) {
  return {id:String(order._id),sku:order.sku,name:order.name,cents:order.cents,currency:order.currency,environment:order.environment,
    status:order.status,checkoutUrl:['pending','verification_pending','failed'].includes(order.status)?order.checkoutUrl:null,
    createdAt:order.createdAt,fulfilledAt:order.fulfilledAt,issue:order.issue,chargedAmount:order.chargedAmount,chargedCurrency:order.chargedCurrency};
}
export function createPaymentService(provider) {
  const configured=()=>{if(!provider)fail('payments_not_configured',503);};
  async function ownedOrder(playerId,id){const order=await StoreOrder.findOne({_id:id,playerId});if(!order)fail('order_not_found',404);return order;}
  async function checkout(playerId,sku,key) {
    configured();const product=getProduct(sku);if(!product?.enabled)fail('product_unavailable');
    let order=await StoreOrder.findOne({playerId,key});
    if(order&&order.sku!==sku)fail('idempotency_key_conflict');
    if(!order) {
      try {order=await transaction(async session=>{
        const account=await inventory(playerId,session,provider.environment);if(account.spendingBlocked)fail('payment_account_under_review');
        if(account.ownedIds.includes(sku)&&product.kind!=='grenades')fail('already_owned');
        let life;
        if(product.kind==='recovery'){
          life=await MissionLife.findOne({playerId,recoveryUntil:{$gt:new Date()}}).session(session);
          if(!life)fail('recovery_not_active');
        }
        const [created]=await StoreOrder.create([{playerId,sku,key,name:product.name,cents:product.cents,kind:product.kind,quantity:product.quantity||1,
          includes:product.includes||[],version:CATALOG_VERSION,environment:provider.environment,recoveryDeaths:life?.deaths,recoveryUntil:life?.recoveryUntil}],{session});
        if(locked(created))await StorePurchaseLock.create([{_id:lockKey(created),orderId:created._id}],{session});
        return created;
      });}catch(e){if(e.code!==11000)throw e;order=await StoreOrder.findOne({playerId,key});if(!order)fail('purchase_already_pending');}
    }
    if(order.environment!==provider.environment)fail('payment_environment_changed');
    if(order.checkoutId||order.status!=='initializing')return publicOrder(order);
    if(order.checkoutAttemptedAt){
      const recovered=provider.recoverCheckout?await provider.recoverCheckout(order):null;
      if(recovered?.checkout_id&&recovered.reference===String(order._id)&&recovered.metadata?.rivals_order===String(order._id)){
        await StoreOrder.updateOne({_id:order._id,status:'initializing'},{$set:{checkoutId:recovered.checkout_id,status:'verification_pending',issue:null}});
      }
      return publicOrder(await ownedOrder(playerId,order._id));
    }
    // Cross-instance lease. Uncertain checkout writes take the read-only recovery
    // path above, never a blind replay after Bachs's idempotency cache expires.
    const claim=await StoreOrder.findOneAndUpdate({_id:order._id,status:'initializing',$or:[{leaseUntil:null},{leaseUntil:{$lt:new Date()}}]},
      {$set:{leaseUntil:new Date(Date.now()+45000)},$inc:{attempts:1}},{new:true});
    if(!claim)return publicOrder(order);
    let stage='initialize_product';
    try {
      const productId=await provider.product(product);
      stage='initialize_checkout';
      const permission=await StoreOrder.updateOne({_id:order._id,status:'initializing',attempts:claim.attempts,
        leaseUntil:{$gt:new Date()},checkoutAttemptedAt:{$exists:false}},{$set:{productId,checkoutAttemptedAt:new Date()}});
      if(!permission.modifiedCount)return publicOrder(await ownedOrder(playerId,order._id));
      const remote=await provider.createCheckout(order,productId),url=safeCheckoutUrl(remote.checkout_url);
      if(typeof remote.checkout_id!=='string'||!url)throw new Error('invalid_provider_checkout');
      await StoreOrder.updateOne({_id:order._id,status:'initializing'},{$set:{checkoutId:remote.checkout_id,checkoutUrl:url,status:'pending',expiresAt:new Date(remote.expires_at),leaseUntil:null,issue:null}});
    }catch(error) {
      logProviderFailure(stage,error);
      // Includes unknown write outcomes and validation errors; never claim a charge
      // failed or release the permanent-item lock on an uncertain provider write.
      await StoreOrder.updateOne({_id:order._id,status:'initializing',attempts:claim.attempts},{$set:{leaseUntil:null,issue:'checkout_initialization_unconfirmed'}});
    }
    return publicOrder(await ownedOrder(playerId,order._id));
  }
  async function reverse(order,status,issue) {
    await transaction(async session=>{
      const current=await StoreOrder.findById(order._id).session(session);if(!current)return;
      if(current.status==='refunded'&&status!=='refunded')return;
      const already=current.status===status&&current.issue===issue;
      current.status=status;current.issue=issue;await current.save({session});
      const account=await inventory(current.playerId,session,current.environment);
      // Consumables/recovery cannot safely be undone. Freeze further spending for
      // reconciliation, never subtract spent grenades or resurrect another death.
      account.spendingBlocked=true;
      if(current.kind==='weapon'&&status==='refunded'){
        const other=await StoreOrder.exists({playerId:current.playerId,sku:current.sku,status:'fulfilled',_id:{$ne:current._id}}).session(session);
        if(!other){account.ownedIds=account.ownedIds.filter(id=>id!==current.sku);if(account.equippedWeapon===current.sku)account.equippedWeapon=null;}
      }
      account.version++;await account.save({session});
      if(!already)await StoreLedger.create([{key:`reversal:${current._id}:${status}:${issue}`,playerId:current.playerId,orderId:current._id,kind:'reversal',sku:current.sku,detail:issue}],{session});
    });
  }
  async function fulfill(order,payment) {
    await transaction(async session=>{
      const current=await StoreOrder.findById(order._id).session(session);
      if(terminal.includes(current.status))return;
      // The unique charge index plus the order-keyed grant protect every replay.
      current.chargeId=payment.payment_id;current.verifiedAt=new Date();current.chargedAmount=payment.amount;current.chargedCurrency=payment.currency;
      const account=await inventory(current.playerId,session,current.environment);
      if(account.spendingBlocked){current.status='review';current.issue='payment_account_under_review';await current.save({session});return;}
      if(current.kind==='recovery'){
        const life=await MissionLife.findOneAndUpdate({playerId:current.playerId,deaths:current.recoveryDeaths,recoveryUntil:current.recoveryUntil,
          $and:[{recoveryUntil:{$gt:new Date()}}]},{$set:{recoveryUntil:null},$inc:{admissionVersion:1}},{session,new:true});
        if(!life){current.status='review';current.issue='recovery_expired_or_changed_refund_required';await current.save({session});return;}
        await MissionRecoveryEntitlement.create([{playerId:current.playerId,providerReference:`bachs:${current.environment}:${payment.payment_id}`,status:'consumed',
          verifiedAt:new Date(),consumedAt:new Date(),expiresAt:current.recoveryUntil}],{session});
      }else if(current.kind==='grenades'){
        if(account.grenades+current.quantity>1000000){current.status='review';current.issue='inventory_limit_refund_required';await current.save({session});return;}
        account.grenades+=current.quantity;
      }else if(current.kind==='weapon'){
        if(!account.ownedIds.includes(current.sku))account.ownedIds.push(current.sku);
      }else fail('fulfillment_not_implemented'); // Disabled SKUs cannot be sold by accident.
      account.version++;await account.save({session});
      await StoreLedger.create([{key:`grant:${current._id}`,playerId:current.playerId,orderId:current._id,kind:'grant',sku:current.sku,quantity:current.quantity,cents:current.cents}],{session});
      current.status='fulfilled';current.fulfilledAt=new Date();current.issue=null;await current.save({session});
    });
  }
  async function reconcile(playerId,id) {
    configured();let order=await ownedOrder(playerId,id);
    if(order.environment!==provider.environment)fail('payment_environment_changed');
    if(!order.checkoutId){if(order.status==='initializing')return checkout(playerId,order.sku,order.key);return publicOrder(order);}
    if(order.status==='disputed')return publicOrder(order);
    let verifiedPaid=false;
    try {
      const remote=await provider.checkout(order.checkoutId);
      if(remote.checkout_id!==order.checkoutId||remote.reference!==String(order._id)||remote.metadata?.rivals_player!==String(playerId)||
        remote.metadata?.rivals_order!==String(order._id)||remote.metadata?.rivals_environment!==order.environment||
        remote.currency!==order.currency||exactDecimal(remote.amount)!==exactDecimal(usd(order.cents))) {
        await StoreOrder.updateOne({_id:id},{$set:{status:'review',issue:'provider_order_mismatch'}});return publicOrder(await ownedOrder(playerId,id));
      }
      const chargeId=remote.charge?.payment_id;
      if(chargeId){
        // A signed success webhook and checkout redirect are hints, never proof.
        const payment=await provider.payment(chargeId);
        if(payment.payment_id!==chargeId||payment.checkout_id!==order.checkoutId||payment.reference!==String(order._id)||
          payment.currency!==remote.charge.currency||exactDecimal(payment.amount)===null||exactDecimal(payment.amount)!==exactDecimal(remote.charge.amount)||
          (payment.currency===order.currency&&exactDecimal(payment.amount)!==exactDecimal(usd(order.cents))))fail('provider_payment_mismatch');
        // Bachs sandbox can retain billing_currency=USD after a successful NGN
        // charge. It is a selection hint, not proof of what was collected.
        // The exact USD base price above and BOTH independently fetched charge
        // amounts/currencies must match; never guess an FX conversion.
        if(['refunded','auto_refunded'].includes(payment.status))await reverse(order,'refunded','provider_refunded');
        else if(payment.status==='partially_refunded')await reverse(order,'refund_review','provider_partially_refunded');
        else if(payment.status==='succeeded'&&remote.payment_status==='succeeded'&&remote.status==='completed'&&
          (payment.amount_remaining==null||exactDecimal(payment.amount_remaining)===0n)&&
          (payment.amount_paid==null||exactDecimal(payment.amount_paid)===exactDecimal(payment.amount))){
          // Preserve payment evidence independently of delivery. A transaction
          // failure must leave a PAID, retryable order, not an apparently unpaid one.
          await StoreOrder.updateOne({_id:id,status:{$nin:terminal}},{$set:{status:'paid',chargeId:payment.payment_id,verifiedAt:new Date(),chargedAmount:payment.amount,chargedCurrency:payment.currency}}, {writeConcern:{w:'majority',j:true,wtimeout:5000}});
          verifiedPaid=true;await fulfill(order,payment);
        }
        else if(!terminal.includes(order.status))await StoreOrder.updateOne({_id:id,status:{$nin:terminal}},{$set:{status:payment.status==='failed'?'failed':'verification_pending',issue:null}});
      }else if(['expired','cancelled'].includes(remote.status)&&!terminal.includes(order.status)){
        await transaction(async session=>{
          await StoreOrder.updateOne({_id:id,status:{$nin:terminal}},{$set:{status:remote.status,issue:null}},{session});
          await StorePurchaseLock.deleteOne({_id:lockKey(order),orderId:order._id},{session});
        });
      }
      await StoreOrder.updateOne({_id:id},{$set:{lastCheckedAt:new Date()}});
    }catch(error) {
      logProviderFailure('verify_payment',error);
      await StoreOrder.updateOne({_id:id,status:{$nin:terminal}},{$set:{issue:verifiedPaid?'fulfillment_pending':'verification_unconfirmed'}});
      // Retryable error: provider retries deliveries; players can check same order.
      fail('verification_unconfirmed',503);
    }
    return publicOrder(await ownedOrder(playerId,id));
  }
  async function event(event) {
    if(!provider)return;
    if(!['collection.succeeded','collection.failed','checkout.completed','checkout.expired','refund.created','refund.paid','refund.failed','dispute.created','dispute.updated'].includes(event.type))return;
    const data=event.data||{};
    let order=typeof data.checkout_id==='string'?await StoreOrder.findOne({checkoutId:data.checkout_id}):null;
    if(!order&&typeof data.charge_id==='string')order=await StoreOrder.findOne({$or:[{chargeId:data.charge_id},{providerChargeId:data.charge_id}]});
    if(!order&&typeof data.payment_id==='string')order=await StoreOrder.findOne({chargeId:data.payment_id});
    if(!order&&typeof data.reference==='string'&&mongoose.isValidObjectId(data.reference)&&typeof data.checkout_id==='string'){
      const candidate=await StoreOrder.findOne({_id:data.reference,checkoutAttemptedAt:{$ne:null},environment:provider.environment});
      if(candidate&&!candidate.checkoutId){await attachCheckout(candidate.playerId,candidate._id,data.checkout_id);order=await StoreOrder.findById(candidate._id);}
    }
    // Unrelated, test-tool and historical payments never mint entitlements.
    if(!order)return;
    if(order.environment!==provider.environment)fail('payment_environment_changed',503);
    const product=order.productId&&await StoreProduct.findOne({productId:order.productId}).lean();
    if(product?.organizationId&&product.organizationId!==event.organization_id)fail('webhook_organization_mismatch',503);
    if(event.type==='collection.succeeded'&&typeof data.charge_id==='string'&&data.charge_id.length<=256){
      await StoreOrder.updateOne({_id:order._id,providerChargeId:{$exists:false}},{$set:{providerChargeId:data.charge_id}});
    }
    if(event.type.startsWith('refund.')||event.type.startsWith('dispute.')){
      // A genuine signed adverse event immediately blocks fulfillment/spending.
      // It is retained for human reconciliation even if the provider GET lags.
      await reverse(order,event.type.startsWith('dispute.')?'disputed':'refund_review',event.type);
      return {linked:true};
    }
    await reconcile(order.playerId,order._id);return {linked:true};
  }
  async function equip(playerId,sku) {
    return transaction(async session=>{
      if(await MissionSession.exists({playerId,status:'active'}).session(session))fail('finish_mission_before_equipping');
      const account=await inventory(playerId,session,provider?.environment??storeEnvironment());
      if(sku!==null&&(!account.ownedIds.includes(sku)||getProduct(sku)?.kind!=='weapon'))fail('item_not_owned');
      if(account.spendingBlocked)fail('payment_account_under_review');
      account.equippedWeapon=sku;account.version++;await account.save({session});return {equippedWeapon:sku};
    });
  }
  async function attachCheckout(playerId,id,checkoutId){
    configured();const order=await ownedOrder(playerId,id);
    if(order.environment!==provider.environment)fail('payment_environment_changed');
    if(order.checkoutId&&order.checkoutId!==checkoutId)fail('checkout_already_linked');
    const remote=await provider.checkout(checkoutId);
    if(remote.checkout_id!==checkoutId||remote.reference!==String(id)||remote.metadata?.rivals_order!==String(id)||
      remote.metadata?.rivals_player!==String(playerId)||remote.metadata?.rivals_environment!==order.environment||
      remote.currency!=='USD'||exactDecimal(remote.amount)!==exactDecimal(usd(order.cents)))fail('provider_order_mismatch');
    await StoreOrder.updateOne({_id:id,checkoutId:{$exists:false}},{$set:{checkoutId,status:'verification_pending',issue:null}});
    return reconcile(playerId,id);
  }
  async function snapshot(playerId){
    const environment=provider?.environment??storeEnvironment();
    const account=await inventory(playerId,undefined,environment),life=await MissionLife.findOne({playerId}).lean();
    const orders=await StoreOrder.find({playerId,environment}).sort({_id:-1}).limit(100).lean();
    return {ownedIds:account.ownedIds,equippedIds:account.equippedWeapon?[account.equippedWeapon]:[],grenadeBalance:account.grenades,
      recoveryUntil:life?.recoveryUntil??null,serverTime:new Date(),spendingBlocked:account.spendingBlocked,
      purchases:orders.map(publicOrder),catalog:paymentCatalog,configured:Boolean(provider),environment:provider?.environment??null};
  }
  return {checkout,reconcile,event,equip,snapshot,ownedOrder,reverse,attachCheckout};
}

// Called BEFORE the authoritative simulation accepts a grenade action. The
// reservation is durable before any damage; crashes never restore spent stock.
export async function reserveMissionGrenade(playerId,sessionId,owner) {
  return transaction(async session=>{
    const mission=await MissionSession.findOne({_id:sessionId,playerId,status:'active',authorityOwner:owner}).session(session);
    if(!mission)fail('mission_not_active');
    const account=await StoreInventory.findOneAndUpdate({playerId,environment:storeEnvironment(),grenades:{$gt:0},spendingBlocked:false},{$inc:{grenades:-1,version:1}},{session,new:true});
    if(!account)fail('no_grenades_remaining');
    mission.grenadesSpent++;await mission.save({session});
    await StoreLedger.create([{key:`grenade:${sessionId}:${mission.grenadesSpent}`,playerId,kind:'grenade_spent',quantity:1}],{session});
    return {balance:account.grenades,spent:mission.grenadesSpent};
  });
}
export async function creditMissionGrenades(playerId,sessionId,eventId,amount) {
  if(!Number.isSafeInteger(amount)||amount<1||amount>100)fail('invalid_grenade_credit');
  return transaction(async session=>{
    const key=`pickup:${sessionId}:${eventId}`;
    if(await StoreLedger.exists({key}).session(session))return;
    await StoreInventory.updateOne({playerId,environment:storeEnvironment(),grenades:{$lte:1000000-amount}},{$inc:{grenades:amount,version:1}},{session});
    await StoreLedger.create([{key,playerId,kind:'grant',sku:'field-grenade',quantity:amount}],{session});
  });
}
