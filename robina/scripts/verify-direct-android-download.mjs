// Public, signed APK delivery only. No login credentials or payment operations.
import {chromium} from '@playwright/test';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const origin='https://rivals-heist.vercel.app',path='/download/RIVALS-RIVAL-HEIST.apk';
let release,ready=false;
for(let attempt=0;attempt<30;attempt++){
  release=await(await fetch(origin+'/api/android-release?download-check='+Date.now(),{signal:AbortSignal.timeout(30000)})).json();
  const response=await fetch(origin+path+'?download-check='+Date.now(),{method:'HEAD',signal:AbortSignal.timeout(30000)});
  if(release.available&&release.downloadUrl===origin+path&&response.ok&&response.headers.get('etag')==='"'+release.sha256+'"'&&Number(response.headers.get('content-length'))===release.bytes){ready=true;break;}
  if(attempt%5===0)console.log('Waiting for matching published APK metadata and download cache');await delay(3000);
}
if(!ready)throw Error('The download and release metadata are not consistent');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:90000});
  const link=page.getByRole('link',{name:/DOWNLOAD FOR ANDROID/});await link.waitFor({timeout:180000});
  if(await link.getAttribute('href')!==origin+path)throw Error('Download button is not the RIVALS file URL');
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:90000}),link.click()]);
  if(new URL(download.url()).origin!==origin||download.suggestedFilename()!=='RIVALS-RIVAL-HEIST.apk')throw Error('Browser did not receive the expected direct APK download');
  console.log('Chrome started the direct APK download',release.version);
  const file=await download.path();if(!file||await download.failure())throw Error('Chrome download did not finish');
  const hash=createHash('sha256');let bytes=0;for await(const chunk of createReadStream(file)){hash.update(chunk);bytes+=chunk.length;}
  const sha256=hash.digest('hex');if(sha256!==release.sha256||bytes!==release.bytes)throw Error('Downloaded APK integrity mismatch');
  if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
  console.log(JSON.stringify({version:release.version,downloadUrl:download.url(),filename:download.suggestedFilename(),bytes,sha256,pageErrors:errors,noGitHubPage:true}));
}finally{await browser.close();}
