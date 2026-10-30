import type { Vector } from '../core/contracts';

export type MissionState = 'NOT_STARTED' | 'PREPARING' | 'ACTIVE' | 'SUCCESS' | 'FAILED' | 'ABANDONED';
export type ObjectiveState = 'LOCKED' | 'ACTIVE' | 'COMPLETED';
export type MissionMode = 'standard' | 'timed';
export interface MissionObjective {
  id: string; title: string; stage: string; prerequisites: readonly string[];
  event: string; optional?: boolean; marker: Vector; seconds?: number;
}
export interface HeistMissionDefinition {
  id: string; version: number; name: string; description: string; difficulty: string;
  prerequisites: readonly string[]; spawn: Vector; objectives: readonly MissionObjective[];
  timer: { seconds: number | null; warnings: readonly number[] };
  success: readonly string[]; failures: readonly ('player-down' | 'timer' | 'objective-timer')[];
  rewards: { practiceXP: number; optionalXP: number; economic: false };
  replayable: boolean; boss: { id: string; prerequisites: readonly string[]; unlock: string };
}
export interface MissionSnapshot {
  runId: string; id: string; name: string; mode: MissionMode; state: MissionState;
  elapsed: number; remaining: number | null; warning: number | null; reason: string;
  objectives: readonly (MissionObjective & { state: ObjectiveState; remaining: number | null })[];
  activeId: string | null; completed: number; mandatory: number;
  stats: { enemiesDefeated: number; damageTaken: number; shots: number; hits: number; bossDefeated: boolean };
  practiceXP: number;
}
