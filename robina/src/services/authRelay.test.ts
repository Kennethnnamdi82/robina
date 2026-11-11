import {describe,it,expect,vi} from 'vitest';
import {relay,firstPartyCookie} from '../../server/authRelay.js';
const response=()=>({code:0,headers:{} as Record<string,unknown>,data:null as unknown,setHeader(name:string,value:unknown){this.headers[name]=value;},status(code:number){this.code=code;return this;},json(data:unknown){this.data=data;return this;}});
const request=(patch={})=>({url:'/api/auth/me',method:'GET',headers:{host:'rivals-heist.vercel.app',cookie:'bd_session=signed; unrelated=secret'},...patch});
describe('first-party cookie transport',()=>{
  it('forwards only authentication cookies and never caches session responses',async()=>{
    const res=response(),fetcher=vi.fn().mockResolvedValue(new Response('{"user":{"wallet":"verified"}}',{headers:{'Set-Cookie':'bd_session=signed; Domain=render.invalid; Max-Age=1209600; Path=/; SameSite=None; Secure; HttpOnly'}}));
    await relay(request(),res,'https://render.invalid',fetcher);
    expect(fetcher.mock.calls[0][0].href).toBe('https://render.invalid/api/auth/me');
    expect(fetcher.mock.calls[0][1].headers.cookie).toBe('bd_session=signed');expect(res.code).toBe(200);expect(res.headers['Cache-Control']).toContain('no-store');
    expect(res.headers['Set-Cookie']).toEqual(['bd_session=signed; Max-Age=1209600; Path=/; HttpOnly; Secure; SameSite=Lax']);
  });
  it('preserves logout deletion and rejects unrelated cookies',()=>{
    expect(firstPartyCookie('bd_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT')).toContain('Expires=Thu, 01 Jan 1970');expect(firstPartyCookie('tracking=anything')).toBeNull();
  });
  it('rejects cross-origin writes, unexpected routes and insecure upstreams',async()=>{
    const fetcher=vi.fn();for(const [req,url,status] of [
      [request({method:'POST',url:'/api/auth/logout',headers:{host:'rivals-heist.vercel.app',origin:'https://evil.invalid','content-type':'application/json'}}),'https://render.invalid',403],
      [request({url:'/api/payments/verify'}),'https://render.invalid',404],
      [request(),'http://render.invalid',503],
    ] as const){const res=response();await relay(req,res,url,fetcher);expect(res.code).toBe(status);}expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not follow upstream redirects or return HTML as a session',async()=>{
    for(const upstream of [new Response(null,{status:302,headers:{Location:'https://evil.invalid'}}),new Response('<html>not auth</html>')]){const res=response();await relay(request(),res,'https://render.invalid',vi.fn().mockResolvedValue(upstream));expect(res.code).toBe(502);}
  });
  it('allows only explicit bounty routes and preserves CSRF and withdrawal idempotency headers',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response('{"status":"pending"}'));
    const res=response();
    await relay(request({url:'/api/bounties/withdrawals',method:'POST',body:{amountMicros:'5000000'},headers:{host:'rivals-heist.vercel.app',origin:'https://rivals-heist.vercel.app','content-type':'application/json','x-rivals-bounty':'1','idempotency-key':'stable-withdrawal-key-123',cookie:'bd_session=player; bd_admin=owner; other=secret'}}),res,'https://render.invalid',fetcher);
    expect(res.code).toBe(200);expect(fetcher.mock.calls[0][1].headers['idempotency-key']).toBe('stable-withdrawal-key-123');
    expect(fetcher.mock.calls[0][1].headers['x-rivals-bounty']).toBe('1');expect(fetcher.mock.calls[0][1].headers.cookie).toBe('bd_session=player; bd_admin=owner');
    for(const url of ['/api/bounties/treasury','/api/admin/bounties/force-refund','/api/admin/bounties/withdrawals/invalid/execute']){const out=response();await relay(request({url}),out,'https://render.invalid',fetcher);expect(out.code).toBe(404);}
  });
  it('protects PUT/PATCH writes too and never lets a bounty request omit the custom CSRF header',async()=>{
    const fetcher=vi.fn();
    for(const [url,method,headers] of [
      ['/api/bounties/wallet/address','PUT',{host:'rivals-heist.vercel.app',origin:'https://evil.invalid','x-rivals-bounty':'1'}],
      ['/api/admin/bounties/tasks/0123456789abcdef01234567/status','PATCH',{host:'rivals-heist.vercel.app',origin:'https://evil.invalid','x-rivals-bounty':'1'}],
      ['/api/bounties/withdrawals','POST',{host:'rivals-heist.vercel.app',origin:'https://rivals-heist.vercel.app'}],
    ] as const){const out=response();await relay(request({url,method,headers:{...headers,'content-type':'application/json'}}),out,'https://render.invalid',fetcher);expect(out.code).toBe(403);}expect(fetcher).not.toHaveBeenCalled();
  });
});
