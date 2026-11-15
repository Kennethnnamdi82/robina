import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {payments,paymentError,type PaymentOrder} from '@/services/payments';
import {findProduct} from './catalog';
import PurchaseDialog from './PurchaseDialog';
export default function PaymentReturn(){
  const {search}=useLocation(),id=new URLSearchParams(search).get('order');
  const [order,setOrder]=useState<PaymentOrder>(),[error,setError]=useState('');
  useEffect(()=>{let active=true;if(id&&/^[a-f\d]{24}$/i.test(id))void payments.order(id).then(row=>{if(active)setOrder(row);}).catch(e=>{if(active)setError(paymentError(e));});else setError('Invalid order reference.');return()=>{active=false;};},[id]);
  const product=order&&findProduct(order.sku);
  return <div className="rs-store"><header className="rs-masthead"><div><span className="rs-kicker">BACHS / SECURE RETURN</span><h1>YOUR PAYMENT</h1></div></header><p>Returning from checkout does not confirm payment. Check the saved order below.</p><p>Paid from the Android app? Close this browser and return to RIVALS, then check the same order.</p>{error?<p role="alert">{error}</p>:!order?<p role="status">LOADING ORDER…</p>:null}{product&&<PurchaseDialog key={order.id} product={product} orderId={order.id} environment={order.environment} onClose={()=>window.location.assign('/purchase-history')}/>}<Link className="rs-secondary" to="/purchase-history">PURCHASE HISTORY</Link></div>;
}
