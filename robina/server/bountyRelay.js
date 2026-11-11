import { relay } from './authRelay.js';
import { allowedBountyMethods } from './bountyPolicy.js';

// Explicit Vite/Vercel rewrites, not framework-specific [...path] routing.
// Support both an original req.url and a runtime that exposes the rewritten URL.
export async function bountyRelay(req, res, upstream = process.env.VITE_API_URL, fetcher = fetch) {
  let url;
  try { url = new URL(req.url, 'https://local.invalid'); } catch { return res.status(400).json({ error: 'invalid_request' }); }
  if (!allowedBountyMethods(url.pathname).length) {
    const values = url.searchParams.getAll('__bounty_route');
    const candidate = values.length === 1 ? values[0] : req.query?.__bounty_route;
    if (typeof candidate !== 'string' || !allowedBountyMethods(candidate).length) return res.status(404).json({ error: 'not_found' });
    url.pathname = candidate;
  }
  url.searchParams.delete('__bounty_route');
  let body;
  try { if (req.method !== 'GET') body = req.body; } catch { return res.status(400).json({ error: 'invalid_request' }); }
  return relay({ url: url.pathname + url.search, method: req.method, headers: req.headers, body }, res, upstream, fetcher);
}
export default function handler(req, res) { return bountyRelay(req, res); }
