import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
describe('lossless production model delivery', () => {
  it('delivers all 14 prepared models compressed without changing their decoded bytes', () => {
    expect(config.redirects).toHaveLength(14);
    let raw = 0, packed = 0;
    for (const route of config.redirects) {
      const source = readFileSync('public' + route.source);
      const compressed = readFileSync('public' + route.destination);
      expect(gunzipSync(compressed).equals(source), route.source).toBe(true);
      expect(route.permanent).toBe(false);
      const headers = config.headers.find((entry: { source: string }) => entry.source === route.destination)?.headers;
      expect(headers).toContainEqual({ key: 'Content-Encoding', value: 'gzip' });
      expect(headers).toContainEqual({ key: 'Content-Type', value: 'model/gltf-binary' });
      raw += source.length; packed += compressed.length;
    }
    expect(packed).toBeLessThan(raw * .4);
  });
  it('keeps the application fallback away from assets and backend API paths', () => {
    const pattern = new RegExp('^' + config.rewrites[0].source + '$');
    expect(pattern.test('/gaming')).toBe(true);
    expect(pattern.test('/admin/users')).toBe(true);
    expect(pattern.test('/assets/missing.glb')).toBe(false);
    expect(pattern.test('/api/auth/me')).toBe(false);
  });
});
