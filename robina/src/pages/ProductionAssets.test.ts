import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const runtimeModels = [
  '/assets/rivals/characters/universal-operative.glb',
  '/assets/rivals/city/living-city.glb',
  '/assets/rivals/city/optimized/city-blocks.glb',
  '/assets/rivals/city/optimized/street-car.glb',
  '/assets/rivals/city/premium/delivery-truck.glb',
  '/assets/rivals/combat3d/weapons/pistol.glb',
  '/assets/rivals/combat3d/weapons/rifle.glb',
  '/assets/rivals/combat3d/weapons/smg.glb',
];

describe('production model delivery', () => {
  it('serves prepared runtime models directly instead of redirecting to compressed copies', () => {
    expect(config.redirects.some((route: { source: string }) => route.source.endsWith('.glb'))).toBe(false);
    expect(config.headers.some((entry: { source: string }) => entry.source.endsWith('.glb.gz'))).toBe(false);
    for (const model of runtimeModels) expect(existsSync('public' + model), model).toBe(true);
  });
  it('redirects retired public pages to the game before downloading the application', () => {
    for (const source of ['/gaming', '/tasks', '/auto-claim', '/marketplace', '/login']) {
      expect(config.redirects).toContainEqual({ source, destination: '/', permanent: false });
    }
    for (const source of ['/missions','/profile','/rank','/settings','/customization','/leaderboards','/play']) expect(config.redirects.some((route: {source: string}) => route.source===source)).toBe(false);
    expect(config.redirects).toContainEqual({source:'/leaderboard',destination:'/leaderboards',permanent:false});
    expect(config.redirects.some((route: { source: string }) => route.source === '/' || route.source.startsWith('/admin') || route.source.startsWith('/api'))).toBe(false);
  });
  it('keeps the application fallback away from assets and backend API paths', () => {
    const pattern = new RegExp('^' + config.rewrites[0].source + '$');
    expect(pattern.test('/gaming')).toBe(true);
    expect(pattern.test('/admin/users')).toBe(true);
    expect(pattern.test('/assets/missing.glb')).toBe(false);
    expect(pattern.test('/api/auth/me')).toBe(false);
  });
});
