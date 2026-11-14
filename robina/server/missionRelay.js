import { relay } from './authRelay.js';
import { allowedMissionMethods } from './missionPolicy.js';

export async function missionRelay(req, res, upstream = process.env.VITE_API_URL, fetcher = fetch) {
  let url;
  try { url = new URL(req.url, 'https://local.invalid'); } catch { return res.status(400).json({ error: 'invalid_request' }); }
  if (!allowedMissionMethods(url.pathname).includes(req.method)) {
    const values = url.searchParams.getAll('__mission_route');
    const candidate = values.length === 1 ? values[0] : req.query?.__mission_route;
    if (typeof candidate !== 'string' || !allowedMissionMethods(candidate).includes(req.method)) return res.status(404).json({ error: 'not_found' });
    url.pathname = candidate;
  }
  url.searchParams.delete('__mission_route');
  return relay({ url: url.pathname + url.search, method: req.method, headers: req.headers, body: req.method === 'GET' ? undefined : req.body }, res, upstream, fetcher);
}
export default function handler(req, res) { return missionRelay(req, res); }
