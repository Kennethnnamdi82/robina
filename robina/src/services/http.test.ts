import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpRequest } from './http';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const json = (status = 200, data: unknown = { ok: true }) => new Response(JSON.stringify(data), { status });
const pendingFetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
  init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
}));

describe('bounded API requests', () => {
  it('sends credentials and preserves caller headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json()); vi.stubGlobal('fetch', fetchMock);
    await expect(httpRequest('/api', { method: 'POST', body: '{}', headers: { 'X-Request': 'one' } })).resolves.toEqual({ ok: true });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('X-Request')).toBe('one');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });
  it('ends a stalled connection at its deadline', async () => {
    vi.useFakeTimers(); pendingFetch.mockClear(); vi.stubGlobal('fetch', pendingFetch);
    const result = expect(httpRequest('/api', {}, { timeoutMs: 4000 })).rejects.toThrow('request_timeout');
    await vi.advanceTimersByTimeAsync(4000); await result; expect(pendingFetch).toHaveBeenCalledTimes(1);
  });
  it('keeps the timeout active while the response body stalls', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => Promise.resolve({
      ok: true, status: 200,
      text: () => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
    })));
    const result = expect(httpRequest('/api', {}, { timeoutMs: 1000 })).rejects.toThrow('request_timeout');
    await vi.advanceTimersByTimeAsync(1000); await result;
  });
  it('cancels on unmount without retrying', async () => {
    pendingFetch.mockClear(); vi.stubGlobal('fetch', pendingFetch); const controller = new AbortController();
    const result = expect(httpRequest('/api', {}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await result; expect(pendingFetch).toHaveBeenCalledTimes(1);
  });
  it('never replays purchases or other writes after failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network failure')); vi.stubGlobal('fetch', fetchMock);
    await expect(httpRequest('/api/payment', { method: 'POST', body: '{}' }, { retries: 1 })).rejects.toThrow('network failure');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('retries a transient read once within the original budget', async () => {
    vi.useFakeTimers(); const fetchMock = vi.fn().mockResolvedValueOnce(json(503, { error: 'busy' })).mockResolvedValueOnce(json());
    vi.stubGlobal('fetch', fetchMock);
    const result = expect(httpRequest('/api')).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(200); await result; expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('does not retry authentication failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, { error: 'unauthorized' })); vi.stubGlobal('fetch', fetchMock);
    await expect(httpRequest('/api')).rejects.toMatchObject({ status: 401 }); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rejects an HTML fallback served as a successful API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>app</html>')));
    await expect(httpRequest('/api', {}, { retries: 0 })).rejects.toThrow('invalid_json_response');
  });
  it('rejects empty success bodies and supports legitimate 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('')).mockResolvedValueOnce(new Response(null, { status: 204 })));
    await expect(httpRequest('/api', {}, { retries: 0 })).rejects.toThrow('empty_api_response');
    await expect(httpRequest('/api')).resolves.toEqual({});
  });
});
