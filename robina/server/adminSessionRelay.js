import { relay } from './authRelay.js';

const sessionRoutes = new Set(['/api/admin/me', '/api/admin/login', '/api/admin/logout']);

// Consolidate only the existing owner cookie transport, not authentication.
// Explicit rewrites retain all three public URLs and the existing relay guards.
export async function adminSessionRelay(req, res, upstream = process.env.VITE_API_URL, fetcher = fetch) {
  let url;
  try { url = new URL(req.url, 'https://local.invalid'); } catch { return res.status(400).json({ error: 'invalid_request' }); }
  if (!sessionRoutes.has(url.pathname)) {
    const values = url.searchParams.getAll('__admin_session_route');
    const candidate = values.length === 1 ? values[0] : req.query?.__admin_session_route;
    if (typeof candidate !== 'string' || !sessionRoutes.has(candidate)) return res.status(404).json({ error: 'not_found' });
    url.pathname = candidate;
  }
  url.searchParams.delete('__admin_session_route');
  let body;
  try { if (req.method !== 'GET') body = req.body; } catch { return res.status(400).json({ error: 'invalid_request' }); }
  return relay({ url: url.pathname + url.search, method: req.method, headers: req.headers, body }, res, upstream, fetcher);
}
export default function handler(req, res) { return adminSessionRelay(req, res); }
