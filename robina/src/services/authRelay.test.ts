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
});
