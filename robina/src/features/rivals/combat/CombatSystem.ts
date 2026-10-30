import Phaser from 'phaser';
import { Health, type DamageEvent } from './Health';
import { ProjectilePool, type Damageable, type Projectile } from './ProjectilePool';
import { PULSE_CARBINE, WeaponController, type WeaponDefinition } from './weapons';
import type { CharacterController } from '../characters/CharacterController';
import type { PlayerCommand } from '../input/InputBuffer';
import type { ArenaSession } from '../core/session';
import type { EnvironmentLayer } from '../world/EnvironmentLayer';
import type { GameAudio } from '../audio/GameAudio';
import { THE_LAUNCH } from '../world/level';
import { AIM_HEIGHT } from '../core/presentation';

interface Target { health: Health; body: Damageable; image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; previous: number }
interface Impact { image: Phaser.GameObjects.Image; remaining: number }

/** Rendering adapter around pure weapon, health and continuous projectile simulation. */
export class CombatSystem {
  readonly weapon: WeaponController;
  readonly projectiles = new ProjectilePool(THE_LAUNCH.width * 64, THE_LAUNCH.height * 64);
  private targets: Target[] = [];
  private damageables: Damageable[] = [];
  private bullets: Phaser.GameObjects.Image[];
  private impacts: Impact[];
  private muzzle: Phaser.GameObjects.Image;
  private gun: Phaser.GameObjects.Image;
  private warning: Phaser.GameObjects.Text;
  private muzzleRemaining = 0;
  private emitterCooldown = .8;
  private hits = 0; private kills = 0; private hitSerial = 0;
  private emitter = THE_LAUNCH.markers.find(marker => marker.id === 'range-emitter')!;
  private playerTarget: Damageable;
  private wasAlive = true;
  onShot?: (position: { x: number; y: number }) => void;
  addTarget(target: Damageable) { this.damageables.push(target); return () => { const index = this.damageables.indexOf(target); if (index >= 0) this.damageables.splice(index, 1); }; }
  fireSecurity(owner: string, x: number, y: number, angle: number, damage: number, speed?: number) {
    const offset = speed === undefined ? 20 : 30;
    this.projectiles.spawn({ x: x + Math.cos(angle) * offset, y: y + Math.sin(angle) * offset, angle, speed: speed ?? 340, lifetime: speed === undefined ? 1.5 : 2, range: speed === undefined ? 510 : 640, damage, owner, team: 'security' });
    this.audio.effect('turret_fire');
  }

  constructor(private scene: Phaser.Scene, private session: ArenaSession, private controller: CharacterController, private actor: { x: number; y: number }, private environment: EnvironmentLayer, private audio: GameAudio, damage: (event: DamageEvent) => number, definition: WeaponDefinition = PULSE_CARBINE) {
    this.weapon = new WeaponController(definition);
    this.playerTarget = { id: 'operative', team: 'operative', x: actor.x, y: actor.y, radius: 14, alive: () => controller.health > 0, damage };
    this.damageables.push(this.playerTarget);
    for (const definition of THE_LAUNCH.targets) {
      const health = new Health(definition.health, 0);
      const body: Damageable = { ...definition, team: 'security', radius: 25, alive: () => health.current > 0, damage: event => health.damage(event) };
      const image = scene.add.image(body.x, body.y, 'rv-props', 'hologram').setOrigin(.5, .9).setDisplaySize(100, 100).setDepth(body.y);
      const label = scene.add.text(body.x, body.y - 106, 'RANGE TARGET\n100 / 100', { fontFamily: 'monospace', fontSize: '10px', color: '#96f5f4', align: 'center', lineSpacing: 4 }).setOrigin(.5).setDepth(body.y + 2);
      scene.add.ellipse(body.x, body.y + 3, 54, 24, 0x0c3e55, .2).setStrokeStyle(1, 0x4ce0e2, .65).setDepth(5);
      this.targets.push({ health, body, image, label, previous: definition.health }); this.damageables.push(body);
    }
    this.bullets = this.projectiles.entries.map(() => scene.add.image(0, 0, 'rv-pulse', 0).setDisplaySize(38, 38).setDepth(19000).setVisible(false));
    this.impacts = Array.from({ length: 16 }, () => ({ image: scene.add.image(0, 0, 'rv-muzzle', 0).setDisplaySize(40, 40).setDepth(19001).setVisible(false), remaining: 0 }));
    this.muzzle = scene.add.image(0, 0, 'rv-muzzle', 0).setDisplaySize(35, 35).setDepth(19002).setVisible(false);
    this.gun = scene.add.image(actor.x, actor.y, 'rv-carbine').setDisplaySize(42, 13).setOrigin(.32, .5);
    scene.add.image(this.emitter.x, this.emitter.y, 'rv-props', 'camera').setDisplaySize(100, 100).setOrigin(.5, .9).setDepth(this.emitter.y).setTint(0xffaa88);
    this.warning = scene.add.text(this.emitter.x + 64, this.emitter.y - 50, 'RANGE OFF', { fontFamily: 'monospace', fontSize: '10px', color: '#e6b795' }).setDepth(19000);
    this.publish();
  }
  step(command: PlayerCommand, dt: number) {
    const controller = this.controller;
    this.playerTarget.x = this.actor.x; this.playerTarget.y = this.actor.y;
    if (controller.health <= 0) {
      if (this.wasAlive) { this.projectiles.clear(); this.muzzleRemaining = 0; this.wasAlive = false; this.publish(); }
      return;
    }
    if (this.weapon.step(dt, command.fire, command.reload, controller.canAttack && !command.interact)) {
      const definition = this.weapon.definition, angle = this.weapon.shotAngle(controller.aimAngle);
      this.projectiles.spawn({ x: this.actor.x + Math.cos(angle) * 12, y: this.actor.y + Math.sin(angle) * 12, angle, speed: definition.speed, lifetime: definition.lifetime, range: definition.range, damage: definition.damage, owner: 'operative', team: 'operative' });
      controller.attacked(); this.muzzleRemaining = .075; this.audio.effect('turret_fire');
      this.onShot?.(this.actor);
    }
    if (this.environment.state.active.has('auxiliary-console')) {
      this.emitterCooldown -= dt;
      if (this.emitterCooldown <= 0) {
        this.emitterCooldown = 1.3;
        this.projectiles.spawn({ x: this.emitter.x, y: this.emitter.y - 20, angle: -Math.PI / 2, speed: 360, lifetime: 1.8, range: 640, damage: 15, owner: 'range-emitter', team: 'security' });
      }
    } else this.emitterCooldown = .8;
    this.projectiles.step(dt, this.environment.state.blockers, this.damageables, this.impact);
  }
  private impact = (shot: Projectile, taken: number, targetId: string | null) => {
    const effect = this.impacts.find(item => item.remaining <= 0) ?? this.impacts[0];
    effect.remaining = .18; effect.image.setPosition(shot.x, shot.y - (shot.owner === 'range-emitter' ? 28 : AIM_HEIGHT)).setTint(taken ? 0x8ffff4 : 0xffc68b).setVisible(true);
    if (taken > 0 && shot.team === 'operative' && targetId) {
      this.hits++; this.hitSerial++; this.audio.effect('laser_hit');
      const target = this.targets.find(item => item.body.id === targetId);
      if (target && target.health.current <= 0) this.kills++;
    }
  };
  update(dt: number) {
    const snapshot = this.session.getSnapshot(), reduced = snapshot.reducedMotion;
    const angle = this.controller.aimAngle;
    const recoil = reduced ? 0 : this.weapon.definition.recoil * Math.min(1, this.muzzleRemaining / .075);
    this.gun.setVisible(this.controller.health > 0).setPosition(this.actor.x + Math.cos(angle) * (15 - recoil), this.actor.y - AIM_HEIGHT + Math.sin(angle) * (10 - recoil)).setRotation(angle).setFlipY(Math.cos(angle) < 0).setDepth(this.actor.y + (Math.sin(angle) < -.5 ? -1 : 3));
    // Draw a new flash once even if a single rendered frame exceeds its duration.
    this.muzzle.setVisible(this.muzzleRemaining > 0 && this.controller.health > 0).setPosition(this.actor.x + Math.cos(angle) * 35, this.actor.y - AIM_HEIGHT + Math.sin(angle) * 25);
    this.muzzleRemaining = Math.max(0, this.muzzleRemaining - dt);
    for (let i = 0; i < this.projectiles.entries.length; i++) {
      const shot = this.projectiles.entries[i], image = this.bullets[i];
      image.setVisible(shot.active);
      if (shot.active) image.setPosition(shot.x, shot.y - (shot.owner === 'range-emitter' ? 28 : AIM_HEIGHT)).setRotation(shot.angle).setTint(shot.team === 'operative' ? 0x68eaff : 0xff8d83);
    }
    for (const effect of this.impacts) {
      effect.remaining = Math.max(0, effect.remaining - dt); effect.image.setVisible(effect.remaining > 0);
      if (effect.remaining > 0) effect.image.setFrame(reduced ? 1 : Math.min(7, Math.floor((.18 - effect.remaining) * 40))).setAlpha(effect.remaining / .18);
    }
    const view = this.scene.cameras.main.worldView;
    for (const target of this.targets) {
      const visible = view.contains(target.body.x, target.body.y) || view.contains(target.body.x, target.body.y - 100);
      target.image.setVisible(visible).setAlpha(target.health.current <= 0 ? .16 : 1);
      target.label.setVisible(visible);
      if (target.health.current !== target.previous) {
        target.previous = target.health.current;
        target.label.setText(target.health.current <= 0 ? 'TARGET DISABLED' : 'RANGE TARGET\n' + target.health.current + ' / ' + target.health.maximum);
        target.label.setColor(target.health.current <= 0 ? '#6d8896' : '#fff2a8');
      }
    }
    const active = this.environment.state.active.has('auxiliary-console');
    this.warning.setText(active ? 'LIVE FIRE ↑' : 'RANGE OFF').setColor(active ? '#ff887a' : '#e6b795');
  }
  publish() {
    this.session.update({ weapon: { name: this.weapon.definition.name, ammo: this.weapon.ammo, capacity: this.weapon.definition.magazine, reloading: this.weapon.reloadRemaining }, combat: { shots: this.weapon.shots, hits: this.hits, kills: this.kills, projectiles: this.projectiles.activeCount, targetHealth: this.targets.map(target => target.health.current), hitSerial: this.hitSerial } });
  }
  dispose() {
    this.onShot = undefined;
    this.projectiles.clear(); this.bullets.forEach(image => image.destroy()); this.impacts.forEach(effect => effect.image.destroy());
    this.targets.forEach(target => { target.image.destroy(); target.label.destroy(); }); this.targets.length = 0; this.damageables.length = 0;
    this.gun.destroy(); this.muzzle.destroy(); this.warning.destroy();
  }
}
