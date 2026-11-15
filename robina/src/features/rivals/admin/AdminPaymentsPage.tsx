import {useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {paymentRequest,paymentError,type PaymentOrder} from '@/services/payments';
import {money} from '../store/catalog';
import './admin-bounties.css';
import '../store/store.css';
interface AdminOrder extends PaymentOrder{player?:{wallet:string;email?:string};checkoutId?:string;chargeId?:string}
interface Page{items:AdminOrder[];nextBefore:string|null;totals:{_id:{environment:string;status:string};orders:number;cents:number}[]}
export default function AdminPaymentsPage(){
  const [data,setData]=useState<Page>(),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[before,setBefore]=useState<string>();
  const [link,setLink]=useState<Record<string,string>>({});
  const load=useCallback(async()=>{setBusy(true);try{const query=new URLSearchParams({...status?{status}:{},...before?{before}:{}});setData(await paymentRequest<Page>('/api/admin/payments/orders?'+query));setError('');}catch(e){setError(paymentError(e));}finally{setBusy(false);}},[status,before]);
  useEffect(()=>{void load();},[load]);
  return <main className="rs-store"><header className="rs-masthead"><div><span className="rs-kicker">RIVALS / OWNER OPERATIONS</span><h1>PAYMENTS & REVENUE</h1></div><Link to="/admin/bounties">BOUNTY ADMIN</Link></header><p>Only independently verified Bachs payments deliver items. Sandbox totals are separate from live revenue. Refunds and disputes require reconciliation in Bachs; no manual Paid action exists here.</p>
    <div className="rs-product-grid">{data?.totals.map(t=><section className="rs-spec-note" key={t._id.environment+t._id.status}><strong>{t._id.environment.toUpperCase()} / {t._id.status.replaceAll('_',' ').toUpperCase()}</strong><p>{t.orders} orders · {money(t.cents/100)} USD reference</p></section>)}</div>
    <div className="rs-toolbar"><label>STATUS <select value={status} onChange={e=>{setBefore(undefined);setStatus(e.target.value);}}><option value="">All orders</option>{['initializing','pending','verification_pending','paid','fulfilled','failed','expired','cancelled','review','refund_review','refunded','disputed'].map(s=><option key={s}>{s}</option>)}</select></label><button className="rs-secondary" disabled={busy} onClick={()=>void load()}>REFRESH</button></div>
    {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Checking payment records…</p>}{data&&!data.items.length&&<p>No payment orders yet.</p>}
    <div className="rs-receipts">{data?.items.map(order=><article key={order.id}><div><h3>{order.name} · {money(order.cents/100)}</h3><p>{order.player?.email||order.player?.wallet}</p><small>{order.id} · {order.environment} · {new Date(order.createdAt).toLocaleString()}</small><p>{order.status.replaceAll('_',' ').toUpperCase()} {order.issue&&' / '+order.issue.replaceAll('_',' ')}</p><small>{order.checkoutId} {order.chargeId}</small>{order.chargedAmount&&<p>Collected: {order.chargedAmount} {order.chargedCurrency}</p>}{order.status==='initializing'&&<form onSubmit={async event=>{event.preventDefault();setBusy(true);try{await paymentRequest('/api/admin/payments/orders/'+order.id+'/attach-checkout','POST',{checkoutId:link[order.id]});await load();}catch(e){setError(paymentError(e));}finally{setBusy(false);}}}><label>ORIGINAL BACHS CHECKOUT ID<input required pattern="chk_[a-zA-Z0-9_-]+" value={link[order.id]??''} onChange={event=>setLink({...link,[order.id]:event.target.value})}/></label><button className="rs-secondary" disabled={busy}>VERIFY ORIGINAL CHECKOUT</button></form>}</div><button className="rs-secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await paymentRequest('/api/admin/payments/orders/'+order.id+'/reconcile','POST');await load();}catch(e){setError(paymentError(e));}finally{setBusy(false);}}}>VERIFY WITH BACHS / RETRY DELIVERY</button></article>)}</div>
    {data?.nextBefore&&<button className="rs-secondary" onClick={()=>setBefore(data.nextBefore!)}>OLDER ORDERS</button>}{before&&<button className="rs-secondary" onClick={()=>setBefore(undefined)}>LATEST ORDERS</button>}
  </main>;
}
