import type {ApiError,RequestOptions} from './http';

export const SESSION_RETRY_EVENT='rivals:retry-session';
export const sessionTemporarilyUnavailable=(error:unknown)=>{
  const status=(error as ApiError)?.status;
  return status===undefined||status===408||status===429||status>=500;
};

/** Revalidate the existing server credential, never turn an offline hint into
 * authentication. A bounded deadline handles repeated quick cold-start 503s. */
export async function restoreSession<T>(read:(options:RequestOptions)=>Promise<T>,signal:AbortSignal,budgetMs=65000):Promise<T>{
  const deadline=Date.now()+budgetMs;
  for(let attempt=0;;attempt++){
    if(signal.aborted)throw new DOMException('Request cancelled','AbortError');
    try{const value=await read({signal,timeoutMs:Math.max(1,deadline-Date.now()),retries:0});if(signal.aborted)throw new DOMException('Request cancelled','AbortError');return value;}
    catch(error){
      const delay=Math.min(5000,750*2**Math.min(attempt,3));
      if(signal.aborted||!sessionTemporarilyUnavailable(error)||Date.now()+delay>=deadline)throw error;
      await new Promise<void>((resolve,reject)=>{
        const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('Request cancelled','AbortError'));};
        const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},delay);
        signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
      });
    }
  }
}
