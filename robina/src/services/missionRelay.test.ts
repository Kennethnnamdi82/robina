import { describe, expect, it, vi } from 'vitest';
import { missionRelay } from '../../server/missionRelay.js';
const response = () => ({ code: 0, data: null as unknown, setHeader(){}, status(code:number){this.code=code;return this;}, json(data:unknown){this.data=data;return this;} });
const headers = {host:'rivals-heist.vercel.app',origin:'https://rivals-heist.vercel.app','content-type':'application/json',cookie:'bd_session=player; unrelated=secret'};
describe('mission first-party relay',()=>{
  it('forwards launch permits and bounded success proofs without allowing per-frame writes',async()=>{
    const fetcher=vi.fn().mockImplementation(async()=>new Response('{"status":"queued"}'));
    for(const [path,method]of [['/api/missions/permits','POST'],['/api/missions/completions','POST'],['/api/missions/completions/0123456789abcdef01234567','GET']]){
      const res=response();await missionRelay({url:path,method,headers,body:method==='POST'?{permit:'signed',index:0,count:1,chunk:'AAAA'}:undefined},res,'https://render.invalid',fetcher);expect(res.code).toBe(200);
    }
    for(const [path,method]of [['/api/missions/completions/0123456789abcdef01234567','POST'],['/api/missions/permits','GET'],['/api/missions/position','POST']]){
      const res=response();await missionRelay({url:path,method,headers,body:{}},res,'https://render.invalid',fetcher);expect(res.code).toBe(404);
    }
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('forwards allowlisted authenticated mission starts',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response('{"session":{"_id":"safe"}}')),res=response();
    await missionRelay({url:'/api/mission-relay?__mission_route=/api/missions/sessions',method:'POST',headers,body:{missionId:'assignment-reserve'}},res,'https://render.invalid',fetcher);
    expect(res.code).toBe(200);expect(fetcher.mock.calls[0][0].pathname).toBe('/api/missions/sessions');
    expect(fetcher.mock.calls[0][1].headers.cookie).toBe('bd_session=player');
  });
  it('blocks forged completion, unauthorized routes and cross-origin writes',async()=>{
    const fetcher=vi.fn();
    for(const path of ['/api/missions/sessions/0123456789abcdef01234567/complete','/api/admin/me','https://evil.invalid/api/missions/sessions']){
      const res=response();await missionRelay({url:'/api/mission-relay?__mission_route='+encodeURIComponent(path),method:'POST',headers,body:{}},res,'https://render.invalid',fetcher);expect(res.code).toBe(404);
    }
    const res=response();await missionRelay({url:'/api/missions/sessions',method:'POST',headers:{...headers,origin:'https://evil.invalid'},body:{}},res,'https://render.invalid',fetcher);
    expect(res.code).toBe(403);expect(fetcher).not.toHaveBeenCalled();
  });
  it('permits authenticated ticket and result-history reads without accepting gameplay outcomes',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response('{"ticket":"short-lived"}')),res=response();
    await missionRelay({url:'/api/missions/sessions/0123456789abcdef01234567/connect',method:'POST',headers,body:{}},res,'https://render.invalid',fetcher);
    expect(res.code).toBe(200);expect(fetcher.mock.calls[0][0].pathname).toMatch(/\/connect$/);
  });
});
