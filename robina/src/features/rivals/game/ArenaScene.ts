import Phaser from 'phaser';
import type { ArenaSession } from '../core/session';
import { TRAINING_VAULT, OPERATIVE } from '../world/trainingVault';
import { CHARACTERS } from '../characters/definitions';
import { CharacterAnimator } from '../characters/CharacterAnimator';
import { CharacterController } from '../characters/CharacterController';
import { emptyCommand } from '../input/InputBuffer';
import { GameAudio } from '../audio/GameAudio';
import { preloadVisuals, validateLoadedVisuals } from '../rendering/SceneAssets';
import { CinematicEffects } from '../rendering/CinematicEffects';
import { FrameMetrics } from '../rendering/FrameMetrics';
import { EnvironmentLayer } from '../world/EnvironmentLayer';
import { THE_LAUNCH } from '../world/level';
import { CombatSystem } from '../combat/CombatSystem';
import type { DamageEvent } from '../combat/Health';
import { simulationDelta } from './simulation';
import { AIM_HEIGHT } from '../core/presentation';
import { EnemySystem } from '../ai/EnemySystem';
import { SecuritySystem } from '../security/SecuritySystem';
import { BossSystem } from '../boss/BossSystem';

export interface RuntimeViewport { cssWidth: number; cssHeight: number; ratio: number; left: number; top: number }
export class ArenaScene extends Phaser.Scene {
  private actor!: Phaser.Physics.Arcade.Image;
  private visual!: Phaser.GameObjects.Sprite;
  private reticle!: Phaser.GameObjects.Image;
  private animator?: CharacterAnimator;
  private environment?: EnvironmentLayer;
  private effects?: CinematicEffects;
  private audio?: GameAudio;
  private combat?: CombatSystem;
  private enemies?: EnemySystem;
  private security?: SecuritySystem;
  private boss?: BossSystem;
  private worldRevision = -1;
  private introFollow = false;
  private encounterFraming = false;
  private controller = new CharacterController();
  private command = emptyCommand();
  private position = { x: TRAINING_VAULT.spawn.x as number, y: TRAINING_VAULT.spawn.y as number };
  private mouseWorld = new Phaser.Math.Vector2();
  private elapsed = 0; private distance = 0; private collisions = 0; private wasBlocked = false;
  private lastHud = 0; private lastMetrics = 0; private previousX: number = TRAINING_VAULT.spawn.x; private previousY: number = TRAINING_VAULT.spawn.y;
  private frames = new FrameMetrics();
  private released = false;
  constructor(private readonly session: ArenaSession, private viewport: RuntimeViewport) { super('rivals-arena'); }
  preload() { preloadVisuals(this, this.session); }
  create() {
    if (this.released || this.session.getSnapshot().status === 'disposed') return;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.release, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.release, this);
    if (this.session.getSnapshot().status === 'error') return;
    try { this.initialize(); } catch (error) { this.session.fail(error instanceof Error ? error.message : 'The scene could not initialize.'); }
  }
  /** The owner calls this before Game.destroy; scene events are idempotent fallbacks. */
  release() {
    if (this.released) return;
    this.released = true;
    this.audio?.dispose();
    this.scale?.off('resize', this.resize, this);
    this.physics?.world?.off(Phaser.Physics.Arcade.Events.WORLD_STEP, this.fixedStep, this);
    this.animator?.dispose(); this.boss?.dispose(); this.enemies?.dispose(); this.security?.dispose(); this.combat?.dispose(); this.effects?.dispose(); this.environment?.dispose(); this.load?.removeAllListeners();
  }
  private initialize() {
    validateLoadedVisuals(this, this.session);
    const level = THE_LAUNCH, spawn = this.session.mission.definition.spawn, preferences = this.session.getSnapshot(), width = level.width * level.tileSize, height = level.height * level.tileSize;
    this.position.x = this.previousX = spawn.x; this.position.y = this.previousY = spawn.y;
    this.physics.world.setBounds(0, 0, width, height);
    this.actor = this.physics.add.image(spawn.x, spawn.y, 'rv-character', 'walk/down/2').setOrigin(.5, 174 / 192).setVisible(false).setCollideWorldBounds(true);
    this.actor.setCircle(OPERATIVE.radius, 96 - OPERATIVE.radius, 174 - OPERATIVE.radius);
    this.visual = this.add.sprite(spawn.x, spawn.y, 'rv-character', 'walk/down/2').setOrigin(.5, 174 / 192).setDepth(spawn.y + 1);
    this.animator = new CharacterAnimator(this.visual, preferences.characterId);
    this.effects = new CinematicEffects(this, this.position, preferences.quality, preferences.reducedMotion, CHARACTERS[preferences.characterId].light);
    this.environment = new EnvironmentLayer(this, this.session, this.effects, this.position);
    this.effects.configure(preferences.quality, preferences.reducedMotion);
    this.audio = new GameAudio(preferences.settings); this.audio.playMusic();
    this.combat = new CombatSystem(this, this.session, this.controller, this.position, this.environment, this.audio, event => this.damage(event.amount, event.angle, event));
    this.security = new SecuritySystem(this,this.session,this.environment,this.position,this.audio);
    this.enemies = new EnemySystem(this,this.session,this.environment,this.combat,this.security.model);
    this.boss = new BossSystem(this,this.session,this.environment,this.combat,this.audio,event => this.damage(event.amount,event.angle,event));
    this.physics.add.collider(this.actor, this.environment.collision); this.physics.add.collider(this.actor, this.environment.solids);
    this.physics.add.collider(this.actor,this.enemies.solids);
    this.physics.add.collider(this.actor,this.boss.solids);
    this.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_STEP, this.fixedStep, this);
    this.cameras.main.setBounds(0, 0, width, height).setBackgroundColor('#080b16').startFollow(this.actor, false, .15, .15);
    this.createReticle(); this.resize(); this.scale.on('resize', this.resize, this);
    if (!preferences.reducedMotion) this.cameras.main.fadeIn(350, 4, 7, 14);
    this.session.attach({
      pause: () => {
        this.stopMovement(); this.physics.pause(); this.anims.pauseAll(); this.tweens.pauseAll();
        this.audio?.pause(true); this.effects?.pause(true); this.frames.resetClock(); this.game.loop.sleep();
      },
      resume: () => {
        this.physics.resume(); this.anims.resumeAll(); this.tweens.resumeAll(); this.effects?.pause(false);
        this.audio?.pause(false); this.frames.resetClock(); this.game.loop.resetDelta(); this.game.loop.wake();
      },
      mute: () => this.audio?.configure(this.session.getSnapshot().settings),
      quality: quality => this.effects?.configure(quality, this.session.getSnapshot().reducedMotion),
      reducedMotion: reduced => this.effects?.configure(this.session.getSnapshot().quality, reduced),
      settings: settings => this.audio?.configure(settings),
      interact: () => this.session.input.queueInteract(),
      stopMovement: () => this.stopMovement(),
      damage: (amount, angle) => this.damage(amount, angle),
      hackPad: this.security.submit, hackRetry: this.security.retry, hackClose: this.security.close,
      skipBossIntro: () => this.boss?.model.skipIntro(),
    });
    this.animator.update('idle', 'down', 0, preferences.reducedMotion);
    this.session.update({ status: 'playing', progress: 1, player: { ...spawn }, metrics: { ...this.session.getSnapshot().metrics, startupMs: performance.now() - this.session.startedAt, renderer: this.game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas' } });
    this.session.mission.start(); this.session.publishMission();
    if (document.hidden) this.session.pause();
  }
  private stopMovement() { this.controller.stop(); this.actor?.setVelocity(0, 0); }
  private damage(amount: number, angle: number, event?: DamageEvent): number {
    const taken = event ? this.controller.receiveDamage(event) : this.controller.damage(amount); if (!taken) return 0;
    this.session.mission.damage(taken);
    if (this.controller.health <= 0) this.session.mission.fail('Operative defeated.');
    // Hurt locks the controller briefly; held movement/fire should recover without a new press.
    if (this.controller.health <= 0) this.session.clearInput();
    this.actor.setVelocity(0, 0); this.audio?.effect('player_hit');
    const snapshot = this.session.getSnapshot();
    this.session.update({ health: this.controller.health, animation: this.controller.animations.state, damage: { serial: snapshot.damage.serial + 1, amount: taken, angle: Number.isFinite(angle) ? angle : 0 } });
    if (snapshot.settings.cameraShake && !snapshot.reducedMotion) this.cameras.main.shake(110, .002);
    return taken;
  }
  private fixedStep(dt: number) {
    if (this.session.getSnapshot().status !== 'playing' || this.session.getSnapshot().hack) return;
    const body = this.actor.body as Phaser.Physics.Arcade.Body, input = this.session.input;
    this.position.x = body.center.x; this.position.y = body.center.y;
    if (this.session.mission.state !== 'ACTIVE') { this.finishMission(); return; }
    this.updateMissionEvents();
    this.boss?.step(dt,this.position);
    const intro = this.boss?.model.state === 'INTRO';
    if (intro) {
      if (!this.introFollow) this.session.batch(() => { this.security?.publish(); this.boss?.publish(); this.session.publishMission(); });
      this.introFollow = true; this.stopMovement(); return;
    }
    if (this.introFollow) { this.introFollow = false; this.cameras.main.startFollow(this.actor,false,.15,.15,0,this.encounterFraming ? 64 : 0); }
    if (input.mouseActive) {
      this.cameras.main.getWorldPoint((input.mouseClientX - this.viewport.left) * this.viewport.ratio, (input.mouseClientY - this.viewport.top) * this.viewport.ratio, this.mouseWorld);
      input.setMouseAim(this.mouseWorld.x - this.position.x, this.mouseWorld.y - this.position.y + AIM_HEIGHT);
    }
    const oldDodge = this.controller.dodgeSerial;
    const interaction = this.controller.step(input.read(this.command), dt);
    if (this.controller.dodgeSerial !== oldDodge) this.audio?.effect('player_dash');
    if (interaction) {
      const security = this.security?.interact();
      if (security === 'hack') { this.stopMovement(); return; }
      if (security === 'handled') this.controller.interacted();
      const event = security ? null : this.environment?.inspect(this.controller.health);
      if (event) {
        this.controller.interacted();
        if (event.objectId === 'med-station') this.controller.vitality.heal(25);
        this.audio?.effect(event.kind === 'vault' ? 'vault_open' : event.objectId === 'training-core' ? 'core_pickup' : event.kind === 'extraction' ? 'extract_success' : 'terminal_success');
        this.updateMissionEvents();
        if (this.session.mission.state !== 'ACTIVE') { this.finishMission(); return; }
      }
    }
    this.security?.step(dt,this.controller.health > 0,event => this.damage(event.amount,event.angle,event));
    this.enemies?.step(dt,this.position,this.controller.health > 0);
    this.combat?.step(this.command, dt);
    this.session.mission.step(dt);
    this.updateMissionEvents();
    if (this.session.mission.state !== 'ACTIVE') { this.finishMission(); return; }
    this.actor.setVelocity(this.controller.vx, this.controller.vy);
    const blocked = body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down || body.touching.left || body.touching.right || body.touching.up || body.touching.down;
    if (blocked && !this.wasBlocked) this.collisions++;
    this.wasBlocked = blocked;
    this.distance += Math.hypot(this.position.x - this.previousX, this.position.y - this.previousY);
    this.previousX = this.position.x; this.previousY = this.position.y; this.elapsed += dt;
  }
  private updateMissionEvents() {
    const state = this.environment!.state, mission = this.session.mission;
    if (this.position.x > 720 && this.position.y > 500) mission.event('compound-entered');
    if (state.active.has('vault-gate') && this.position.x > 1010 && this.position.y < 410) mission.event('vault-sector-entered');
    if (this.worldRevision === state.revision) return;
    this.worldRevision = state.revision;
    for (const id of state.active) if (id !== 'extraction') mission.event(id);
    if (state.extracted) {
      this.combat?.publish();
      mission.sample(this.combat?.weapon.shots ?? 0,this.session.getSnapshot().combat.hits,this.enemies?.enemies.filter(e => !e.alive).length ?? 0);
      mission.event('extraction');
    }
  }
  private finishMission() {
    this.combat?.projectiles.clear(); this.stopMovement();
    this.session.batch(() => { this.combat?.publish(); this.enemies?.publish(); this.boss?.publish(); this.session.publishMission(); });
  }
  private resize() {
    this.encounterFraming = Boolean(this.boss?.model.active && this.viewport.cssHeight < 500 && this.viewport.cssWidth > this.viewport.cssHeight);
    const base = this.encounterFraming ? .82 : this.viewport.cssWidth < 600 ? .86 : Math.min(1.35, Math.max(1.02, this.viewport.cssWidth / 1080));
    this.cameras.main.setZoom(this.viewport.ratio * base);
    this.cameras.main.setFollowOffset(0,this.encounterFraming ? 64 : 0);
    const metrics = this.session.getSnapshot().metrics;
    if (metrics.renderScale !== this.viewport.ratio) this.session.update({ metrics: { ...metrics, renderScale: this.viewport.ratio } });
  }
  private createReticle() {
    const texture = this.textures.createCanvas('rv-reticle', 40, 40)!, ctx = texture.context;
    ctx.strokeStyle = '#a0e6ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(20, 20, 8, 0, Math.PI * 2);
    for (const offset of [-1, 1]) { ctx.moveTo(20 + offset * 11, 20); ctx.lineTo(20 + offset * 17, 20); ctx.moveTo(20, 20 + offset * 11); ctx.lineTo(20, 20 + offset * 17); }
    ctx.stroke(); texture.refresh();
    this.reticle = this.add.image(0, 0, 'rv-reticle').setDisplaySize(28, 28).setDepth(21000).setVisible(false);
  }
  update(_time: number, delta: number) {
    const snapshot = this.session.getSnapshot(); if (snapshot.status !== 'playing' || snapshot.hack || !this.actor) return;
    this.physics.world.update(_time, simulationDelta(delta));
    const framing = Boolean(this.boss?.model.active && this.viewport.cssHeight < 500 && this.viewport.cssWidth > this.viewport.cssHeight);
    if (framing !== this.encounterFraming) this.resize();
    const dt = Math.min(delta, 100) / 1000, controller = this.controller, body = this.actor.body as Phaser.Physics.Arcade.Body;
    this.position.x = body.center.x; this.position.y = body.center.y;
    this.frames.record(performance.now());
    this.animator?.update(controller.animations.state, controller.facing, this.elapsed, snapshot.reducedMotion);
    this.visual.setPosition(this.position.x, this.position.y).setDepth(this.position.y + 1).setAlpha(controller.health <= 0 ? .45 : controller.animations.state === 'hurt' ? .72 : 1);
    this.effects?.update(dt); this.environment?.update(dt); this.combat?.update(dt); this.enemies?.update(dt); this.security?.update(dt); this.boss?.update(dt);
    this.reticle.setVisible(controller.aiming && controller.health > 0);
    if (controller.aiming) {
      const mouse = this.session.input.mouseActive && !this.session.input.touchAiming;
      this.reticle.setPosition(mouse ? this.mouseWorld.x : this.position.x + Math.cos(controller.aimAngle) * 105, mouse ? this.mouseWorld.y : this.position.y - AIM_HEIGHT + Math.sin(controller.aimAngle) * 105);
    }
    this.cameras.main.setLerp(snapshot.reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 100) / 100), snapshot.reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 100) / 100));
    if (this.elapsed - this.lastMetrics >= 1) { this.lastMetrics = this.elapsed; this.session.update({ metrics: { ...this.session.getSnapshot().metrics, ...this.frames.read() } }); }
    if (this.elapsed - this.lastHud >= .1) {
      this.lastHud = this.elapsed;
      this.session.batch(() => {
        this.combat?.publish();
        this.enemies?.publish(); this.security?.publish(); this.boss?.publish();
        this.session.mission.sample(this.combat?.weapon.shots ?? 0,this.session.getSnapshot().combat.hits,this.enemies?.enemies.filter(e => !e.alive).length ?? 0);
        this.session.publishMission();
        this.session.update({ elapsed: this.elapsed, distance: this.distance, collisions: this.collisions, animation: controller.animations.state, animationFrame: String(this.visual.frame.name), facing: controller.facing,
          health: controller.health, maxHealth: controller.maxHealth, dodgeCooldown: controller.dodgeCooldown, dodgeSerial: controller.dodgeSerial, sprinting: controller.sprinting, aiming: controller.aiming, aimAngle: controller.aimAngle,
          player: { x: this.position.x, y: this.position.y }, velocity: { x: this.controller.vx, y: this.controller.vy }, camera: { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY, zoom: this.cameras.main.zoom / this.viewport.ratio, left: this.cameras.main.worldView.left, top: this.cameras.main.worldView.top } });
      });
    }
  }
}
