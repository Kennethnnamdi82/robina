import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {APK_NAME,apkAssetUrl,releaseInfo} from '../../../robina/server/androidRelease.js';

/** Public binary delivery, independent of MongoDB and player sessions. URLs
 * and response headers are fixed; never forward cookies or redirect the user. */
export function createAndroidDownloadRoutes({fetcher=fetch,readRelease=()=>releaseInfo(fetcher)}={}){
  const router=Router();let cached,until=0,pending,active=0;
  const current=async()=>{
    if(cached&&Date.now()<until)return cached;
    if(!pending)pending=Promise.resolve().then(readRelease).then(value=>{cached=value;until=Date.now()+(value.available?60000:5000);return value;}).finally(()=>{pending=undefined;});
    return pending;
  };
  const unavailable=res=>res.set('Retry-After','10').set('Cache-Control','no-store').status(503).json({error:'android_download_temporarily_unavailable'});
  const limit=rateLimit({windowMs:60*1000,limit:120,standardHeaders:true,legacyHeaders:false,skip:req=>req.method==='HEAD'});
  router.all('/android',limit,async(req,res)=>{
    if(!['GET','HEAD'].includes(req.method))return res.set('Allow','GET, HEAD').status(405).json({error:'method_not_allowed'});
    let release;try{release=await current();}catch{return unavailable(res);}
    if(!release.available)return unavailable(res);
    const etag='"'+release.sha256+'"';
    let range=req.method==='GET'&&(!req.headers['if-range']||req.headers['if-range']===etag)?req.headers.range:undefined;
    let start=0,end=release.bytes-1;
    if(range){
      const match=typeof range==='string'&&range.length<80&&range.match(/^bytes=(\d*)-(\d*)$/);
      if(match&&(match[1]||match[2])&&[match[1],match[2]].every(value=>!value||Number.isSafeInteger(Number(value)))){
        if(!match[1]){start=Math.max(0,release.bytes-Number(match[2]));}
        else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
      }else start=-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=release.bytes||end<start)
        return res.set('Content-Range',`bytes */${release.bytes}`).status(416).end();
      range=`bytes=${start}-${end}`;
    }
    const headers=(length,status)=>{
      res.status(status).set({'Content-Type':'application/vnd.android.package-archive',
        'Content-Disposition':`attachment; filename="${APK_NAME}"`,'Content-Length':String(length),
        'Accept-Ranges':'bytes','ETag':etag,'X-Content-Type-Options':'nosniff',
        'Cache-Control':'public, max-age=0, must-revalidate'});
    };
    if(req.method==='HEAD'){headers(release.bytes,200);return res.end();}
    if(active>=8)return unavailable(res);
    active++;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10*60*1000);
    const cancel=()=>{if(!res.writableFinished)controller.abort();};res.once('close',cancel);req.once('aborted',cancel);
    try{
      const upstream=await fetcher(apkAssetUrl(release.versionCode),{headers:{Accept:'application/octet-stream','Accept-Encoding':'identity',...(range?{Range:range}:{})},redirect:'follow',signal:controller.signal});
      const length=Number(upstream.headers.get('content-length'));
      if(!upstream.body||![200,206].includes(upstream.status))throw Error('asset_unavailable');
      if(upstream.status===206){
        if(!range||length!==end-start+1||upstream.headers.get('content-range')!==`bytes ${start}-${end}/${release.bytes}`)throw Error('invalid_asset_range');
        headers(length,206);res.set('Content-Range',`bytes ${start}-${end}/${release.bytes}`);
      }else{
        if(length!==release.bytes)throw Error('asset_size_mismatch');headers(length,200);
      }
      await pipeline(Readable.fromWeb(upstream.body),res,{signal:controller.signal});
    }catch{
      controller.abort();if(!res.headersSent&&!res.destroyed)unavailable(res);else if(!res.writableFinished)res.destroy();
    }finally{
      active--;clearTimeout(timer);res.removeListener('close',cancel);req.removeListener('aborted',cancel);
    }
  });
  return router;
}
