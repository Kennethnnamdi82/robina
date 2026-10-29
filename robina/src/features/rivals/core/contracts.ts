import type { AnimationState, CharacterId, QualityId } from './presentation';
export type Vector = Readonly<{ x: number; y: number }>;
export type Facing = 'down' | 'left' | 'right' | 'up';
export type ArenaStatus = 'loading' | 'playing' | 'paused' | 'error' | 'disposed';

export interface ArenaSnapshot {
  status: ArenaStatus;
  progress: number;
  elapsed: number;
  player: Vector;
  camera: Vector;
  distance: number;
  collisions: number;
  muted: boolean;
  error: string;
  characterId: CharacterId;
  quality: QualityId;
  reducedMotion: boolean;
  loadingStage: string;
  animation: AnimationState;
  animationFrame: string;
  facing: Facing;
  nearby: { id: string; name: string; description: string; active: boolean } | null;
  metrics: { startupMs: number; fps: number; p95FrameMs: number; textureBytes: number; essentialBytes: number; renderScale: number };
}

export interface SceneControls {
  pause: () => void;
  resume: () => void;
  mute: (muted: boolean) => void;
  quality?: (quality: QualityId) => void;
  reducedMotion?: (reduced: boolean) => void;
  interact?: () => void;
}

/** Future systems plug into a scene lifecycle, without accessing React or account balances. */
export interface SceneSystem {
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  speed: number;
  radius: number;
  animation: { idleFrames: number; walkFrames: number; frameSize: number };
}

/** Reserved domain boundaries. No rewards, combat, inventory or network writes in Phase 0. */
export interface RivalProfile {
  id: string;
  characterId: string;
  appearanceId: string;
}
export interface MissionDefinition { id: string; arenaId: string; title: string }
export interface InventoryItem { id: string; definitionId: string }
export interface CombatTarget { id: string; position: Vector; health: number }
export interface RankingEntry { playerId: string; rank: number; verifiedScore: number }
