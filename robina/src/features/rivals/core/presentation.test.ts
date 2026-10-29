import { describe, expect, it } from 'vitest';
import { chooseQuality, isQuality, renderResolution } from './presentation';

describe('adaptive presentation', () => {
  it('starts conservatively on ordinary mobile and low-memory devices', () => {
    expect(chooseQuality({ cores: 8, memoryGB: 4, mobile: true, reducedMotion: false })).toBe('balanced');
    expect(chooseQuality({ cores: 4, memoryGB: 2, mobile: true, reducedMotion: false })).toBe('low');
    expect(chooseQuality({ cores: 8, memoryGB: 8, mobile: false, reducedMotion: false })).toBe('high');
    expect(chooseQuality({ cores: 8, mobile: false, reducedMotion: true })).toBe('balanced');
  });
  it('bounds high-DPI rendering cost while preserving at least CSS-pixel clarity', () => {
    expect(renderResolution(390, 844, 3, 'high')).toBe(1.5);
    expect(renderResolution(1440, 900, 2, 'high')).toBeLessThan(1.2);
    expect(renderResolution(3840, 2160, 2, 'high')).toBe(1);
    expect(renderResolution(390, 844, 3, 'balanced')).toBe(1);
    expect(isQuality('ultra')).toBe(false);
  });
});
