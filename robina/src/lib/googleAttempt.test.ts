import {beforeEach,describe,it,expect,vi} from 'vitest';
import {beginGoogleAttempt,clearGoogleAttempt,googleAttemptPending,verifyGoogleSession} from './googleAttempt';
describe('Google callback reconciliation',()=>{
  beforeEach(()=>sessionStorage.clear());
  it('retains intent across a redirect and expires abandoned attempts',()=>{beginGoogleAttempt();expect(googleAttemptPending()).toBe(true);expect(googleAttemptPending(Date.now()+600001)).toBe(false);clearGoogleAttempt();expect(googleAttemptPending()).toBe(false);});
  it('accepts an existing verified backend cookie after an exchange-response failure',async()=>{const user={wallet:'verified-user'},restore=vi.fn().mockResolvedValue({user});await expect(verifyGoogleSession(()=>Promise.reject(new Error('network response lost')),restore)).resolves.toEqual({user});expect(restore).toHaveBeenCalledOnce();});
  it('never turns a genuine rejected exchange plus missing session into success',async()=>{await expect(verifyGoogleSession(()=>Promise.reject(new Error('invalid token')),()=>Promise.reject(new Error('401')))).rejects.toThrow('invalid token');});
});
