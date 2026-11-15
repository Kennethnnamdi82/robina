import {useCallback,useContext,useEffect,useRef,useState} from 'react';
import {StoreIdentity} from './StoreIdentity';
import {payments,paymentError,STORE_CHANGED,type StoreSnapshot} from '@/services/payments';
export function useStoreAccount(enabled=true){
  const identity=useContext(StoreIdentity);
  const [data,setData]=useState<{identity:string;value:StoreSnapshot}>(),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const generation=useRef(0);
  const invalidate=useCallback(()=>{generation.current++;},[]);
  const refresh=useCallback(async()=>{
    if(!enabled||!identity)return;
    const ticket=++generation.current;setLoading(true);
    try{const value=await payments.store();if(ticket===generation.current){setData({identity,value});setError('');}}
    catch(e){if(ticket===generation.current)setError(paymentError(e));}
    finally{if(ticket===generation.current)setLoading(false);}
  },[enabled,identity]);
  useEffect(()=>{
    void refresh();const changed=()=>{void refresh();};
    window.addEventListener(STORE_CHANGED,changed);window.addEventListener('focus',changed);window.addEventListener('rivals:native-resume',changed);
    return()=>{invalidate();window.removeEventListener(STORE_CHANGED,changed);window.removeEventListener('focus',changed);window.removeEventListener('rivals:native-resume',changed);};
  },[refresh,invalidate]);
  return {data:data?.identity===identity?data?.value:undefined,error,loading,refresh,identity};
}
