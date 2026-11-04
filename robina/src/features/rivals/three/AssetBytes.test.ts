import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
beforeEach(()=>vi.resetModules());afterEach(()=>vi.unstubAllGlobals());
describe('restart-safe asset bytes',()=>{
 it('deduplicates concurrent requests and reuses bytes on restart',async()=>{
  const buffer=new ArrayBuffer(8),fetcher=vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>buffer});vi.stubGlobal('fetch',fetcher);
  const {loadAssetBytes}=await import('./AssetBytes');const [a,b]=await Promise.all([loadAssetBytes('/city'),loadAssetBytes('/city')]);expect(a).toBe(buffer);expect(b).toBe(buffer);await loadAssetBytes('/city');expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('evicts a failed request so entry can retry',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:503}).mockResolvedValueOnce({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});vi.stubGlobal('fetch',fetcher);
  const {loadAssetBytes}=await import('./AssetBytes');await expect(loadAssetBytes('/city')).rejects.toThrow('503');await expect(loadAssetBytes('/city')).resolves.toBeInstanceOf(ArrayBuffer);expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('cancels only the exiting consumer, not another raid or welcome prefetch',async()=>{
  let resolve!:(value:unknown)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));const {loadAssetBytes}=await import('./AssetBytes');
  const controller=new AbortController(),first=loadAssetBytes('/city',controller.signal),second=loadAssetBytes('/city');controller.abort();const rejected=expect(first).rejects.toMatchObject({name:'AbortError'});
  resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});await rejected;await expect(second).resolves.toBeInstanceOf(ArrayBuffer);
 });
});
