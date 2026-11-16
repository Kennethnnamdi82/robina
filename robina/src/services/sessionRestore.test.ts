import {afterEach,describe,expect,it,vi} from 'vitest';
import {restoreSession} from './sessionRestore';
afterEach(()=>vi.useRealTimers());
describe('durable session restoration',()=>{
  it('survives more than two rapid cold-start failures without asking for a new login',async()=>{
    vi.useFakeTimers();const read=vi.fn().mockRejectedValueOnce({status:503}).mockRejectedValueOnce({status:503}).mockRejectedValueOnce({status:502}).mockResolvedValue({user:'existing-account'});
    const result=restoreSession(read,new AbortController().signal);
    await vi.advanceTimersByTimeAsync(6000);expect(await result).toEqual({user:'existing-account'});expect(read).toHaveBeenCalledTimes(4);
  });
  it.each([401,403])('fails closed immediately on a definitive %s',async status=>{
    const read=vi.fn().mockRejectedValue({status});await expect(restoreSession(read,new AbortController().signal)).rejects.toEqual({status});expect(read).toHaveBeenCalledOnce();
  });
  it('stops retrying on unmount/logout and respects the total time budget',async()=>{
    vi.useFakeTimers();const controller=new AbortController(),read=vi.fn().mockRejectedValue({status:503});
    const cancelled=expect(restoreSession(read,controller.signal)).rejects.toMatchObject({name:'AbortError'});
    await vi.advanceTimersByTimeAsync(100);controller.abort();await cancelled;await vi.advanceTimersByTimeAsync(10000);expect(read).toHaveBeenCalledOnce();
    const deadline=expect(restoreSession(read,new AbortController().signal,1000)).rejects.toEqual({status:503});
    await vi.advanceTimersByTimeAsync(1100);await deadline;expect(read).toHaveBeenCalledTimes(3);
  });
});
