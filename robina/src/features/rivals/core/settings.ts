import { initialPresentation, isQuality, type QualityId } from './presentation';

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  quality: QualityId;
  mobileControls: 'auto' | 'show' | 'hide';
  motion: 'system' | 'reduce';
  highContrast: boolean;
  cameraShake: boolean;
}

export const SETTINGS_KEY = 'rivals_settings_v1';
export function defaultSettings(): GameSettings {
  return { masterVolume: .75, musicVolume: .35, sfxVolume: .6, muted: true, quality: initialPresentation().quality, mobileControls: 'auto', motion: 'system', highContrast: false, cameraShake: true };
}

/** Read only known keys. Broken storage never prevents entering the game. */
export function sanitizeSettings(value: unknown, defaults = defaultSettings()): GameSettings {
  if (!value || typeof value !== 'object') return defaults;
  const input = value as Record<string, unknown>, result = { ...defaults };
  for (const key of ['masterVolume', 'musicVolume', 'sfxVolume'] as const) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) result[key] = Math.max(0, Math.min(1, input[key]));
  }
  for (const key of ['muted', 'highContrast', 'cameraShake'] as const) if (typeof input[key] === 'boolean') result[key] = input[key];
  if (isQuality(input.quality)) result.quality = input.quality;
  if (input.mobileControls === 'auto' || input.mobileControls === 'show' || input.mobileControls === 'hide') result.mobileControls = input.mobileControls;
  if (input.motion === 'system' || input.motion === 'reduce') result.motion = input.motion;
  return result;
}
export function loadSettings(): GameSettings {
  try { return sanitizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')); } catch { return defaultSettings(); }
}
export function persistSettings(settings: GameSettings): boolean {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings))); return true; } catch { return false; }
}
export function resolveReducedMotion(settings: GameSettings, system: boolean) { return settings.motion === 'reduce' || system; }
