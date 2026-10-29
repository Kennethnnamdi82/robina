import type { ArenaSnapshot, SceneControls, Vector } from './contracts';
import type { CharacterId, QualityId } from './presentation';

/** One bridge per mounted arena. Frame updates stay in Phaser; HUD updates are throttled. */
export class ArenaSession {
  private listeners = new Set<() => void>();
  private controls: SceneControls | null = null;
  private snapshot: ArenaSnapshot = {
    status: 'loading', progress: 0, elapsed: 0, player: { x: 288, y: 288 },
    camera: { x: 0, y: 0 }, distance: 0, collisions: 0, muted: true, error: '',
    characterId: 'vex', quality: 'balanced', reducedMotion: false, loadingStage: 'Loading game engine',
    animation: 'idle', animationFrame: 'walk/down/2', facing: 'down', nearby: null,
    metrics: { startupMs: 0, fps: 0, p95FrameMs: 0, textureBytes: 0, essentialBytes: 0, renderScale: 1 },
  };
  readonly startedAt = performance.now();
  lastLoadActivity = this.startedAt;
  constructor(options: { characterId?: CharacterId; quality?: QualityId; reducedMotion?: boolean } = {}) {
    this.snapshot = { ...this.snapshot, ...options };
  }
  movement: Vector = { x: 0, y: 0 };

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  update = (patch: Partial<ArenaSnapshot>) => {
    if (this.snapshot.status === 'disposed') return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  };
  attach(controls: SceneControls) { this.controls = controls; }
  loading(stage: string, progress = this.snapshot.progress) {
    if (this.snapshot.status !== 'loading') return;
    this.lastLoadActivity = performance.now();
    this.update({ loadingStage: stage, progress });
  }
  setQuality = (quality: QualityId) => {
    this.update({ quality }); this.controls?.quality?.(quality);
  };
  setReducedMotion = (reducedMotion: boolean) => {
    this.update({ reducedMotion }); this.controls?.reducedMotion?.(reducedMotion);
  };
  interact = () => { if (this.snapshot.status === 'playing') this.controls?.interact?.(); };
  setMovement(vector: Vector) { this.movement = this.snapshot.status === 'playing' ? vector : { x: 0, y: 0 }; }
  pause = () => {
    if (this.snapshot.status !== 'playing') return;
    this.movement = { x: 0, y: 0 };
    this.controls?.pause();
    this.update({ status: 'paused' });
  };
  resume = () => {
    if (this.snapshot.status !== 'paused') return;
    this.controls?.resume();
    this.update({ status: 'playing' });
  };
  toggleMute = () => {
    const muted = !this.snapshot.muted;
    this.controls?.mute(muted);
    this.update({ muted });
  };
  fail = (error: string) => {
    this.movement = { x: 0, y: 0 };
    this.controls?.pause();
    this.update({ status: 'error', error });
  };
  dispose() {
    this.movement = { x: 0, y: 0 };
    this.controls = null;
    this.update({ status: 'disposed' });
    this.listeners.clear();
  }
}
