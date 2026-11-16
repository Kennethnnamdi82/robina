import {useEffect,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {payments,paymentError,type PaymentOrder} from '@/services/payments';
import {findProduct} from './catalog';
import PurchaseDialog from './PurchaseDialog';
import {supportProduct} from './support';
export default function PaymentReturn(){
  const {search}=useLocation(),id=new URLSearchParams(search).get('order'),navigate=useNavigate();
  const [order,setOrder]=useState<PaymentOrder>(),[error,setError]=useState('');
  useEffect(()=>{let active=true;if(id&&/^[a-f\d]{24}$/i.test(id))void payments.order(id).then(row=>{if(active)setOrder(row);}).catch(e=>{if(active)setError(paymentError(e));});else setError('Invalid order reference.');return()=>{active=false;};},[id]);
  const product=order&&(order.sku==='support'?supportProduct(order.cents):findProduct(order.sku));
  return <div className="rs-store"><header className="rs-masthead"><div><span className="rs-kicker">BACHS / SECURE RETURN</span><h1>YOUR PAYMENT</h1></div></header><p>Continue your saved checkout or check a payment already made. Returning from checkout alone does not confirm payment.</p>{error?<p role="alert">{error}</p>:!order?<p role="status">LOADING ORDER…</p>:null}{product&&<PurchaseDialog key={order.id} product={product} orderId={order.id} environment={order.environment} supportCents={order.sku==='support'?order.cents:undefined} onClose={()=>navigate('/purchase-history')}/>}<Link className="rs-secondary" to="/purchase-history">PURCHASE HISTORY</Link></div>;
}
