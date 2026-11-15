import {API_BASE_URL} from '@/lib/backend';
import {httpRequest} from './http';
export type OrderStatus='initializing'|'pending'|'verification_pending'|'paid'|'fulfilled'|'failed'|'expired'|'cancelled'|'review'|'refund_review'|'refunded'|'disputed';
export interface PaymentOrder {id:string;sku:string;name:string;cents:number;currency:'USD';environment:'sandbox'|'production';status:OrderStatus;checkoutUrl?:string|null;issue?:string|null;createdAt:string;fulfilledAt?:string;chargedAmount?:string;chargedCurrency?:string}
export interface ServerProduct {id:string;name:string;cents:number;currency:'USD';kind:string;enabled:boolean;reason?:string}
export interface StoreSnapshot {ownedIds:string[];equippedIds:string[];grenadeBalance:number;recoveryUntil:string|null;serverTime:string;spendingBlocked:boolean;purchases:PaymentOrder[];catalog:ServerProduct[];configured:boolean;environment:'sandbox'|'production'|null}
export function paymentRequest<T>(path:string,method='GET',body?:unknown,key?:string,signal?:AbortSignal):Promise<T>{
  return httpRequest<T>(API_BASE_URL+path,{method,headers:{'X-Rivals-Payments':'1',...(key?{'Idempotency-Key':key}:{})},...(method!=='GET'?{body:JSON.stringify(body??{})}:{})},{signal,timeoutMs:45000,retries:0});
}
export const payments={
  store:(signal?:AbortSignal)=>paymentRequest<StoreSnapshot>('/api/payments/store','GET',undefined,undefined,signal),
  checkout:(sku:string,key:string)=>paymentRequest<PaymentOrder>('/api/payments/checkout','POST',{sku},key),
  order:(id:string)=>paymentRequest<PaymentOrder>('/api/payments/orders/'+id),
  check:(id:string)=>paymentRequest<PaymentOrder>('/api/payments/orders/'+id+'/check','POST'),
  equip:(sku:string|null)=>paymentRequest('/api/payments/equipment','PUT',{sku}),
};
export function paymentError(error:unknown){
  const code=error instanceof Error?error.message:'';
  const messages:Record<string,string>={payments_not_configured:'Checkout is not available yet. No payment was started.',unauthenticated:'Sign in again to check your purchases.',invalid_token:'Sign in again to check your purchases.',product_unavailable:'This item is not available for purchase.',already_owned:'You already own this item.',purchase_already_pending:'An order for this item is already open. Check your purchase history.',payment_account_under_review:'Your payment account needs an administrator’s review.',recovery_not_active:'Instant recovery is only available during an active death cooldown.',finish_mission_before_equipping:'Finish or leave your current mission, then equip this weapon for your next deployment.',item_not_owned:'This item is not in your verified inventory.',verification_unconfirmed:'Payment is not confirmed yet. Check this same order again—do not pay twice.',payment_environment_changed:'This order belongs to a different payment environment. Contact support.',idempotency_key_conflict:'This retry belongs to another purchase. Check your purchase history.',order_not_found:'This order is not available in your account.'};
  return messages[code]||'The response could not be confirmed. Check the same order again before making another payment.';
}
export const STORE_CHANGED='rivals:store-changed';
export const refreshStore=()=>window.dispatchEvent(new Event(STORE_CHANGED));
