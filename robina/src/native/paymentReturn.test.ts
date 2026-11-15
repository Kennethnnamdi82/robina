import {afterEach,describe,it,expect,vi} from 'vitest';
import {Browser} from '@capacitor/browser';
import {handlePaymentReturn,isPaymentReturn} from './paymentReturn';
vi.mock('@capacitor/browser',()=>({Browser:{close:vi.fn().mockResolvedValue(undefined)}}));
afterEach(()=>vi.restoreAllMocks());
describe('untrusted payment return links',()=>{
  const valid='https://rivals-heist.vercel.app/store/payment-return?order=0123456789abcdef01234567';
  it('only wakes the app to check the saved server-owned order',async()=>{
    const event=vi.fn();window.addEventListener('rivals:native-resume',event);
    expect(await handlePaymentReturn(valid+'&paid=true&checkout_id=forged')).toBe(true);expect(event).toHaveBeenCalledTimes(1);expect(Browser.close).toHaveBeenCalled();window.removeEventListener('rivals:native-resume',event);
  });
  it('rejects foreign origins, credentials, invalid/ambiguous order IDs and auth URLs',()=>{
    for(const url of [valid.replace('rivals-heist.vercel.app','evil.invalid'),valid.replace('https://','https://user:pass@'),valid+'&order=another',valid+'#paid',valid.replace('0123456789abcdef01234567','forged'),valid.replace('/store/payment-return','/android/auth/callback')])expect(isPaymentReturn(url)).toBe(false);
  });
});
