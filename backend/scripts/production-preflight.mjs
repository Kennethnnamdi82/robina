import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

process.env.NODE_ENV = 'production';
try {
  const { env } = await import('../src/config/env.js');
  const frontend = dotenv.parse(readFileSync(resolve('../robina/.env')));
  for (const key of ['VITE_API_URL', 'VITE_PRIVY_APP_ID', 'VITE_REOWN_PROJECT_ID']) {
    if (!frontend[key]?.trim()) throw new Error('Missing frontend ' + key);
  }
  if (frontend.VITE_PRIVY_APP_ID !== env.privyAppId) throw new Error('Frontend and backend Privy app IDs must match');
  const api = new URL(frontend.VITE_API_URL);
  if (api.protocol !== 'https:') throw new Error('Frontend VITE_API_URL must use HTTPS');
  const origin = new URL(env.siweUri);
  // Hosts on these separate platforms require a cross-site session cookie.
  if (api.hostname.endsWith('.onrender.com') && !origin.hostname.endsWith('.onrender.com') && env.cookieSameSite !== 'none') {
    throw new Error('A Render API on a separate frontend site requires COOKIE_SAMESITE=none and COOKIE_SECURE=true');
  }
  console.log('Production environment preflight passed. No secret values printed; no database or payment operations performed.');
} catch (error) {
  console.error('Production environment preflight failed: ' + error.message);
  process.exitCode = 1;
}
