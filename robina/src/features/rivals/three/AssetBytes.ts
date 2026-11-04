// Keep downloaded bytes for restart, never disposed WebGL objects.
const bytes=new Map<string,Promise<ArrayBuffer>>();let retained=0;
export function loadAssetBytes(url:string,signal?:AbortSignal):Promise<ArrayBuffer>{
 if(signal?.aborted)return Promise.reject(new DOMException('Asset loading cancelled','AbortError'));
 let pending=bytes.get(url);
 if(!pending){pending=fetch(url).then(async response=>{if(!response.ok)throw Error(`Asset ${url}: HTTP ${response.status}`);const buffer=await response.arrayBuffer();retained+=buffer.byteLength;if(retained>32*1024*1024){bytes.clear();retained=buffer.byteLength;}return buffer;}).catch(error=>{bytes.delete(url);throw error;});bytes.set(url,pending);}
 return pending.then(buffer=>{if(signal?.aborted)throw new DOMException('Asset loading cancelled','AbortError');return buffer;});
}
export async function warmAssetBytes(urls:readonly string[]){let index=0;await Promise.all(Array.from({length:3},async()=>{while(index<urls.length){const url=urls[index++];try{await loadAssetBytes(url);}catch{/* Entry retries with a visible error if needed. */}}}));}
