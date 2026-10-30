import type { MissionSnapshot } from './types';
export const PRACTICE_KEY = 'rivals_practice_progress_v1';
export interface PracticeProgress {
  version: 1; practiceXP: number; completions: number; best: Record<string, number>;
  unlocks: string[]; receipts: string[];
  history: { runId: string; missionId: string; mode: string; state: string; seconds: number; xp: number }[];
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const empty = (): PracticeProgress => ({ version: 1, practiceXP: 0, completions: 0, best: {}, unlocks: [], receipts: [], history: [] });
export function loadPractice(storage?: StoragePort): PracticeProgress {
  try {
    const s: unknown = JSON.parse((storage ?? localStorage).getItem(PRACTICE_KEY) ?? 'null');
    if (!s || typeof s !== 'object') return empty();
    const p = s as PracticeProgress;
    if (p.version !== 1 || !Number.isSafeInteger(p.practiceXP) || p.practiceXP < 0 || !Number.isSafeInteger(p.completions) || p.completions < 0 || !Array.isArray(p.receipts) || p.receipts.some(id => typeof id !== 'string') || !Array.isArray(p.history) || !Array.isArray(p.unlocks) || p.unlocks.some(id => typeof id !== 'string') || !p.best || typeof p.best !== 'object' || Object.values(p.best).some(t => !Number.isFinite(t) || t < 0)) return empty();
    return p;
  } catch { return empty(); }
}
/** Practice only: never posts a score, unlock, XP or money to the retired BaseDrop APIs. */
export function recordPractice(result: MissionSnapshot, storage?: StoragePort) {
  const progress = loadPractice(storage);
  if (!['SUCCESS', 'FAILED', 'ABANDONED'].includes(result.state) || progress.receipts.includes(result.runId)) return { progress, saved: true, added: false };
  progress.receipts.push(result.runId);
  if (result.state === 'SUCCESS') {
    progress.practiceXP += result.practiceXP; progress.completions++;
    const key = result.id + ':' + result.mode;
    progress.best[key] = Math.min(progress.best[key] ?? Infinity, result.elapsed);
    if (!progress.unlocks.includes('guardian-cleared')) progress.unlocks.push('guardian-cleared');
  }
  progress.history.unshift({ runId: result.runId, missionId: result.id, mode: result.mode, state: result.state, seconds: result.elapsed, xp: result.practiceXP });
  progress.history = progress.history.slice(0, 50);
  try { (storage ?? localStorage).setItem(PRACTICE_KEY, JSON.stringify(progress)); return { progress, saved: true, added: true }; }
  catch { return { progress, saved: false, added: true }; }
}
