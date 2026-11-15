import {Browser} from '@capacitor/browser';
export function isPaymentReturn(value:string){
  try{const url=new URL(value);return url.origin==='https://rivals-heist.vercel.app'&&!url.username&&!url.password&&!url.hash&&
    url.pathname==='/store/payment-return'&&url.searchParams.getAll('order').length===1&&/^[a-f\d]{24}$/i.test(url.searchParams.get('order')??'');}catch{return false;}
}
export async function handlePaymentReturn(value:string){
  if(!isPaymentReturn(value))return false;
  // A deep link is only a wake-up hint. The saved order is checked through the
  // native authenticated transport; no URL parameter grants items or health.
  try{await Browser.close();}catch{/* Android may already have closed the custom tab. */}
  window.dispatchEvent(new Event('rivals:native-resume'));return true;
}
