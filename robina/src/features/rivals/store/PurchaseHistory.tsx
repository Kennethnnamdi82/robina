import {useEffect,useRef} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,History} from 'lucide-react';
import {refreshStore} from '@/services/payments';
import {money,type StoreAccount} from './catalog';
import {checkoutCountdown,deadline,UNPAID_ORDER_STATES,useOrderClock} from './orderLifecycle';
export function PurchaseHistory({account}:{account?:StoreAccount}){
  const now=useOrderClock(account?.serverTime),expired=useRef('');
  const removed=(account?.purchases??[]).filter(p=>UNPAID_ORDER_STATES.has(p.status)&&deadline(p)<=now).map(p=>p.id).join(',');
  useEffect(()=>{if(removed&&removed!==expired.current){expired.current=removed;refreshStore();}},[removed]);
  const purchases=account?.purchases.filter(p=>!UNPAID_ORDER_STATES.has(p.status)||deadline(p)>now)??[];
  return purchases.length?<div className="rs-receipts">{purchases.map(p=><article key={p.id}><History size={20}/><div><h3>{p.product}</h3><small>{p.date} · {p.id}</small><Link to={'/store/payment-return?order='+p.id}>{UNPAID_ORDER_STATES.has(p.status)?'CONTINUE PAYMENT':'VIEW / CHECK PAYMENT'}</Link>{UNPAID_ORDER_STATES.has(p.status)&&Number.isFinite(deadline(p))&&<small role="timer" aria-label="Checkout expires in">EXPIRES IN {checkoutCountdown(deadline(p),now)}</small>}</div><span>{p.status.replaceAll('_',' ').toUpperCase()}</span><strong>{money(p.price)}</strong></article>)}</div>:<div className="rs-empty"><History size={40} strokeWidth={1}/><span className="rs-kicker">PURCHASE HISTORY</span><h3>NO PURCHASES YET</h3><p>Unpaid checkouts expire after ten minutes. Confirmed receipts remain here.</p><Link className="rs-secondary" to="/store">BACK TO THE COLLECTION <ArrowRight size={16}/></Link></div>;
}
