import {appendFile} from 'node:fs/promises';
const baseline=1000+Number(process.env.GITHUB_RUN_NUMBER||1)*10+Number(process.env.GITHUB_RUN_ATTEMPT||1);
let latest=0;
const response=await fetch('https://github.com/Kennethnnamdi82/rivals-heist-android/releases/latest/download/android-release.json',{signal:AbortSignal.timeout(15000)});
if(response.ok){const value=await response.json();if(value.applicationId!=='com.venomee.rivalsheist'||!Number.isInteger(value.versionCode))throw Error('Invalid published Android version');latest=value.versionCode;}
else if(response.status!==404)throw Error('Could not verify the latest Android version — refusing a possible downgrade');
const code=Math.max(baseline,latest+1);if(code>2100000000)throw Error('Android versionCode limit reached');
await appendFile(process.env.GITHUB_ENV,`ANDROID_VERSION_CODE=${code}\nANDROID_VERSION_NAME=1.0.${code}\n`);console.log('Android versionCode',code);
