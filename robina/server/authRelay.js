// Shared first-party cookie transport to the existing Express backend.
import { allowedBountyMethods } from './bountyPolicy.js';
const routes=new Map([
  ['/api/auth/me','GET'],['/api/auth/nonce','GET'],['/api/auth/google','POST'],
  ['/api/auth/verify','POST'],['/api/auth/wallet','POST'],['/api/auth/logout','POST'],
  ['/api/admin/me','GET'],['/api/admin/login','POST'],['/api/admin/logout','POST'],
  ['/api/auth/native/authorize','POST'],['/api/auth/native/exchange','POST'],
]);
export function firstPartyCookie(value){
  if(!/^bd_(session|admin)=/.test(value))return null;
  return value.split(';').filter((part,i)=>i===0||!/^\s*(domain|samesite|secure|httponly)\b/i.test(part)).join(';')+'; HttpOnly; Secure; SameSite=Lax';
}
export async function relay(req,res,upstream=process.env.VITE_API_URL,fetcher=fetch){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');
  const path=new URL(req.url,'https://local.invalid'),method=req.method||'GET';
  const bountyMethods=allowedBountyMethods(path.pathname),allowed=routes.has(path.pathname)?[routes.get(path.pathname)]:bountyMethods;
  if(!allowed.length)return res.status(404).json({error:'not_found'});
  if(!allowed.includes(method)){res.setHeader('Allow',allowed.join(', '));return res.status(405).json({error:'method_not_allowed'});}
  // Never proxy an untrusted browser's state-changing request with our cookies
  const origin=req.headers.origin,host=req.headers.host;
  if(method!=='GET'&&(!host||req.headers['sec-fetch-site']==='cross-site'||(origin&&origin!=='https://'+host)))return res.status(403).json({error:'untrusted_origin'});
  if(bountyMethods.length&&method!=='GET'&&req.headers['x-rivals-bounty']!=='1')return res.status(403).json({error:'bounty_csrf_protection'});
  let target;try{target=new URL(upstream);if(target.protocol!=='https:'||/^(localhost|127\.0\.0\.1|\[::1\])$/.test(target.hostname)||target.username||target.password)throw Error();}catch{return res.status(503).json({error:'service_unavailable'});}
  target.pathname=target.pathname.replace(/\/api\/?$/,'').replace(/\/$/,'')+path.pathname;target.search=path.search;
  const headers={accept:'application/json'};
  const cookies=String(req.headers.cookie||'').split(';').map(c=>c.trim()).filter(c=>/^bd_(session|admin)=/.test(c));if(cookies.length)headers.cookie=cookies.join('; ');
  if(bountyMethods.length){headers['x-rivals-bounty']='1';const key=req.headers['idempotency-key'];if(typeof key==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(key))headers['idempotency-key']=key;}
  let body;if(method!=='GET'){
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return res.status(415).json({error:'json_required'});
    body=typeof req.body==='string'?req.body:JSON.stringify(req.body??{});
    if(Buffer.byteLength(body)>65536)return res.status(413).json({error:'body_too_large'});
    headers['content-type']='application/json';
  }
  try{
    const response=await fetcher(target,{method,headers,body,redirect:'manual',signal:AbortSignal.timeout(25000)});
    if(response.status>=300&&response.status<400)return res.status(502).json({error:'invalid_upstream_response'});
    const text=await response.text();let data;try{data=text?JSON.parse(text):{};}catch{return res.status(502).json({error:'invalid_upstream_response'});}
    const setCookies=response.headers.getSetCookie().map(firstPartyCookie).filter(Boolean);if(setCookies.length)res.setHeader('Set-Cookie',setCookies);
    return res.status(response.status).json(data);
  }catch{return res.status(503).json({error:'service_unavailable'});}
}
export default function handler(req,res){return relay(req,res);}
