import Phaser from 'phaser';
import { assetUrl } from '../assets';
import { ArenaSession } from '../core/session';
import type { Facing } from '../core/contracts';
import { facingFor } from '../systems/movement';
import { OPERATIVE, TRAINING_VAULT } from '../world/trainingVault';
import { CHARACTERS } from '../characters/definitions';
import { CharacterAnimator } from '../characters/CharacterAnimator';
import { preloadVisuals, validateLoadedVisuals } from '../rendering/SceneAssets';
import { CinematicEffects } from '../rendering/CinematicEffects';
import { FrameMetrics } from '../rendering/FrameMetrics';
import { EnvironmentLayer } from '../world/EnvironmentLayer';

export interface RuntimeViewport { cssWidth: number; cssHeight: number; ratio: number }

export class ArenaScene extends Phaser.Scene {
  private actor!: Phaser.Physics.Arcade.Image;
  private visual!: Phaser.GameObjects.Sprite;
  private animator?: CharacterAnimator;
  private environment?: EnvironmentLayer;
  private effects?: CinematicEffects;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private music?: Phaser.Sound.BaseSound;
  private loadingAudio = false;
  private inspectRequested = false;
  private facing: Facing = 'down';
  private elapsed = 0;
  private distance = 0;
  private collisions = 0;
  private wasBlocked = false;
  private lastHud = 0;
  private lastMetrics = 0;
  private previousX: number = TRAINING_VAULT.spawn.x;
  private previousY: number = TRAINING_VAULT.spawn.y;
  private move = { x: 0, y: 0 };
  private frames = new FrameMetrics();

  constructor(private readonly session: ArenaSession, private viewport: RuntimeViewport) { super('rivals-arena'); }

  preload() { preloadVisuals(this, this.session); }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.resize, this);
      this.music?.destroy(); this.animator?.dispose(); this.effects?.dispose(); this.environment?.dispose();
      this.load.removeAllListeners();
    });
    if (this.session.getSnapshot().status === 'error') return;
    try { this.initialize(); }
    catch (error) { this.session.fail(error instanceof Error ? error.message : 'The visual scene could not be initialized.'); }
  }

  private initialize() {
    validateLoadedVisuals(this, this.session);
    const level = TRAINING_VAULT, preferences = this.session.getSnapshot();
    const width = level.width * 64, height = level.height * 64;
    this.physics.world.setBounds(0, 0, width, height);
    // The invisible physical image has a fixed foot circle. Animation has a separate owner.
    this.actor = this.physics.add.image(level.spawn.x, level.spawn.y, 'rv-character', 'walk/down/2')
      .setOrigin(.5, 174 / 192).setVisible(false).setCollideWorldBounds(true);
    this.actor.setCircle(OPERATIVE.radius, 96 - OPERATIVE.radius, 174 - OPERATIVE.radius);
    this.visual = this.add.sprite(level.spawn.x, level.spawn.y, 'rv-character', 'walk/down/2').setOrigin(.5, 174 / 192).setDepth(level.spawn.y + 1);
    this.animator = new CharacterAnimator(this.visual, preferences.characterId);
    this.effects = new CinematicEffects(this, this.actor, preferences.quality, preferences.reducedMotion, CHARACTERS[preferences.characterId].light);
    this.environment = new EnvironmentLayer(this, this.session, this.effects, this.actor);
    this.effects.configure(preferences.quality, preferences.reducedMotion);
    this.physics.add.collider(this.actor, this.environment.collision);
    this.physics.add.collider(this.actor, this.environment.solids);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E') as Record<string, Phaser.Input.Keyboard.Key>;
    // Buffer the edge: down and up may both arrive before a slow render frame.
    this.keys.E.on('down', () => { if (this.session.getSnapshot().status === 'playing') this.inspectRequested = true; });
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);
    this.cameras.main.setBounds(-96, -96, width + 192, height + 192).setBackgroundColor('#080b16');
    this.cameras.main.startFollow(this.actor, true, .15, .15);
    this.resize(); this.scale.on('resize', this.resize, this);
    if (!preferences.reducedMotion) this.cameras.main.fadeIn(420, 4, 7, 14);
    this.session.attach({
      pause: () => {
        this.inspectRequested = false;
        this.actor.setVelocity(0, 0); this.input.keyboard?.resetKeys();
        this.physics.pause(); this.anims.pauseAll(); this.tweens.pauseAll(); this.music?.pause(); this.effects?.pause(true); this.frames.resetClock();
      },
      resume: () => {
        this.input.keyboard?.resetKeys(); this.physics.resume(); this.anims.resumeAll(); this.tweens.resumeAll(); this.effects?.pause(false); this.frames.resetClock();
        if (!this.session.getSnapshot().muted) this.playMusic();
      },
      mute: muted => { if (muted) this.music?.pause(); else if (this.session.getSnapshot().status === 'playing') this.playMusic(); },
      quality: quality => this.effects?.configure(quality, this.session.getSnapshot().reducedMotion),
      reducedMotion: reduced => this.effects?.configure(this.session.getSnapshot().quality, reduced),
      interact: () => this.environment?.inspect(),
    });
    this.animator.update('idle', 'down', 0, preferences.reducedMotion);
    this.session.update({ status: 'playing', progress: 1, player: { ...level.spawn }, metrics: { ...this.session.getSnapshot().metrics, startupMs: performance.now() - this.session.startedAt } });
    if (document.hidden) this.session.pause();
  }

  private playMusic() {
    if (!this.cache.audio.exists('ambience')) {
      if (this.loadingAudio) return;
      this.loadingAudio = true;
      this.load.once('complete', () => {
        this.loadingAudio = false;
        if (!this.cache.audio.exists('ambience')) { this.session.update({ muted: true }); return; }
        if (this.session.getSnapshot().status === 'playing' && !this.session.getSnapshot().muted) this.playMusic();
      });
      this.load.audio('ambience', assetUrl('audio/neon_ambient.wav')); this.load.start(); return;
    }
    this.music ??= this.sound.add('ambience', { loop: true, volume: .18 });
    if (this.music.isPaused) this.music.resume(); else if (!this.music.isPlaying) this.music.play();
  }

  private resize() {
    const base = this.viewport.cssWidth < 600 ? .86 : Math.min(1.4, Math.max(1.05, this.viewport.cssWidth / 1050));
    this.cameras.main.setZoom(this.viewport.ratio * base);
    const metrics = this.session.getSnapshot().metrics;
    if (metrics.renderScale !== this.viewport.ratio) this.session.update({ metrics: { ...metrics, renderScale: this.viewport.ratio } });
  }

  update(_time: number, delta: number) {
    if (this.session.getSnapshot().status !== 'playing' || !this.actor) return;
    const snapshot = this.session.getSnapshot(), dt = Math.min(delta, 100) / 1000;
    this.frames.record(performance.now());
    const x = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown) + this.session.movement.x;
    const y = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown) + this.session.movement.y;
    const length = Math.hypot(x, y), divisor = Math.max(1, length);
    this.move.x = length < .12 ? 0 : x / divisor; this.move.y = length < .12 ? 0 : y / divisor;
    this.actor.setVelocity(this.move.x * OPERATIVE.speed, this.move.y * OPERATIVE.speed);
    this.facing = facingFor(this.move, this.facing);
    const animation = this.move.x || this.move.y ? 'walk' : 'idle';
    this.animator?.update(animation, this.facing, this.elapsed, snapshot.reducedMotion);
    this.visual.setPosition(this.actor.x, this.actor.y).setDepth(this.actor.y + 1);
    const body = this.actor.body as Phaser.Physics.Arcade.Body;
    const blocked = (this.move.x < 0 && body.blocked.left) || (this.move.x > 0 && body.blocked.right) || (this.move.y < 0 && body.blocked.up) || (this.move.y > 0 && body.blocked.down) || body.touching.left || body.touching.right || body.touching.up || body.touching.down;
    if (blocked && !this.wasBlocked) this.collisions++;
    this.wasBlocked = blocked;
    this.distance += Math.hypot(this.actor.x - this.previousX, this.actor.y - this.previousY);
    this.previousX = this.actor.x; this.previousY = this.actor.y; this.elapsed += dt;
    this.effects?.update(dt); this.environment?.update(dt);
    if (this.inspectRequested) { this.inspectRequested = false; this.environment?.inspect(); }
    const lerp = snapshot.reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 100) / 110);
    this.cameras.main.setLerp(lerp, lerp);
    if (this.elapsed - this.lastMetrics >= 1) {
      this.lastMetrics = this.elapsed;
      this.session.update({ metrics: { ...this.session.getSnapshot().metrics, ...this.frames.read() } });
    }
    if (this.elapsed - this.lastHud >= .1) {
      this.lastHud = this.elapsed;
      this.session.update({ elapsed: this.elapsed, distance: this.distance, collisions: this.collisions, animation, animationFrame: String(this.visual.frame.name), facing: this.facing,
        player: { x: this.actor.x, y: this.actor.y }, camera: { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY } });
    }
  }
}
