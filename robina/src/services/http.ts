import {isNativeAndroid,NativeSession} from '@/native/platform';
export type ApiError = Error & { status?: number; details?: unknown };
export type RequestOptions = { signal?: AbortSignal; timeoutMs?: number; retries?: number };
function apiError(message: string, status?: number, details?: unknown): ApiError {
  return Object.assign(new Error(message), { status, details });
}
export async function httpRequest<T>(url: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  // Retrying writes can duplicate claims, purchases or admin changes.
  const retries = method === 'GET' || method === 'HEAD' ? Math.min(options.retries ?? 1, 1) : 0;
  const callerSignal = options.signal || init.signal;
  const deadline = Date.now() + (options.timeoutMs ?? 8000);
  for (let attempt = 0; ; attempt++) {
    if (callerSignal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw apiError('request_timeout');
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, remaining);
    const abort = () => controller.abort();
    callerSignal?.addEventListener('abort', abort, { once: true });
    try {
      const headers = new Headers(init.headers);
      if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'application/json');
      if(isNativeAndroid()){
        const parsed=new URL(url,'https://localhost');
        if(parsed.origin!=='https://localhost'||!['/api/auth/me','/api/auth/logout'].includes(parsed.pathname))throw apiError('This operation is available through secure browser sign-in',403);
        const response=await new Promise<{status:number;data:unknown}>((resolve,reject)=>{
          const cancelled=()=>reject(new DOMException('Request cancelled','AbortError'));
          controller.signal.addEventListener('abort',cancelled,{once:true});
          if(controller.signal.aborted){cancelled();return;}
          void NativeSession.request({path:parsed.pathname,method,body:typeof init.body==='string'?init.body:undefined}).then(value=>{controller.signal.removeEventListener('abort',cancelled);resolve(value);},error=>{controller.signal.removeEventListener('abort',cancelled);reject(error);});
        });
        if(response.status<200||response.status>=300)throw apiError(String((response.data as {error?:string})?.error||'native_request_failed'),response.status,response.data);
        return response.data as T;
      }
      const response = await fetch(url, { ...init, headers, credentials: 'include', signal: controller.signal });
      const text = await response.text();
      let data: unknown = {};
      if (text) {
        try { data = JSON.parse(text); } catch { throw apiError(response.ok ? 'invalid_json_response' : 'http_' + response.status, response.ok ? 502 : response.status); }
      } else if (response.ok && response.status !== 204) {
        throw apiError('empty_api_response', 502);
      }
      if (!response.ok) {
        const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
        throw apiError(String(payload.error || 'http_' + response.status), response.status, data);
      }
      return data as T;
    } catch (error) {
      if (callerSignal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
      if (timedOut) throw apiError('request_timeout');
      const status = (error as ApiError).status;
      const transient = status === undefined || status === 502 || status === 503 || status === 504;
      if (attempt >= retries || !transient || Date.now() >= deadline) throw error;
      // Abortable short backoff shares the original deadline, rather than starting a new timeout.
      await new Promise<void>((resolve, reject) => {
        const done = () => { clearTimeout(timer); callerSignal?.removeEventListener('abort', cancelled); resolve(); };
        const cancelled = () => { clearTimeout(timer); callerSignal?.removeEventListener('abort', cancelled); reject(new DOMException('Request cancelled', 'AbortError')); };
        const timer = setTimeout(done, Math.min(200, Math.max(0, deadline - Date.now())));
        callerSignal?.addEventListener('abort', cancelled, { once: true });
        if (callerSignal?.aborted) cancelled();
      });
    } finally {
      clearTimeout(timeout); callerSignal?.removeEventListener('abort', abort);
    }
  }
}
