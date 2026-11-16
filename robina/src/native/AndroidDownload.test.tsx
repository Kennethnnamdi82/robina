import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import AndroidDownload from './AndroidDownload';
import {releaseInfo,APK_URL,DIRECT_APK_URL,ANDROID_CERTIFICATE} from '../../server/androidRelease.js';
const manifest={applicationId:'com.venomee.rivalsheist',versionCode:1011,versionName:'1.0.1011',bytes:40000000,sha256:'a'.repeat(64),certificateSha256:ANDROID_CERTIFICATE};
beforeEach(()=>vi.restoreAllMocks());afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('real Android release availability',()=>{
 it('keeps a missing or unverified APK unavailable instead of creating a fake download',async()=>{
  expect(await releaseInfo(vi.fn().mockResolvedValue(new Response('',{status:404})))).toEqual({available:false});
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({...manifest,applicationId:'attacker.app'})));expect(await releaseInfo(fetcher)).toEqual({available:false});expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('only enables the stable official link after the actual APK has the expected size',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(manifest))).mockResolvedValueOnce(new Response(null,{headers:{'content-length':String(manifest.bytes)}}));
  expect(await releaseInfo(fetcher)).toMatchObject({available:true,url:APK_URL,downloadUrl:DIRECT_APK_URL,versionCode:1011});expect(fetcher.mock.calls[1][1].method).toBe('HEAD');
  expect(fetcher.mock.calls[0][0]).toBe('https://github.com/Kennethnnamdi82/rivals-heist-android/releases/latest/download/android-release.json');
  expect(fetcher.mock.calls[1][0]).toContain('/releases/download/android-1011/');
  const missing=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(manifest))).mockResolvedValueOnce(new Response(null,{status:404}));expect(await releaseInfo(missing)).toEqual({available:false});
 });
 it('does not render a link when no production release exists',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({available:false}))));render(<AndroidDownload/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'ANDROID RELEASE NOT AVAILABLE YET'}).hasAttribute('disabled')).toBe(true));expect(screen.queryByRole('link')).toBeNull();
 });
 it('renders the actual latest APK with version, platform and install information',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({available:true,url:APK_URL,downloadUrl:DIRECT_APK_URL,version:'1.0.1011',bytes:40000000,minAndroid:'7.0'}))));render(<AndroidDownload/>);
  const link=await screen.findByRole('link',{name:/DOWNLOAD FOR ANDROID/});expect(link.getAttribute('href')).toBe(DIRECT_APK_URL);expect(link.getAttribute('download')).toBe('RIVALS-RIVAL-HEIST.apk');expect(screen.getByText(/Android 7.0/)).toBeTruthy();expect(screen.getByText(/open Chrome Downloads/)).toBeTruthy();
 });
 it('rejects download URLs injected from another origin',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({available:true,url:'https://attacker.invalid/game.apk'}))));render(<AndroidDownload/>);
  await screen.findByRole('button',{name:'ANDROID RELEASE NOT AVAILABLE YET'});expect(screen.queryByRole('link')).toBeNull();
 });
 it('rejects an APK signed by a different publisher or a malformed release',async()=>{
  for(const invalid of [{certificateSha256:'b'.repeat(64)},{bytes:500*1024*1024},{versionName:'bad\r\nheader'}]){
   const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({...manifest,...invalid})));
   expect(await releaseInfo(fetcher)).toEqual({available:false});expect(fetcher).toHaveBeenCalledOnce();
  }
 });
});
