import { afterEach, expect, it, vi } from 'vitest';
import { CombatAudio } from './audio';
afterEach(() => vi.unstubAllGlobals());
it('continues silently when Web Audio is unavailable', async () => {
  vi.stubGlobal('AudioContext', undefined);
  const audio = new CombatAudio();
  await expect(audio.unlock()).resolves.toBe(false); expect(audio.muted).toBe(true);
  expect(() => { audio.shot('rifle'); audio.damage(); audio.suspend(); audio.dispose(); audio.dispose(); }).not.toThrow();
});
it('handles browser audio initialization failure', async () => {
  vi.stubGlobal('AudioContext', class { constructor() { throw new Error('blocked'); } });
  const audio = new CombatAudio();
  await expect(audio.unlock()).resolves.toBe(false); expect(audio.muted).toBe(true);
  audio.dispose(); await expect(audio.unlock()).resolves.toBe(false);
});
