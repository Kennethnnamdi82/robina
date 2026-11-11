import { describe, expect, it, vi } from 'vitest';
import { adminSessionRelay } from '../../server/adminSessionRelay.js';

const response = () => ({ code: 0, headers: {} as Record<string, unknown>, data: null as unknown, setHeader(name: string, value: unknown) { this.headers[name] = value; }, status(code: number) { this.code = code; return this; }, json(data: unknown) { this.data = data; return this; } });
const headers = { host: 'rivals-heist.vercel.app', origin: 'https://rivals-heist.vercel.app', 'content-type': 'application/json', cookie: 'bd_admin=signed; tracking=secret' };

describe('shared owner session Vercel entry', () => {
  it('preserves the existing owner login, session and logout URLs and cookies', async () => {
    for (const [route, method] of [['me', 'GET'], ['login', 'POST'], ['logout', 'POST']]) {
      const res = response(), fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}', { headers: { 'Set-Cookie': 'bd_admin=signed; Domain=render.invalid; Path=/; HttpOnly; Secure; SameSite=None' } }));
      await adminSessionRelay({ url: '/api/admin/' + route, method, headers, body: {} }, res, 'https://render.invalid', fetcher);
      expect(res.code).toBe(200);
      expect(fetcher.mock.calls[0][0].href).toBe('https://render.invalid/api/admin/' + route);
      expect(fetcher.mock.calls[0][1].headers.cookie).toBe('bd_admin=signed');
      expect(res.headers['Set-Cookie']).toEqual(['bd_admin=signed; Path=/; HttpOnly; Secure; SameSite=Lax']);
      expect(res.headers['Cache-Control']).toBe('private, no-store');
    }
  });
  it('restores only explicit session paths from rewritten URLs and strips the internal parameter', async () => {
    const res = response(), fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
    await adminSessionRelay({ url: '/api/admin-session?__admin_session_route=%2Fapi%2Fadmin%2Flogin', method: 'POST', headers, body: { email: 'owner@example.test', password: 'test-only' } }, res, 'https://render.invalid', fetcher);
    expect(res.code).toBe(200);
    expect(fetcher.mock.calls[0][0].href).toBe('https://render.invalid/api/admin/login');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ email: 'owner@example.test', password: 'test-only' });
    for (const route of ['/api/auth/me', '/api/admin/bounties/withdrawals', 'https://evil.invalid/api/admin/me', '/api/admin/../auth/me']) {
      const rejected = response();
      await adminSessionRelay({ url: '/api/admin-session?__admin_session_route=' + encodeURIComponent(route), method: 'GET', headers }, rejected, 'https://render.invalid', fetcher);
      expect(rejected.code).toBe(404);
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retains the existing method and cross-origin protections', async () => {
    const fetcher = vi.fn(), method = response(), origin = response();
    await adminSessionRelay({ url: '/api/admin/me', method: 'POST', headers, body: {} }, method, 'https://render.invalid', fetcher);
    await adminSessionRelay({ url: '/api/admin/login', method: 'POST', headers: { ...headers, origin: 'https://evil.invalid' }, body: {} }, origin, 'https://render.invalid', fetcher);
    expect(method.code).toBe(405); expect(origin.code).toBe(403); expect(fetcher).not.toHaveBeenCalled();
  });
});
