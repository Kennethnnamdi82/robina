import {Link,useLocation} from 'react-router-dom';
import './store.css';
export default function PaymentReturnNotice(){
  const {search}=useLocation(),id=new URLSearchParams(search).get('order'),valid=id&&/^[a-f\d]{24}$/i.test(id);
  return <main className="rs-store rh-loading"><section className="rs-recovery-options"><span className="rs-kicker">RIVALS / SECURE CHECKOUT RETURN</span><h1>CHECK YOUR SAVED ORDER</h1><p>Returning from Bachs does not confirm payment.</p><p>Paid from the Android app? Return to RIVALS and check the same order. Your native session stays private in the app.</p>{valid&&/Android/i.test(navigator.userAgent)&&<a className="rs-primary" href={`intent://rivals-heist.vercel.app/store/payment-return?order=${id}#Intent;scheme=https;package=com.venomee.rivalsheist;end`}>RETURN TO RIVALS APP</a>}<p>On the website, sign in to the same account and open Purchase history. Do not pay again while an order is unresolved.</p><Link className="rs-secondary" to="/">SIGN IN TO CHECK PURCHASE HISTORY</Link></section></main>;
}
