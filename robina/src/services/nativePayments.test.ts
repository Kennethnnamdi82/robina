import {afterEach,describe,it,expect,vi} from 'vitest';
import {httpRequest} from './http';
import {NativeSession} from '@/native/platform';
vi.mock('@/native/platform',()=>({isNativeAndroid:()=>true,NativeSession:{request:vi.fn()}}));
afterEach(()=>{vi.restoreAllMocks();});
describe('Android payment transport',()=>{
  it('keeps cookies/keys out of JavaScript and forwards the stable retry key to the native session',async()=>{
    vi.mocked(NativeSession.request).mockResolvedValue({status:200,data:{id:'0123456789abcdef01234567',status:'pending'}});
    const fetcher=vi.spyOn(globalThis,'fetch');
    await httpRequest('/api/payments/checkout',{method:'POST',body:'{"sku":"mp5"}',headers:{'Idempotency-Key':'same-checkout-123456789'}});
    expect(NativeSession.request).toHaveBeenCalledWith({path:'/api/payments/checkout',method:'POST',body:'{"sku":"mp5"}',idempotencyKey:'same-checkout-123456789'});expect(fetcher).not.toHaveBeenCalled();
  });
  it('permits checking the saved order but never provider/admin/forged fulfillment calls',async()=>{
    const request=vi.mocked(NativeSession.request).mockResolvedValue({status:200,data:{status:'pending'}});
    await httpRequest('/api/payments/orders/0123456789abcdef01234567/check',{method:'POST',body:'{}'});expect(request).toHaveBeenCalled();request.mockClear();
    for(const path of ['/api/admin/payments/orders','/api/payments/bachs/webhook','/api/payments/verify','https://evil.invalid/api/payments/store'])await expect(httpRequest(path,{method:'POST',body:'{}'})).rejects.toMatchObject({status:403});
    expect(request).not.toHaveBeenCalled();
  });
});
