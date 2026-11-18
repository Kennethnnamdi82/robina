import {useCallback,useContext,useEffect,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowRight,CheckCircle2,CreditCard,RefreshCw,ShieldCheck,X} from 'lucide-react';
import {StoreIdentity} from './StoreIdentity';
import {payments,paymentError,refreshStore,canEquip,equipmentSlot,type PaymentOrder} from '@/services/payments';
import {isNativeAndroid} from '@/native/platform';
import {money,findProduct,type Product} from './catalog';
import ProductArt from './ProductArt';
import PurchasePreview from './PurchasePreview';
import {useStoreAccount} from './useStoreAccount';
import {checkoutCountdown,deadline,useOrderClock} from './orderLifecycle';
export {PURCHASE_STATES} from './PurchasePreview';
export default function PurchaseDialog(props:{product:Product;onClose:()=>void;review?:boolean;orderId?:string;environment?:string;seasonId?:string;supportCents?:number}){
  return props.review?<PurchasePreview {...props}/>:<LivePurchase {...props}/>;
}
function LivePurchase({product,onClose,orderId,environment,seasonId,supportCents}:{product:Product;onClose:()=>void;orderId?:string;environment?:string;seasonId?:string;supportCents?:number}){
  const user=useContext(StoreIdentity),{data,refresh}=useStoreAccount();
  const [order,setOrder]=useState<PaymentOrder>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const now=useOrderClock(order?.serverTime),expired=Boolean(order&&deadline(order)<=now&&!['paid','fulfilled','review','verification_pending','refund_review','refunded','disputed'].includes(order.status));
  const inFlight=useRef(false),generation=useRef(0),opener=useRef(document.activeElement as HTMLElement|null);
  const invalidate=useCallback(()=>{generation.current++;inFlight.current=false;},[]);
  const identity=user??'anonymous',slot=`rivals:checkout:${identity}:${environment?environment+':':''}${product.id}${product.id==='pass'&&seasonId?':'+seasonId:''}${supportCents!==undefined?':'+supportCents:''}`;
  const retry=useRef<{key:string;id?:string}>();
  if(!retry.current){
    try{const stored=JSON.parse(sessionStorage.getItem(slot)||'null');if(stored&&/^[a-zA-Z0-9_-]{16,100}$/.test(stored.key)&&(!stored.id||/^[a-f\d]{24}$/i.test(stored.id)))retry.current=stored;}catch{/* No storage: retain the same key in memory. */}
    retry.current??={key:crypto.randomUUID()};
  }
  const save=()=>{try{sessionStorage.setItem(slot,JSON.stringify(retry.current));}catch{/* Server deduplication remains authoritative. */}};
  async function run(work:()=>Promise<PaymentOrder>){
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');const ticket=++generation.current;
    try{const next=await work();if(ticket!==generation.current)return;setOrder(next);retry.current!.id=next.id;save();refreshStore();if(next.status==='fulfilled')void refresh();}
    catch(e){if(ticket===generation.current)setError(paymentError(e));}
    finally{if(ticket===generation.current){inFlight.current=false;setBusy(false);}}
  }
  useEffect(()=>{
    const id=orderId??retry.current?.id;if(id)void run(()=>payments.check(id));
    const resume=()=>{const current=orderId??retry.current?.id;if(current)void run(()=>payments.check(current));};
    window.addEventListener('rivals:native-resume',resume);window.addEventListener('focus',resume);
    return()=>{invalidate();window.removeEventListener('rivals:native-resume',resume);window.removeEventListener('focus',resume);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[orderId,invalidate]);
  const remote=data?.catalog.find(p=>p.id===product.id),fulfilled=order?.status==='fulfilled';
  const recoveryEligible=product.id!=='revive';
  const eligible=Boolean(user&&data?.configured&&remote?.enabled&&!data.spendingBlocked&&recoveryEligible);
  async function openCheckout(){
    if(!order?.checkoutUrl||expired||!recoveryEligible)return;
    const url=new URL(order.checkoutUrl);
    if(url.protocol!=='https:'||!(url.hostname==='bachs.io'||url.hostname.endsWith('.bachs.io')))return;
    if(isNativeAndroid()){
      try{const {Browser}=await import('@capacitor/browser');await Browser.open({url:url.href});}catch(e){setError(paymentError(e));}
    }else window.location.assign(url.href);
  }
  const heading=fulfilled?(product.id==='support'?'THANK YOU FOR YOUR SUPPORT':'PURCHASE CONFIRMED'):expired?'CHECKOUT EXPIRED':order?.status==='initializing'?'CHECKOUT INITIALIZATION UNCONFIRMED':order?'PAYMENT STATUS / '+order.status.replaceAll('_',' ').toUpperCase():'CONFIRM YOUR PURCHASE';
  return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal><Dialog.Overlay className="rs-overlay"/><Dialog.Content className="rs-dialog rs-checkout" aria-describedby="rs-payment-copy" onCloseAutoFocus={event=>{if(opener.current?.isConnected){event.preventDefault();opener.current.focus();}}}>
    <Dialog.Close className="rs-close" aria-label="Close checkout"><X size={20}/></Dialog.Close>
    <div className="rs-dialog-kicker"><ShieldCheck size={14}/> SECURE CHECKOUT / BACHS {data?.environment==='sandbox'?'· SANDBOX TEST':''}</div>
    <Dialog.Title>{heading}</Dialog.Title><Dialog.Description id="rs-payment-copy">{product.id==='support'?(fulfilled?'Your contribution is confirmed. Thank you for helping us build RIVALS.':'A voluntary contribution to the developer and game. No equipment or gameplay advantage is included.'):fulfilled?'Your verified purchase has been delivered to your account.':'Payment is processed on Bachs. Your equipment changes only after server verification.'}</Dialog.Description>
    <div className="rs-order">{product.id!=='support'&&<ProductArt product={product}/>}<div><span>{product.subtitle}</span><h3>{order?.name??remote?.name??product.name}</h3><strong>{money((order?.cents??supportCents??remote?.cents??Math.round(product.price*100))/100)} <small>USD</small></strong></div></div>
    <div className="rs-payment"><CreditCard size={21}/> Bachs · available card and local payment methods</div>
    {(order?.includes??product.includes)?.length?<p>INCLUDED ITEMS: {(order?.includes??product.includes)!.map(id=>findProduct(id)?.name??id).join(' / ')}</p>:null}
    {(!order&&!eligible||!recoveryEligible&&!fulfilled)&&<p role="status">{!recoveryEligible?'Recovery is free. No purchase is needed to start another mission.':remote?.reason??(data&&!data.configured?'Checkout is not configured yet.':'Loading availability—sign in to purchase.')}</p>}
    {order&&<div className="rs-verification" role="status">{fulfilled?<CheckCircle2/>:<ShieldCheck/>}<span>{fulfilled?(product.id==='support'?'Support payment received. Your receipt is saved in payment history.':product.quantity?`${product.quantity} grenades added to your inventory.`:product.id==='revive'?'Recovery confirmed. You can deploy again.':'Item unlocked. Equip it in your field locker.'):expired?'This unpaid checkout has expired. Start a new purchase if you still want to pay.':'Not confirmed? Check this same order. Do not pay again.'}<small>ORDER {order.id}</small>{order.issue&&<small>{order.issue.replaceAll('_',' ')}</small>}</span></div>}
    {error&&<p role="alert">{error}</p>}
    {!order&&<button className="rs-primary" disabled={!eligible||busy} onClick={()=>{save();void run(()=>supportCents!==undefined?payments.support(supportCents,retry.current!.key):payments.checkout(product.id,retry.current!.key));}}>{busy?'INITIALIZING…':'CONFIRM / CONTINUE TO BACHS'}<ArrowRight size={16}/></button>}
    {order&&!fulfilled&&<>
      {order.checkoutUrl&&!expired&&recoveryEligible&&<><p role="timer" aria-label="Checkout expires in">EXPIRES IN {checkoutCountdown(deadline(order),now)}</p><button className="rs-primary" disabled={busy} onClick={()=>void openCheckout()}>CONTINUE PAYMENT <ArrowRight size={16}/></button></>}
      <button className="rs-secondary" disabled={busy} onClick={()=>void run(()=>payments.check(order.id))}><RefreshCw size={16}/>{busy?'CHECKING…':'CHECK PAYMENT STATUS'}</button>
      {(expired||['expired','cancelled'].includes(order.status))&&<button className="rs-secondary" onClick={()=>{retry.current={key:crypto.randomUUID()};save();setOrder(undefined);}}>START A NEW PURCHASE</button>}
    </>}
    {fulfilled&&canEquip(product.category)&&<button className="rs-primary" disabled={busy} onClick={async()=>{setBusy(true);try{await payments.equip(product.id,equipmentSlot(product.category,product.id));refreshStore();onClose();}catch(e){setError(paymentError(e));}finally{setBusy(false);}}}>{product.category==='bundles'?'EQUIP PACK CONTENTS':'EQUIP FOR NEXT DEPLOYMENT'}</button>}
    {fulfilled&&product.quantity&&<button className="rs-primary" onClick={()=>{retry.current={key:crypto.randomUUID()};save();setOrder(undefined);}}>BUY ANOTHER PACK</button>}
    {fulfilled&&product.id==='support'&&<button className="rs-secondary" onClick={()=>{retry.current={key:crypto.randomUUID()};save();setOrder(undefined);}}>SUPPORT AGAIN</button>}
    <Dialog.Close className="rs-secondary">{fulfilled?'CONTINUE':order?'CLOSE / ORDER IS SAVED':'CANCEL'}</Dialog.Close>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
