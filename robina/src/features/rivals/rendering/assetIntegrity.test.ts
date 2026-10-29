// Verify the real exported files rather than mocking the asset loader.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VISUAL_MANIFEST } from '../data/visualManifest';

const root = resolve('public/assets/rivals/phase02');

describe('shipping visual assets', () => {
  it('ships every manifest URL with the exact content hash', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
    for (const file of manifest.files) {
      expect(existsSync(resolve(root, file.file)), file.file).toBe(true);
      const bytes = readFileSync(resolve(root, file.file));
      expect(bytes.length).toBe(file.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
    }
  });
  it('keeps all atlas frames integral and inside their texture dimensions', () => {
    for (const entry of [VISUAL_MANIFEST.props, VISUAL_MANIFEST.walls, ...Object.values(VISUAL_MANIFEST.characters)]) {
      const atlas = JSON.parse(readFileSync(resolve(root, entry.atlasFile), 'utf8'));
      for (const { frame } of Object.values(atlas.frames) as { frame: { x: number; y: number; w: number; h: number } }[]) {
        expect([frame.x, frame.y, frame.w, frame.h].every(Number.isInteger)).toBe(true);
        expect(frame.x + frame.w).toBeLessThanOrEqual(entry.width);
        expect(frame.y + frame.h).toBeLessThanOrEqual(entry.height);
      }
    }
    for (const entry of Object.values(VISUAL_MANIFEST.characters)) {
      const atlas = JSON.parse(readFileSync(resolve(root, entry.atlasFile), 'utf8'));
      expect(Object.keys(atlas.frames)).toHaveLength(24);
      expect(entry.pivot).toEqual({ x: .5, y: 174 / 192 });
    }
  });
});
