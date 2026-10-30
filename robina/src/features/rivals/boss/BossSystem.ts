import Phaser from 'phaser';
import { BossController, type BossEffects } from './BossController';
import { NavigationGrid, clearSight } from '../ai/navigation';
import type { ArenaSession } from '../core/session';
import type { EnvironmentLayer } from '../world/EnvironmentLayer';
import type { CombatSystem } from '../combat/CombatSystem';
import type { DamageEvent } from '../combat/Health';
import type { GameAudio } from '../audio/GameAudio';
import { AIM_HEIGHT } from '../core/presentation';

/** Uses the existing ROOK atlas, weapon, impact assets and bounded projectile pool. */
export class BossSystem {
  readonly model: BossController; readonly solids: Phaser.Physics.Arcade.StaticGroup;
  private sprite: Phaser.GameObjects.Sprite; private ring: Phaser.GameObjects.Ellipse;
  private gun: Phaser.GameObjects.Image; private graphics: Phaser.GameObjects.Graphics; private caption: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Zone; private barrier: Phaser.GameObjects.Zone;
  private unregister: () => void; private revision = -1; private cinematic = false;
  private previousPhase = 'A'; private deadAge = 0;
  private actor = { x: 0, y: 0 };
  private previousPosition = { x: 1408, y: 224 };
  private effects: BossEffects;
  private lockdown = { id: 'guardian-lockdown', x: 1088, y: 480, width: 128, height: 64, enabled: false };
  constructor(private scene: Phaser.Scene, private session: ArenaSession, private environment: EnvironmentLayer, private combat: CombatSystem, private audio: GameAudio, private damage: (event: DamageEvent) => number) {
    environment.state.blockers.push(this.lockdown);
    const level = environment.state.level;
    this.model = new BossController(new NavigationGrid(level.width, level.height, level.tileSize, environment.state.blockers, 24));
    this.solids = scene.physics.add.staticGroup();
    const model = this.model, key = session.getSnapshot().characterId === 'rook' ? 'rv-character' : 'rv-enemy-rook';
    this.sprite = scene.add.sprite(model.x, model.y, key, 'walk/down/2').setOrigin(.5, 174 / 192).setScale(.96).setVisible(false);
    this.gun = scene.add.image(model.x, model.y, 'rv-carbine').setDisplaySize(55, 17).setOrigin(.32,.5).setVisible(false);
    this.ring = scene.add.ellipse(model.x, model.y, 84, 36, 0xffbb66,.08).setStrokeStyle(2, 0xffc476,.8).setDepth(5).setVisible(false);
    this.graphics = scene.add.graphics().setDepth(7);
    this.caption = scene.add.text(model.x, model.y - 184, 'AEGIS // GUARDIAN', { fontFamily: 'monospace', fontSize: '11px', color: '#ffcf8b', backgroundColor: '#0b111dd9', padding: { x: 8, y: 5 } }).setOrigin(.5).setDepth(19000).setVisible(false);
    this.body = scene.add.zone(model.x, model.y, 48,48); scene.physics.add.existing(this.body,true); (this.body.body as Phaser.Physics.Arcade.StaticBody).setCircle(24); this.solids.add(this.body);
    this.barrier = scene.add.zone(1088,480,128,64); scene.physics.add.existing(this.barrier,true); this.solids.add(this.barrier);
    (this.body.body as Phaser.Physics.Arcade.StaticBody).enable = false; (this.barrier.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    const target = { id: model.definition.id, team: 'security' as const, x: model.x, y: model.y, radius: 24, alive: () => model.active, damage: (event: DamageEvent) => model.damage(event) };
    this.unregister = combat.addTarget(target);
    this.effects = {
      projectile: (angle, amount, speed) => combat.fireSecurity(model.definition.id, model.x, model.y, angle, amount, speed),
      pulse: (point, radius, amount, serial) => {
        const player = this.actor;
        if (Math.hypot(player.x - point.x, player.y - point.y) <= radius + 14 && clearSight(point, player, environment.state.blockers)) this.damage({ id: 'guardian-pulse-' + serial, sourceId: model.definition.id, team: 'security', amount, angle: Math.atan2(player.y - point.y, player.x - point.x) });
        audio.effect('laser_hit');
      },
      defeated: () => {
        this.setLockdown(false); environment.state.grantFlag('guardian-defeated');
        session.mission.event('guardian-defeated'); combat.projectiles.clear(); audio.effect('vault_open'); environment.sync();
      },
    };
    this.syncTarget = () => { target.x = model.x; target.y = model.y; };
  }
  private syncTarget: () => void;
  private setLockdown(enabled: boolean) {
    this.lockdown.enabled = enabled; (this.barrier.body as Phaser.Physics.Arcade.StaticBody).enable = enabled;
    this.environment.state.revision++;
  }
  step(dt: number, actor: { x: number; y: number }) {
    this.actor = actor;
    const model = this.model, mission = this.session.mission;
    if (model.state === 'DORMANT' && actor.y < 410 && actor.x > 1150 && mission.definition.boss.prerequisites.every(id => mission.completed.has(id))) {
      model.activate(this.session.getSnapshot().reducedMotion); this.setLockdown(true); this.session.clearInput(); this.combat.projectiles.clear(); this.cinematic = true;
      this.scene.cameras.main.stopFollow();
      if (!this.session.getSnapshot().reducedMotion) this.scene.cameras.main.pan((actor.x + model.x) / 2, (actor.y + model.y) / 2, 550, 'Sine.easeInOut');
      this.audio.effect('drone_alert');
      this.publish();
    }
    if (this.revision !== this.environment.state.revision) { this.revision = this.environment.state.revision; model.navigation.rebuild(); }
    model.step(dt, actor, this.effects);
    if (this.cinematic && model.state !== 'INTRO') {
      this.cinematic = false; this.scene.cameras.main.panEffect.reset();
      // ArenaScene restores follow on the live player immediately after the intro.
    }
    const body = this.body.body as Phaser.Physics.Arcade.StaticBody; body.enable = model.active;
    if (model.active) { this.body.setPosition(model.x,model.y); body.updateFromGameObject(); }
    this.syncTarget();
    if (this.previousPhase !== model.phase) {
      this.previousPhase = model.phase; this.combat.projectiles.clear(); this.audio.effect('drone_alert');
      if (!this.session.getSnapshot().reducedMotion) this.scene.cameras.main.flash(160, 70, 40, 10);
    }
  }
  update(dt: number) {
    const model = this.model, visible = model.state !== 'DORMANT', dead = model.state === 'DEFEATED';
    const moving = Math.hypot(model.x - this.previousPosition.x,model.y - this.previousPosition.y) > .2;
    this.previousPosition.x = model.x; this.previousPosition.y = model.y;
    if (dead) this.deadAge += dt;
    const facing = Math.abs(Math.cos(model.angle)) > Math.abs(Math.sin(model.angle)) ? Math.cos(model.angle) < 0 ? 'left' : 'right' : Math.sin(model.angle) < 0 ? 'up' : 'down';
    this.sprite.setVisible(visible).setPosition(model.x,model.y).setDepth(model.y + 1).setFrame(`walk/${facing}/${moving ? Math.floor(model.clock * 7) % 6 : 2}`).setAlpha(dead ? Math.max(.12,1 - this.deadAge) : model.state === 'TRANSITION' || model.flashing ? .6 : 1);
    if (dead && !this.session.getSnapshot().reducedMotion) this.sprite.setRotation(Math.min(1,this.deadAge / .6) * Math.PI / 2);
    this.ring.setVisible(visible && !dead).setPosition(model.x,model.y + 4).setStrokeStyle(model.shielded ? 4 : 2,model.phase === 'C' ? 0xff776c : 0xffc476,.8);
    this.gun.setVisible(visible && !dead).setPosition(model.x + Math.cos(model.angle) * 18,model.y - AIM_HEIGHT + Math.sin(model.angle) * 13).setRotation(model.angle).setFlipY(Math.cos(model.angle) < 0).setDepth(model.y + 3);
    this.caption.setVisible(visible && !dead).setPosition(model.x,model.y - 180).setText(model.state === 'WINDUP' ? '⚠ ' + model.ability?.toUpperCase() : model.vulnerable ? 'VULNERABLE / FIRE' : model.state === 'TRANSITION' ? 'ARMOR SHIFT / HOLD FIRE' : 'AEGIS // GUARDIAN');
    this.graphics.clear();
    if (this.lockdown.enabled) this.graphics.lineStyle(8,0xffad71,.35).lineBetween(1024,480,1152,480).lineStyle(2,0xffe0a6,.95).lineBetween(1024,480,1152,480);
    if (model.state === 'WINDUP' || model.state === 'ACTIVE') {
      const active = model.state === 'ACTIVE', color = active ? 0xff7867 : 0xffd078;
      if (model.ability === 'pulse') {
        const radius = model.definition.abilities.pulse.radius;
        this.graphics.fillStyle(color,active ? .3 : .1).fillCircle(model.target.x,model.target.y,radius).lineStyle(3,color,.9).strokeCircle(model.target.x,model.target.y,radius);
      } else {
        const ability = model.definition.abilities[model.ability!], count = model.ability === 'burst' ? ability.count + (model.phase === 'A' ? 0 : 2) : 1;
        for (let i = 0; i < count; i++) { const angle = model.angle + (i - (count - 1) / 2) * ability.spread; this.graphics.lineStyle(model.ability === 'charge' ? 4 : 2,color,.75).lineBetween(model.x,model.y,model.x + Math.cos(angle) * 400,model.y + Math.sin(angle) * 400); }
      }
    }
  }
  publish() { this.session.update({ boss: this.model.snapshot() }); }
  dispose() {
    this.unregister(); this.lockdown.enabled = false; this.solids.clear(true,true);
    this.sprite.destroy(); this.gun.destroy(); this.ring.destroy(); this.graphics.destroy(); this.caption.destroy();
    this.scene.cameras.main.panEffect.reset();
  }
}
