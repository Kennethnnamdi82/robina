export const DISTRIBUTION='Kennethnnamdi82/rivals-heist-android';
export const APK_NAME='RIVALS-RIVAL-HEIST.apk';
export const APK_URL=`https://github.com/${DISTRIBUTION}/releases/latest/download/${APK_NAME}`;
let cached;let until=0;
export async function releaseInfo(fetcher=fetch){
 const response=await fetcher(`https://raw.githubusercontent.com/${DISTRIBUTION}/main/android-release.json`,{signal:AbortSignal.timeout(10000)});
 if(!response.ok)return {available:false};
 const manifest=await response.json();
 if(manifest.applicationId!=='com.venomee.rivalsheist'||!Number.isInteger(manifest.versionCode)||manifest.versionCode<1||manifest.versionCode>2100000000||!/^[a-f0-9]{64}$/i.test(manifest.sha256)||!/^[a-f0-9]{64}$/i.test(manifest.certificateSha256)||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<1000000||typeof manifest.versionName!=='string')return {available:false};
 // Public CDN metadata avoids GitHub's low unauthenticated REST quota. Only
 // advertise the stable URL after the actual signed release asset exists.
 const apk=await fetcher(`https://github.com/${DISTRIBUTION}/releases/download/android-${manifest.versionCode}/${APK_NAME}`,{method:'HEAD',signal:AbortSignal.timeout(10000)});
 if(!apk.ok||Number(apk.headers.get('content-length'))!==manifest.bytes)return {available:false};
 return{available:true,url:APK_URL,version:manifest.versionName.slice(0,64),versionCode:manifest.versionCode,bytes:manifest.bytes,minAndroid:'7.0',sha256:manifest.sha256,certificateSha256:manifest.certificateSha256};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120');
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
 if(Date.now()<until)return res.json(cached);
 try{cached=await releaseInfo();until=Date.now()+(cached.available?60000:15000);return res.json(cached);}catch{return res.json({available:false});}
}
