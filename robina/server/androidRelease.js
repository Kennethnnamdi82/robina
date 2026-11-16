export const DISTRIBUTION='Kennethnnamdi82/rivals-heist-android';
export const APK_NAME='RIVALS-RIVAL-HEIST.apk';
export const APK_URL=`https://github.com/${DISTRIBUTION}/releases/latest/download/${APK_NAME}`;
export const DIRECT_APK_URL=`https://rivals-heist.vercel.app/download/${APK_NAME}`;
export const ANDROID_CERTIFICATE='f863212a5cc6b91b7a3a92b298f087491943e1e08add0cc33b9425994dc0ab54';
export const apkAssetUrl=version=>`https://github.com/${DISTRIBUTION}/releases/download/android-${version}/${APK_NAME}`;
let cached;let until=0;
export async function releaseInfo(fetcher=fetch){
 const response=await fetcher(`https://github.com/${DISTRIBUTION}/releases/latest/download/android-release.json`,{signal:AbortSignal.timeout(10000)});
 if(!response.ok)return {available:false};
 const manifest=await response.json();
 if(manifest.applicationId!=='com.venomee.rivalsheist'||!Number.isInteger(manifest.versionCode)||manifest.versionCode<1||manifest.versionCode>2100000000||!/^[a-f0-9]{64}$/i.test(manifest.sha256)||manifest.certificateSha256!==ANDROID_CERTIFICATE||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<1000000||manifest.bytes>200*1024*1024||typeof manifest.versionName!=='string'||!/^[a-zA-Z0-9._-]{1,64}$/.test(manifest.versionName))return {available:false};
 // Use the manifest attached to the published release, not a branch CDN that
 // can keep advertising an older APK after publication. This is not a REST
 // API request. Only advertise after the actual signed release asset exists.
 const apk=await fetcher(apkAssetUrl(manifest.versionCode),{method:'HEAD',signal:AbortSignal.timeout(10000)});
 if(!apk.ok||Number(apk.headers.get('content-length'))!==manifest.bytes)return {available:false};
 // Preserve `url` for installed older apps that allowlist that exact value.
 // Current web/native clients use only the branded direct download URL.
 return{available:true,url:APK_URL,downloadUrl:DIRECT_APK_URL,version:manifest.versionName,versionCode:manifest.versionCode,bytes:manifest.bytes,minAndroid:'7.0',sha256:manifest.sha256,certificateSha256:manifest.certificateSha256};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120');
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
 if(Date.now()<until)return res.json(cached);
 try{cached=await releaseInfo();until=Date.now()+(cached.available?60000:15000);return res.json(cached);}catch{return res.json({available:false});}
}
