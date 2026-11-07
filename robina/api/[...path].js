// First-party authentication transport to the existing Render backend
// No token storage in JavaScript and no account/payment/game backend here
const routes=new Map([
  ['/api/auth/me','GET'],['/api/auth/nonce','GET'],['/api/auth/google','POST'],
  ['/api/auth/verify','POST'],['/api/auth/wallet','POST'],['/api/auth/logout','POST'],
  ['/api/admin/me','GET'],['/api/admin/login','POST'],['/api/admin/logout','POST'],
]);
export function firstPartyCookie(value){
  if(!/^bd_(session|admin)=/.test(value))return null;
  return value.split(';').filter((part,i)=>i===0||!/^\s*(domain|samesite|secure|httponly)\b/i.test(part)).join(';')+'; HttpOnly; Secure; SameSite=Lax';
}
export async function relay(req,res,upstream=process.env.VITE_API_URL,fetcher=fetch){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');
  const path=new URL(req.url,'https://local.invalid'),method=req.method||'GET',allowed=routes.get(path.pathname);
  if(!allowed)return res.status(404).json({error:'not_found'});
  if(method!==allowed){res.setHeader('Allow',allowed);return res.status(405).json({error:'method_not_allowed'});}
  // Never proxy an untrusted browser's state-changing request with our cookies
  const origin=req.headers.origin,host=req.headers.host;
  if(method==='POST'&&(!host||req.headers['sec-fetch-site']==='cross-site'||(origin&&origin!=='https://'+host)))return res.status(403).json({error:'untrusted_origin'});
  let target;try{target=new URL(upstream);if(target.protocol!=='https:'||/^(localhost|127\.0\.0\.1|\[::1\])$/.test(target.hostname)||target.username||target.password)throw Error();}catch{return res.status(503).json({error:'service_unavailable'});}
  target.pathname=target.pathname.replace(/\/api\/?$/,'').replace(/\/$/,'')+path.pathname;target.search=path.search;
  const headers={accept:'application/json'};
  const cookies=String(req.headers.cookie||'').split(';').map(c=>c.trim()).filter(c=>/^bd_(session|admin)=/.test(c));if(cookies.length)headers.cookie=cookies.join('; ');
  let body;if(method==='POST'){
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
