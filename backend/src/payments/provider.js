import {Bachs} from '@bachs/sdk';
import {env} from '../config/env.js';
import {StoreProduct} from './storeModels.js';
import {usd,CATALOG_VERSION,exactDecimal} from './catalog.js';
export function logProviderFailure(operation,error){
  // Deliberately omit message/stack/body/headers/URLs and raw field errors.
  const code=typeof error?.errorCode==='string'&&/^[A-Z_0-9-]{1,80}$/.test(error.errorCode)?error.errorCode:undefined;
  const fields=(error?.fieldErrors??[]).map(field=>Array.isArray(field?.loc)?field.loc.join('.'):field?.field??field?.path).filter(field=>typeof field==='string'&&/^[a-zA-Z_.0-9]{1,100}$/.test(field));
  console.warn('[bachs-operation]',JSON.stringify({operation,code,fields,status:Number.isInteger(error?.statusCode)?error.statusCode:undefined,unknown:error?.outcomeUnknown===true,type:['BachsApiError','BachsNetworkError','BachsTimeoutError','BachsResponseError'].includes(error?.constructor?.name)?error.constructor.name:'operation_failed'}));
}

export function createBachsProvider() {
  if(!env.bachsApiKey||!env.bachsWebhookSecret)return null;
  if(!/^sk_(sandbox|live)_/.test(env.bachsApiKey))throw new Error('bachs_invalid_key_prefix');
  const environment=env.bachsApiKey.startsWith('sk_sandbox_')?'sandbox':'production';
  const client=new Bachs({apiKey:env.bachsApiKey,environment,timeoutMs:15000,maxRetries:1,logLevel:'off'});
  return {environment,
    async product(product) {
      const key=`rivals:${environment}:v${CATALOG_VERSION}:${product.id}:${product.cents}`;
      const cached=await StoreProduct.findById(key).lean();if(cached?.productId)return cached.productId;
      // Before any retry, look up the original operation by its stable metadata.
      // Bachs only caches successful idempotency responses for 24h; a timeout
      // alone is never permission to repeat an uncertain write.
      let count=0;
      for await(const existing of client.products.listAll({limit:100})){
        if(++count>1000)throw new Error('product_reconciliation_required');
        if(existing.metadata?.rivals_sku===product.id&&existing.metadata?.rivals_catalog===CATALOG_VERSION&&existing.price.currency==='USD'&&exactDecimal(existing.price.amount)===exactDecimal(usd(product.cents))){
          await StoreProduct.updateOne({_id:key},{$set:{productId:existing.id,organizationId:existing.organization_id}},{upsert:true});return existing.id;
        }
      }
      if(cached?.attemptedAt)throw new Error('product_initialization_unconfirmed');
      try{await StoreProduct.create({_id:key,attemptedAt:new Date()});}catch(e){if(e.code===11000)throw new Error('product_initialization_in_progress');throw e;}
      const remote=await client.products.create({name:product.name,price:{currency:'USD',amount:usd(product.cents)},metadata:{rivals_sku:product.id,rivals_catalog:CATALOG_VERSION}}, {idempotencyKey:key});
      await StoreProduct.updateOne({_id:key},{$set:{productId:remote.id,organizationId:remote.organization_id}});
      return remote.id;
    },
    createCheckout: (order,productId) => client.checkoutSessions.create({
      ...(order.kind==='support'?{pricing:{currency:'USD',price_type:'fixed',amount:usd(order.cents)}}:{product_cart:[{product_id:productId,quantity:1,pricing:{price_type:'fixed',amount:usd(order.cents)}}]}),reference:String(order._id),
      metadata:{rivals_order:String(order._id),rivals_player:String(order.playerId),rivals_environment:environment},
      success_url:env.siweUri+'/store/payment-return?order='+order._id,
      cancel_url:env.siweUri+'/store/payment-return?cancelled=1&order='+order._id,
      expires_in_minutes:10,
    },{idempotencyKey:`rivals:checkout:${environment}:${order._id}`}),
    checkout: id=>client.checkoutSessions.get(id),payment:id=>client.payments.get(id),
    async recoverCheckout(order){
      let count=0;
      for await(const payment of client.payments.listAll({limit:100})){
        if(++count>1000)break;
        if(payment.reference!==String(order._id)||!payment.id)continue;
        const full=await client.payments.get(payment.id);
        if(full.reference===String(order._id)&&full.checkout_id)return client.checkoutSessions.get(full.checkout_id);
      }
      return null;
    },
  };
}
export function safeCheckoutUrl(value) {
  try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&
    (url.hostname==='bachs.io'||url.hostname.endsWith('.bachs.io'))?url.href:null;} catch{return null;}
}
