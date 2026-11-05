const KEY='robina_google_oauth_pending';
export function googleAttemptPending(now=Date.now()){
  try{const value=sessionStorage.getItem(KEY);if(value==='1')return true;const time=Number(value);return time>0&&now-time<10*60*1000;}catch{return false;}
}
export function beginGoogleAttempt(){try{sessionStorage.setItem(KEY,String(Date.now()));}catch{/* In-memory callback still completes in restricted storage. */}}
export function clearGoogleAttempt(){try{sessionStorage.removeItem(KEY);}catch{/* Storage may be disabled. */}}
/** Only a backend-verified session is accepted. A lost exchange response may
 * still have set its HttpOnly cookie, so reconcile before reporting failure. */
export async function verifyGoogleSession<T>(exchange:()=>Promise<T>,restore:()=>Promise<T>):Promise<T>{
  try{return await exchange();}catch(original){try{return await restore();}catch{throw original;}}
}
