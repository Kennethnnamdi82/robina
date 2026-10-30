import { describe, expect, it, beforeEach } from 'vitest';
import { defaultSettings, loadSettings, persistSettings, resolveReducedMotion, sanitizeSettings, SETTINGS_KEY } from './settings';

describe('RIVALS preferences', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips real preferences without changing historical account keys', () => {
    localStorage.setItem('basedrop_balance', '123');
    const settings = { ...defaultSettings(), masterVolume: .42, muted: false, mobileControls: 'hide' as const, quality: 'low' as const };
    expect(persistSettings(settings)).toBe(true);
    expect(loadSettings()).toEqual(settings);
    expect(localStorage.getItem('basedrop_balance')).toBe('123');
  });
  it('sanitizes corrupt values and ignores unrecognized or sensitive fields', () => {
    const result = sanitizeSettings({ masterVolume: 4, musicVolume: -3, sfxVolume: NaN, muted: 'false', quality: 'invalid', mobileControls: 'invalid', jwt: 'ignore' });
    expect(result.masterVolume).toBe(1); expect(result.musicVolume).toBe(0);
    expect(result.sfxVolume).toBe(.6); expect(result.muted).toBe(true); expect(result.mobileControls).toBe('auto');
    expect(result).not.toHaveProperty('jwt');
    localStorage.setItem(SETTINGS_KEY, '{broken'); expect(loadSettings().muted).toBe(true);
  });
  it('always honors device reduced-motion preference', () => {
    expect(resolveReducedMotion(defaultSettings(), true)).toBe(true);
    expect(resolveReducedMotion({ ...defaultSettings(), motion: 'reduce' }, false)).toBe(true);
  });
});
