import {describe,it,expect,vi} from 'vitest';
import {bountyRelay} from '../../server/bountyRelay.js';
import {allowedPaymentMethods} from '../../server/paymentPolicy.js';
const response=()=>({code:0,data:null as unknown,headers:{} as Record<string,unknown>,setHeader(n:string,v:unknown){this.headers[n]=v;},status(n:number){this.code=n;return this;},json(v:unknown){this.data=v;return this;}});
describe('secure web/Android payment transport',()=>{
  it('forwards only the supported collection capability on first-party requests',async()=>{
    const res=response(),fetcher=vi.fn().mockResolvedValue(new Response('{}'));
    await bountyRelay({url:'/api/payments/store',method:'GET',headers:{host:'rivals-heist.vercel.app','x-rivals-store-version':'2',cookie:'bd_session=test'}},res,'https://render.invalid',fetcher);
    expect(fetcher.mock.calls[0][1].headers['x-rivals-store-version']).toBe('2');
    expect(allowedPaymentMethods('/api/payments/season/claim')).toEqual(['POST']);expect(allowedPaymentMethods('/api/admin/payments/seasons')).toEqual(['GET','POST']);
  });
  it('only allows the explicit store/order/equipment routes, never arbitrary provider calls',()=>{
    expect(allowedPaymentMethods('/api/payments/checkout')).toEqual(['POST']);expect(allowedPaymentMethods('/api/payments/store')).toEqual(['GET']);
    for(const path of ['/api/payments/verify','/api/payments/bachs/webhook','/api/payments/charge','/api/payments/orders/not-an-id/check','/api/admin/payments/paid'])expect(allowedPaymentMethods(path)).toEqual([]);
  });
  it('forwards first-party authentication, CSRF and stable idempotency without exposing secrets',async()=>{
    const res=response(),fetcher=vi.fn().mockResolvedValue(new Response('{"status":"pending"}'));
    await bountyRelay({url:'/api/bounty-relay?__bounty_route=/api/payments/checkout',method:'POST',headers:{host:'rivals-heist.vercel.app',origin:'https://rivals-heist.vercel.app','content-type':'application/json','x-rivals-payments':'1','idempotency-key':'stable-key-1234567890',cookie:'bd_session=test; tracking=no'},body:{sku:'mp5'}},res,'https://render.invalid',fetcher);
    expect(res.code).toBe(200);expect(fetcher.mock.calls[0][0].href).toBe('https://render.invalid/api/payments/checkout');
    expect(fetcher.mock.calls[0][1].headers).toMatchObject({'x-rivals-payments':'1','idempotency-key':'stable-key-1234567890',cookie:'bd_session=test'});expect(res.headers['Cache-Control']).toContain('no-store');
  });
  it('rejects cross-site or missing payment CSRF before reaching the backend',async()=>{
    for(const patch of [{origin:'https://evil.invalid'},{'x-rivals-payments':''}]){
      const res=response(),fetcher=vi.fn();await bountyRelay({url:'/api/payments/checkout',method:'POST',headers:{host:'rivals-heist.vercel.app',origin:'https://rivals-heist.vercel.app','content-type':'application/json','x-rivals-payments':'1',...patch},body:{sku:'mp5'}},res,'https://render.invalid',fetcher);expect(res.code).toBe(403);expect(fetcher).not.toHaveBeenCalled();
    }
  });
});
