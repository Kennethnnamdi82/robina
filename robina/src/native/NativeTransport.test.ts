import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('@/native/platform',()=>({isNativeAndroid:()=>true,NativeSession:{request:mock.request}}));
import {httpRequest} from '@/services/http';
beforeEach(()=>vi.resetAllMocks());afterEach(()=>vi.useRealTimers());
describe('native session transport',()=>{
 it('uses the restricted native cookie owner, never JavaScript fetch or token storage',async()=>{
  const network=vi.spyOn(globalThis,'fetch'),storage=vi.spyOn(Storage.prototype,'setItem');mock.request.mockResolvedValue({status:200,data:{user:{wallet:'existing-player'}}});
  await expect(httpRequest('/api/auth/me')).resolves.toEqual({user:{wallet:'existing-player'}});expect(mock.request).toHaveBeenCalledWith({path:'/api/auth/me',method:'GET',body:undefined,idempotencyKey:undefined});expect(network).not.toHaveBeenCalled();expect(storage).not.toHaveBeenCalled();network.mockRestore();storage.mockRestore();
 });
 it('cannot redirect the cookie bridge to another origin or an unrelated API',async()=>{
  for(const url of ['https://attacker.invalid/api/auth/me','/api/payments/intent','/api/admin/me'])await expect(httpRequest(url)).rejects.toMatchObject({status:403});expect(mock.request).not.toHaveBeenCalled();
 });
 it('preserves player bounty pagination and stable withdrawal keys but cannot expose treasury endpoints',async()=>{
  mock.request.mockResolvedValue({status:200,data:{items:[],nextBefore:null}});
  await httpRequest('/api/bounties/submissions?limit=20&before=0123456789abcdef01234567');
  expect(mock.request).toHaveBeenLastCalledWith(expect.objectContaining({path:'/api/bounties/submissions?limit=20&before=0123456789abcdef01234567',method:'GET'}));
  await httpRequest('/api/bounties/withdrawals',{method:'POST',body:'{}',headers:{'Idempotency-Key':'stable-withdrawal-key-123'}});
  expect(mock.request).toHaveBeenLastCalledWith(expect.objectContaining({path:'/api/bounties/withdrawals',method:'POST',idempotencyKey:'stable-withdrawal-key-123'}));
  await httpRequest('/api/bounties/wallet/address',{method:'PUT',body:'{}'});
  for(const path of ['/api/admin/bounties/summary','/api/admin/bounties/withdrawals/0123456789abcdef01234567/execute'])await expect(httpRequest(path,{method:'POST',body:'{}'})).rejects.toMatchObject({status:403});
 });
 it('preserves the shared timeout and abort deadline even when Android networking is pending',async()=>{
  vi.useFakeTimers();mock.request.mockReturnValue(new Promise(()=>{}));
  const promise=httpRequest('/api/auth/me',{}, {timeoutMs:25,retries:0}),assertion=expect(promise).rejects.toMatchObject({message:'request_timeout'});await vi.advanceTimersByTimeAsync(26);await assertion;
  const controller=new AbortController(),aborted=httpRequest('/api/auth/me',{}, {signal:controller.signal}),check=expect(aborted).rejects.toMatchObject({name:'AbortError'});controller.abort();await check;
 });
 it('retries temporary GET failures, but never retries logout or a definitive unauthorized session',async()=>{
  mock.request.mockResolvedValueOnce({status:503,data:{error:'service_unavailable'}}).mockResolvedValueOnce({status:200,data:{user:{wallet:'returning'}}});await expect(httpRequest('/api/auth/me')).resolves.toMatchObject({user:{wallet:'returning'}});expect(mock.request).toHaveBeenCalledTimes(2);
  mock.request.mockReset().mockResolvedValue({status:401,data:{error:'unauthenticated'}});await expect(httpRequest('/api/auth/me')).rejects.toMatchObject({status:401});expect(mock.request).toHaveBeenCalledOnce();
  mock.request.mockReset().mockResolvedValue({status:503,data:{error:'service_unavailable'}});await expect(httpRequest('/api/auth/logout',{method:'POST',body:'{}'})).rejects.toMatchObject({status:503});expect(mock.request).toHaveBeenCalledOnce();
 });
});
