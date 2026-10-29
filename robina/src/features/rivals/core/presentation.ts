export const CHARACTER_IDS = ['vex', 'nyx', 'rook'] as const;
export type CharacterId = typeof CHARACTER_IDS[number];
export type AnimationState = 'idle' | 'walk' | 'run' | 'dash' | 'attack' | 'hurt' | 'defeat';
export type QualityId = 'high' | 'balanced' | 'low';

export const QUALITY_PRESETS = {
  high: { label: 'High', lightScale: 1, particles: 30, particleFrequency: 170, resolution: 1.5, shadows: true },
  balanced: { label: 'Balanced', lightScale: .78, particles: 12, particleFrequency: 460, resolution: 1, shadows: true },
  low: { label: 'Low', lightScale: .55, particles: 0, particleFrequency: 1000, resolution: 1, shadows: false },
} as const;

export function isQuality(value: unknown): value is QualityId {
  return value === 'high' || value === 'balanced' || value === 'low';
}

export function chooseQuality(device: { cores: number; memoryGB?: number; mobile: boolean; reducedMotion: boolean }): QualityId {
  if (device.memoryGB && device.memoryGB <= 2 || device.cores <= 2) return 'low';
  if (device.mobile || device.reducedMotion || device.cores <= 4 || device.memoryGB && device.memoryGB <= 4) return 'balanced';
  return 'high';
}

export function renderResolution(width: number, height: number, dpr: number, quality: QualityId): number {
  // Bound fill cost and render-target memory even on high-DPI / 4K displays.
  return Math.max(1, Math.min(dpr || 1, QUALITY_PRESETS[quality].resolution, Math.sqrt(1800000 / Math.max(1, width * height))));
}

const PREFERENCE_KEY = 'rivals_visual_quality_v2';
export function initialPresentation(): { quality: QualityId; reducedMotion: boolean } {
  const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const device = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { deviceMemory?: number };
  const fallback = chooseQuality({ cores: device?.hardwareConcurrency || 4, memoryGB: device?.deviceMemory, mobile: typeof innerWidth !== 'undefined' && innerWidth < 900, reducedMotion });
  try {
    const saved = localStorage.getItem(PREFERENCE_KEY);
    return { quality: isQuality(saved) ? saved : fallback, reducedMotion };
  } catch { return { quality: fallback, reducedMotion }; }
}

export function saveQuality(quality: QualityId) {
  try { localStorage.setItem(PREFERENCE_KEY, quality); } catch { /* Ephemeral preferences when browser storage is unavailable. */ }
}
