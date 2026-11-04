import type { AnimationState, CharacterId, QualityId } from './presentation';
import type { GameSettings } from './settings';
import type { HackSnapshot } from '../security/HackPuzzle';
import type { EnemyState } from '../ai/definitions';
import type { MissionSnapshot } from '../missions/types';
import type { BossSnapshot } from '../boss/BossController';
export type Vector = Readonly<{ x: number; y: number }>;
export type Facing = 'down' | 'left' | 'right' | 'up';
export type ArenaStatus = 'loading' | 'playing' | 'paused' | 'finished' | 'error' | 'disposed';

export interface ArenaSnapshot {
  soldier?: { active: number; action: string; remaining: number; serial: number; shots: number; slots: ({ id: string; name: string; kind: string; ammo: number; reserve: number; capacity: number; reload: number } | null)[]; bombs: number; canThrow: boolean; notice: string; replacement: string | null; blocked: boolean };
  status: ArenaStatus;
  mission: MissionSnapshot | null;
  practiceSaved: boolean;
  boss: BossSnapshot | null;
  progress: number;
  elapsed: number;
  player: Vector;
  velocity: Vector;
  camera: Vector & { zoom?: number; left?: number; top?: number };
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
  settings: GameSettings;
  health: number;
  maxHealth: number;
  shield: { current: number; maximum: number } | null;
  weapon: { name: string; ammo: number | null; capacity: number | null; reloading?: number; reserve?: number } | null;
  combat: { shots: number; hits: number; kills: number; projectiles: number; targetHealth: readonly number[]; hitSerial: number };
  world: { revision: number; openDoors: readonly string[]; core: boolean; extracted: boolean; rangeActive: boolean; message: string };
  hack: HackSnapshot | null; debug: boolean;
  security: { alarm: boolean; seconds: number; source: string; serial: number; phase: string; window: number; linkRemaining: number; linked: boolean; relays: number; hacks: number; failures: number; disabled: readonly string[]; message: string };
  enemies: readonly { id: string; type: string; state: EnemyState; x: number; y: number; health: number; maximum: number; detection: number; shots: number; deaths: number; windup: number }[];
  objectiveProgress: number;
  dodgeCooldown: number;
  dodgeSerial: number;
  sprinting: boolean;
  mobileSprint: boolean;
  aiming: boolean;
  aimAngle: number;
  damage: { serial: number; amount: number; angle: number };
  metrics: { startupMs: number; fps: number; p95FrameMs: number; textureBytes: number; essentialBytes: number; renderScale: number; renderer?: 'webgl' | 'canvas' };
}

export interface SceneControls {
  pause: () => void;
  resume: () => void;
  mute: (muted: boolean) => void;
  quality?: (quality: QualityId) => void;
  reducedMotion?: (reduced: boolean) => void;
  interact?: () => void;
  settings?: (settings: GameSettings) => void;
  stopMovement?: () => void;
  damage?: (amount: number, angle: number) => void;
  hackPad?: (pad: number) => void; hackRetry?: () => void; hackClose?: (resume: boolean) => void;
  skipBossIntro?: () => void;
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

/** Reserved account/inventory/ranking boundaries; local mission rules have their own module. */
export interface RivalProfile {
  id: string;
  characterId: string;
  appearanceId: string;
}
export type { HeistMissionDefinition as MissionDefinition } from '../missions/types';
export interface InventoryItem { id: string; definitionId: string }
export interface CombatTarget { id: string; position: Vector; health: number }
export interface RankingEntry { playerId: string; rank: number; verifiedScore: number }
