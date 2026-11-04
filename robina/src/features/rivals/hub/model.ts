import { defaultSettings, sanitizeSettings, type GameSettings } from '../core/settings';
import { readGraphicsQuality, saveGraphicsQuality } from '../three/GraphicsChooser';
import type { POV } from '../three/CameraRig';
import type { CityWeather } from '../three/LivingCityPlan';
import type { MissionSnapshot } from '../missions/types';

export const OPERATIONS = [
  { id: 'reserve', venue: 0, code: '01', name: 'THE RESERVE', location: 'Helix Reserve · Financial district', type: 'BANK HEIST', description: 'Breach the corporate bank. Bring the vault relays online, recover the Reserve Cipher and make your extraction.', target: 'Reserve Cipher', accent: 'gold' },
  { id: 'reactor', venue: 1, code: '02', name: 'EMBER PROTOCOL', location: 'Ember Reactor · Research district', type: 'RECOVERY', description: 'Infiltrate the energy facility, shut down its security and extract with the Reactor Seed.', target: 'Reactor Seed', accent: 'ember' },
  { id: 'archive', venue: 2, code: '03', name: 'SILENT ARCHIVE', location: 'Obsidian Archive · Civic district', type: 'INTELLIGENCE', description: 'Enter the intelligence headquarters. Defeat the Guardian, secure the Archive Key and disappear into the city.', target: 'Archive Key', accent: 'ice' },
] as const;
export type OperationId = typeof OPERATIONS[number]['id'];
export interface HubPreferences extends GameSettings {
  sensitivity: number; pov: POV; lighting: CityWeather; monitor: boolean;
}
export const HUB_SETTINGS_KEY = 'rivals_hub_settings_v1';
export function defaultHubPreferences(): HubPreferences {
  return { ...defaultSettings(), quality: readGraphicsQuality(), muted: false, sensitivity: 1, pov: 'third', lighting: 'golden', monitor: false };
}
export function cleanPreferences(input: unknown): HubPreferences {
  const defaults = defaultHubPreferences();
  if (!input || typeof input !== 'object') return defaults;
  const p = input as Record<string, unknown>;
  return { ...sanitizeSettings(p, defaults),
    sensitivity: typeof p.sensitivity === 'number' && Number.isFinite(p.sensitivity) ? Math.min(2, Math.max(.4, p.sensitivity)) : 1,
    pov: ['tactical', 'side', 'third', 'first'].includes(String(p.pov)) ? p.pov as POV : 'third',
    lighting: ['golden', 'daylight', 'night'].includes(String(p.lighting)) ? p.lighting as CityWeather : 'golden',
    monitor: p.monitor === true,
  };
}
export function readPreferences(): HubPreferences {
  try { return cleanPreferences(JSON.parse(localStorage.getItem(HUB_SETTINGS_KEY) || 'null')); } catch { return defaultHubPreferences(); }
}
export function savePreferences(value: HubPreferences): boolean {
  try { localStorage.setItem(HUB_SETTINGS_KEY, JSON.stringify(cleanPreferences(value))); saveGraphicsQuality(value.quality); return true; } catch { return false; }
}

export interface HeistRecord {
  runId: string; venue: number; state: 'SUCCESS' | 'FAILED' | 'ABANDONED'; seconds: number;
  finishedAt: number; completed: number; objectives: string[]; kills: number; shots: number; hits: number;
}
export interface Dossier { version: 1; callsign: string; emblem: 'gold' | 'ice' | 'ember'; records: HeistRecord[] }
export const emptyDossier = (): Dossier => ({ version: 1, callsign: 'VEX', emblem: 'gold', records: [] });
const dossierKey = (identity: string) => 'rivals_heist_dossier_v1:' + encodeURIComponent(identity);
const bounded = (n: unknown, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
export function validRecord(r: HeistRecord): boolean {
  return Boolean(r && typeof r === 'object' && typeof r.runId === 'string' && r.runId.length > 0 && r.runId.length < 100 &&
    [0, 1, 2].includes(r.venue) && ['SUCCESS', 'FAILED', 'ABANDONED'].includes(r.state) && bounded(r.seconds, 172800) && r.seconds > 0 &&
    bounded(r.finishedAt, 8640000000000000) && Number.isInteger(r.completed) && bounded(r.completed, 10) &&
    Array.isArray(r.objectives) && r.objectives.length <= 11 && r.objectives.every(id => typeof id === 'string' && id.length < 80) &&
    Number.isInteger(r.kills) && bounded(r.kills, 10000) && Number.isInteger(r.shots) && bounded(r.shots, 1000000) &&
    Number.isInteger(r.hits) && bounded(r.hits, 1000000) && (r.state !== 'SUCCESS' || r.completed === 10));
}
export function readDossier(identity: string): Dossier {
  try {
    const value = JSON.parse(localStorage.getItem(dossierKey(identity)) || 'null');
    if (value?.version !== 1) return emptyDossier();
    return { version: 1, callsign: typeof value.callsign === 'string' && /^[a-zA-Z0-9 _-]{2,20}$/.test(value.callsign) ? value.callsign : 'VEX',
      emblem: ['gold', 'ice', 'ember'].includes(value.emblem) ? value.emblem : 'gold',
      records: Array.isArray(value.records) ? value.records.filter(validRecord).slice(0, 200) : [] };
  } catch { return emptyDossier(); }
}
export function saveDossier(identity: string, value: Dossier): boolean {
  try { localStorage.setItem(dossierKey(identity), JSON.stringify(value)); return true; } catch { return false; }
}
export function addRecord(dossier: Dossier, mission: MissionSnapshot, venue: number): Dossier {
  const record: HeistRecord = { runId: mission.runId, venue, state: mission.state as HeistRecord['state'], seconds: mission.elapsed,
    finishedAt: Date.now(), completed: mission.completed, objectives: mission.objectives.filter(o => o.state === 'COMPLETED').map(o => o.title),
    kills: mission.stats.enemiesDefeated, shots: mission.stats.shots, hits: mission.stats.hits };
  if (!validRecord(record) || dossier.records.some(r => r.runId === record.runId)) return dossier;
  return { ...dossier, records: [record, ...dossier.records].slice(0, 200) };
}
// The existing engine's hit count includes melee. Never present that count as
// firearm accuracy or discard valid knife-only runs for having hits > shots.
export const runScore = (r: HeistRecord) => r.state === 'SUCCESS' ? 1000 + Math.max(0, 600 - Math.floor(r.seconds)) + Math.min(500, r.kills * 25) : 0;
export const RANKS = [
  { name: 'RECRUIT', points: 0 }, { name: 'RUNNER', points: 1500 }, { name: 'ENFORCER', points: 5000 },
  { name: 'SPECIALIST', points: 12000 }, { name: 'ELITE', points: 25000 }, { name: 'LEGEND', points: 50000 },
] as const;
export function dossierStats(dossier: Dossier) {
  const wins = dossier.records.filter(r => r.state === 'SUCCESS');
  const score = wins.reduce((total, r) => total + runScore(r), 0);
  const rankIndex = RANKS.reduce((at, rank, i) => score >= rank.points ? i : at, 0);
  const shots = dossier.records.reduce((n, r) => n + r.shots, 0), hits = dossier.records.reduce((n, r) => n + r.hits, 0);
  return { wins: wins.length, attempts: dossier.records.length, score, rankIndex, rank: RANKS[rankIndex], next: RANKS[rankIndex + 1],
    best: wins.length ? Math.min(...wins.map(r => r.seconds)) : null, shots, hits,
    kills: dossier.records.reduce((n, r) => n + r.kills, 0), successRate: dossier.records.length ? Math.round(wins.length / dossier.records.length * 100) : 0 };
}
export const formatTime = (seconds: number | null) => seconds === null ? '—' : `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

// Deliberately fictional UI fixtures, never mixed into the player's local record.
export const PREVIEW_STANDINGS = [
  { callsign: 'NIGHTFALL', wins: 42, score: 78940, best: 164, emblem: 'gold' },
  { callsign: 'GHOSTLINE', wins: 38, score: 71120, best: 157, emblem: 'ice' },
  { callsign: 'VANTA', wins: 35, score: 65850, best: 181, emblem: 'ember' },
  { callsign: 'ONYX', wins: 31, score: 57900, best: 175, emblem: 'ice' },
  { callsign: 'SILHOUETTE', wins: 28, score: 52180, best: 192, emblem: 'gold' },
  { callsign: 'DEADLETTER', wins: 24, score: 44700, best: 201, emblem: 'ember' },
];
