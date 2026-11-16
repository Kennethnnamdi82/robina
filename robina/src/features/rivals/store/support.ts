import type {Product} from './catalog';
export function supportProduct(cents:number):Product{
  return {id:'support',name:'SUPPORT THE DEVELOPER',category:'health',price:cents/100,subtitle:'VOLUNTARY SUPPORT / RIVALS',description:'Support the developer and continued development of RIVALS. No game items or advantages are included.',accent:'#d0c6b5',art:'effect'};
}
export function supportAmount(value:string){
  if(!/^\d{1,5}(?:\.\d{1,2})?$/.test(value.trim()))return null;
  const [dollars,decimals='']=value.trim().split('.');const cents=Number(dollars)*100+Number(decimals.padEnd(2,'0'));
  return Number.isSafeInteger(cents)&&cents>=1&&cents<=1000000?cents:null;
}
