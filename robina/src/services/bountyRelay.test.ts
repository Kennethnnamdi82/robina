import { describe, expect, it, vi } from 'vitest';
import { bountyRelay } from '../../server/bountyRelay.js';
const response = () => ({ code: 0, headers: {} as Record<string,unknown>, data: null as unknown, setHeader(name:string,value:unknown){this.headers[name]=value;},status(code:number){this.code=code;return this;},json(data:unknown){this.data=data;return this;} });
const headers = {host:'rivals-heist.vercel.app',origin:'https://rivals-heist.vercel.app','content-type':'application/json','x-rivals-bounty':'1',cookie:'bd_admin=signed; other=secret'};
describe('explicit Vercel bounty rewrites',()=>{
  it('preserves the original public URL and strips reserved routing parameters from backend queries',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response('{"items":[]}')),res=response();
    await bountyRelay({url:'/api/admin/bounties/players?q=creator&limit=20&__bounty_route=ignored',method:'GET',headers},res,'https://render.invalid',fetcher);
    expect(res.code).toBe(200);expect(fetcher.mock.calls[0][0].href).toBe('https://render.invalid/api/admin/bounties/players?q=creator&limit=20');
  });
  it('reconstructs an allowlisted public route when the runtime exposes only the rewritten URL',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response('{"items":[]}')),res=response();
    await bountyRelay({url:'/api/bounty-relay?__bounty_route=%2Fapi%2Fadmin%2Fbounties%2Fsubmissions&status=pending&limit=20',method:'GET',headers},res,'https://render.invalid',fetcher);
    expect(res.code).toBe(200);expect(fetcher.mock.calls[0][0].href).toBe('https://render.invalid/api/admin/bounties/submissions?status=pending&limit=20');
  });
  it('cannot rewrite into an external URL, unrelated auth/payment endpoint, traversal or force-payout action',async()=>{
    const fetcher=vi.fn();
    for(const path of ['https://evil.invalid/api/admin/bounties/tasks','/api/auth/me','/api/payments/verify','/api/bounties/../admin/me','/api/admin/bounties/force-paid']){
      const res=response();await bountyRelay({url:'/api/bounty-relay?__bounty_route='+encodeURIComponent(path),method:'POST',headers,body:{}},res,'https://render.invalid',fetcher);expect(res.code).toBe(404);
    }expect(fetcher).not.toHaveBeenCalled();
  });
  it('still applies write CSRF and keeps withdrawal authorization separate from payout execution',async()=>{
    const fetcher=vi.fn(),res=response();
    await bountyRelay({url:'/api/bounty-relay?__bounty_route=/api/admin/bounties/withdrawals/0123456789abcdef01234567/execute',method:'POST',headers:{...headers,origin:'https://evil.invalid'},body:{}},res,'https://render.invalid',fetcher);
    expect(res.code).toBe(403);expect(fetcher).not.toHaveBeenCalled();
  });
});
