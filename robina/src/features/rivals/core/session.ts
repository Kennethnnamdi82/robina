import type { ArenaSnapshot, SceneControls, Vector } from './contracts';
import type { CharacterId, QualityId } from './presentation';
import { defaultSettings, type GameSettings } from './settings';
import { InputBuffer } from '../input/InputBuffer';
import type { HackSnapshot } from '../security/HackPuzzle';
import { MissionEngine } from '../missions/MissionEngine';
import { launchMission } from '../missions/definitions';
import type { HeistMissionDefinition } from '../missions/types';
import type { MissionMode } from '../missions/types';
import { recordPractice } from '../missions/progression';

/** Chrome exposes randomUUID only on HTTPS/localhost, but getRandomValues also
 * works on the private HTTP address used for phone testing. Keep UUID v4 IDs. */
function createRunId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return [hex.slice(0, 4).join(''), hex.slice(4, 6).join(''), hex.slice(6, 8).join(''), hex.slice(8, 10).join(''), hex.slice(10).join('')].join('-');
}

/** One bridge per mounted arena. Frame updates stay in Phaser; HUD updates are throttled. */
export class ArenaSession {
  private listeners = new Set<() => void>();
  private controls: SceneControls | null = null;
  private batchDepth = 0;
  private pendingNotification = false;
  private snapshot: ArenaSnapshot = {
    mission: null, boss: null, practiceSaved: true,
    status: 'loading', progress: 0, elapsed: 0, player: { x: 288, y: 288 }, velocity: { x: 0, y: 0 },
    camera: { x: 0, y: 0 }, distance: 0, collisions: 0, muted: true, error: '',
    characterId: 'vex', quality: 'balanced', reducedMotion: false, loadingStage: 'Loading game engine',
    animation: 'idle', animationFrame: 'walk/down/2', facing: 'down', nearby: null,
    settings: defaultSettings(), health: 100, maxHealth: 100, shield: null, weapon: null,
    combat: { shots: 0, hits: 0, kills: 0, projectiles: 0, targetHealth: [], hitSerial: 0 },
    world: { revision: 0, openDoors: [], core: false, extracted: false, rangeActive: false, message: 'THE LAUNCH / Explore • authorize sector access • recover the training core' },
    hack: null, debug: false, enemies: [],
    security: { alarm: false, seconds: 0, source: '', serial: 0, phase: 'OFF', window: 0, linkRemaining: 0, linked: false, relays: 0, hacks: 0, failures: 0, disabled: [], message: 'BREACH PROTOCOL / Hack • Synchronize • Unlock' },
    objectiveProgress: 0, dodgeCooldown: 0, dodgeSerial: 0, sprinting: false, mobileSprint: false, aiming: false, aimAngle: Math.PI / 2,
    damage: { serial: 0, amount: 0, angle: 0 },
    metrics: { startupMs: 0, fps: 0, p95FrameMs: 0, textureBytes: 0, essentialBytes: 0, renderScale: 1 },
  };
  readonly startedAt = performance.now();
  lastLoadActivity = this.startedAt;
  readonly input = new InputBuffer();
  readonly validation: boolean;
  readonly mission: MissionEngine;
  private resultRecorded = false;
  constructor(options: { characterId?: CharacterId; quality?: QualityId; reducedMotion?: boolean; settings?: GameSettings; validation?: boolean; missionMode?: MissionMode; missionDefinition?: HeistMissionDefinition } = {}) {
    this.validation = Boolean(options.validation);
    const settings = { ...this.snapshot.settings, ...options.settings, quality: options.quality ?? options.settings?.quality ?? this.snapshot.quality };
    this.snapshot = { ...this.snapshot, ...options, settings, quality: settings.quality, muted: settings.muted };
    this.mission = new MissionEngine(options.missionDefinition ?? launchMission(options.missionMode), createRunId(), options.missionMode);
    this.mission.prepare();
  }
  movement: Vector = { x: 0, y: 0 };

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  update = (patch: Partial<ArenaSnapshot>) => {
    if (this.snapshot.status === 'disposed') return;
    this.snapshot = { ...this.snapshot, ...patch };
    if (this.batchDepth) { this.pendingNotification = true; return; }
    this.listeners.forEach(listener => listener());
  };
  /** Publish one coherent HUD snapshot after all fixed-step adapters have sampled it. */
  batch(work: () => void) {
    this.batchDepth++;
    try { work(); }
    finally {
      this.batchDepth--;
      if (!this.batchDepth && this.pendingNotification) {
        this.pendingNotification = false; this.listeners.forEach(listener => listener());
      }
    }
  }
  attach(controls: SceneControls) { this.controls = controls; }
  loading(stage: string, progress = this.snapshot.progress) {
    if (this.snapshot.status !== 'loading') return;
    this.lastLoadActivity = performance.now();
    this.update({ loadingStage: stage, progress });
  }
  setQuality = (quality: QualityId) => {
    this.setSettings({ ...this.snapshot.settings, quality });
  };
  setSettings = (settings: GameSettings) => {
    const previous = this.snapshot;
    this.update({ settings, quality: settings.quality, muted: settings.muted });
    this.controls?.settings?.(settings);
    if (previous.quality !== settings.quality) this.controls?.quality?.(settings.quality);
    if (previous.muted !== settings.muted) this.controls?.mute(settings.muted);
    if (settings.mobileControls === 'hide') this.input.clearTouch();
  };
  setReducedMotion = (reducedMotion: boolean) => {
    this.update({ reducedMotion }); this.controls?.reducedMotion?.(reducedMotion);
  };
  interact = () => { if (this.canControl()) { if (this.controls?.interact) this.controls.interact(); else this.input.queueInteract(); } };
  canControl = () => this.snapshot.status === 'playing' && this.snapshot.health > 0 && !this.snapshot.hack && this.snapshot.boss?.state !== 'INTRO';
  skipBossIntro = () => { if (this.snapshot.status === 'playing') this.controls?.skipBossIntro?.(); };
  publishMission = () => {
    const mission = this.mission.snapshot();
    const terminal = ['SUCCESS', 'FAILED', 'ABANDONED'].includes(mission.state);
    let practiceSaved = this.snapshot.practiceSaved;
    if (terminal && !this.resultRecorded) { this.resultRecorded = true; practiceSaved = recordPractice(mission).saved; }
    this.update({ mission, practiceSaved });
    if (terminal && this.snapshot.status === 'playing') {
      this.clearInput(); this.controls?.pause(); this.update({ status: 'finished' });
    }
  };
  openHack = (hack: HackSnapshot) => { if (!this.canControl()) return; this.clearInput(); this.update({ hack }); this.controls?.pause(); };
  hackPad = (pad: number) => { if (this.snapshot.hack && this.snapshot.status === 'playing') this.controls?.hackPad?.(pad); };
  hackRetry = () => this.controls?.hackRetry?.();
  closeHack = () => this.controls?.hackClose?.(this.snapshot.status === 'playing');
  finishHack = (resume: boolean) => { this.update({ hack: null }); if (resume && this.snapshot.status === 'playing') this.controls?.resume(); };
  setDebug = (debug: boolean) => { if (this.validation) this.update({ debug }); };
  setMovement = (vector: Vector) => { this.movement = this.canControl() ? vector : { x: 0, y: 0 }; this.input.setMovement(this.movement.x, this.movement.y); };
  setAim = (vector: Vector) => { this.input.setAim(this.canControl() ? vector.x : 0, this.canControl() ? vector.y : 0); };
  dodge = () => { if (this.canControl()) this.input.queueDodge(); };
  reload = () => { if (this.canControl()) this.input.queueReload(); };
  toggleSprint = () => { if (this.canControl()) { this.input.mobileSprint = !this.input.mobileSprint; this.update({ mobileSprint: this.input.mobileSprint }); } };
  clearInput = () => { this.input.reset(); this.movement = { x: 0, y: 0 }; this.controls?.stopMovement?.(); if (this.snapshot.mobileSprint) this.update({ mobileSprint: false }); };
  applyDamage = (amount: number, angle = 0) => { if (this.canControl()) this.controls?.damage?.(amount, angle); };
  pause = () => {
    if (this.snapshot.status !== 'playing') return;
    if (this.snapshot.hack) this.controls?.hackClose?.(false);
    this.clearInput();
    this.controls?.pause();
    this.update({ status: 'paused', mobileSprint: false });
  };
  resume = () => {
    if (this.snapshot.status !== 'paused') return;
    this.controls?.resume();
    this.update({ status: 'playing' });
  };
  toggleMute = () => {
    const muted = !this.snapshot.muted;
    this.setSettings({ ...this.snapshot.settings, muted });
  };
  fail = (error: string) => {
    this.clearInput();
    this.controls?.pause();
    this.update({ status: 'error', error });
  };
  dispose() {
    if (this.snapshot.status === 'disposed') return;
    this.mission.abandon(); this.publishMission();
    this.input.reset();
    this.movement = { x: 0, y: 0 };
    this.controls = null;
    this.update({ status: 'disposed' });
    this.listeners.clear();
  }
}
