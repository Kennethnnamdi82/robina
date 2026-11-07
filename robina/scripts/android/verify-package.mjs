import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const config=JSON.parse(await readFile('android/app/src/main/assets/capacitor.config.json','utf8'));
if(config.appId!=='com.venomee.rivalsheist'||config.server?.url||config.server?.cleartext||config.android?.allowMixedContent)throw Error('Unsafe packaged Capacitor configuration');
for(const relative of ['index.html','assets/rivals/characters/universal-operative.glb','assets/rivals/combat3d/weapons/rifle.glb','assets/rivals/city/living-city.glb']){
 const source=await readFile('dist/'+relative),packaged=await readFile('android/app/src/main/assets/public/'+relative);
 if(!source.equals(packaged))throw Error('Packaged game asset mismatch: '+relative);
}
const apk=process.argv[2];if(!apk){console.log('Packaged game assets verified');process.exit(0);}
const tools=path.join(process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||'', 'build-tools','36.0.0');
const verify=spawnSync(path.join(tools,'apksigner'),['verify','--verbose','--print-certs',apk],{encoding:'utf8'});
if(verify.status!==0)throw Error('APK signature verification failed');
const certificateSha256=verify.stdout.match(/Signer #1 certificate SHA-256 digest: ([a-f0-9]{64})/i)?.[1].toLowerCase();
if(!certificateSha256||certificateSha256!==String(process.env.ANDROID_CERT_SHA256).replaceAll(':','').toLowerCase())throw Error('APK signing identity does not match the persistent release certificate');
const associations=JSON.parse(await readFile('public/.well-known/assetlinks.json','utf8'));
if(!associations.some(entry=>entry.target?.package_name==='com.venomee.rivalsheist'&&entry.relation?.includes('delegate_permission/common.handle_all_urls')&&entry.target.sha256_cert_fingerprints?.some(value=>value.replaceAll(':','').toLowerCase()===certificateSha256)))throw Error('Verified Android App Link signing identity is not configured');
const badging=spawnSync(path.join(tools,'aapt2'),['dump','badging',apk],{encoding:'utf8'});if(badging.status!==0)throw Error('Could not inspect APK metadata');
const applicationId=badging.stdout.match(/package: name='([^']+)'/)?.[1],versionCode=Number(badging.stdout.match(/versionCode='(\d+)'/)?.[1]),versionName=badging.stdout.match(/versionName='([^']+)'/)?.[1];
if(applicationId!=='com.venomee.rivalsheist'||versionCode!==Number(process.env.ANDROID_VERSION_CODE)||/application-debuggable/.test(badging.stdout))throw Error('APK is not the expected non-debug production app');
const bytes=await readFile(apk),manifest={applicationId,versionCode,versionName,bytes:bytes.length,minSdk:24,targetSdk:36,sha256:createHash('sha256').update(bytes).digest('hex'),certificateSha256,sourceCommit:process.env.GITHUB_SHA};
const {writeFile}=await import('node:fs/promises');await writeFile(path.join(path.dirname(apk),'android-release.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(path.dirname(apk),'SHA256SUMS'),manifest.sha256+'  RIVALS-RIVAL-HEIST.apk\n');console.log('Verified signed APK',JSON.stringify({applicationId,versionCode,versionName,bytes:(await stat(apk)).size,certificateSha256}));
