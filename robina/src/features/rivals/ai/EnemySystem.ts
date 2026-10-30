import Phaser from 'phaser';
import { EnemyController } from './EnemyController';
import { AI_RULES } from './definitions';
import { NavigationGrid } from './navigation';
import type { Damageable } from '../combat/ProjectilePool';
import type { CombatSystem } from '../combat/CombatSystem';
import type { ArenaSession } from '../core/session';
import type { EnvironmentLayer } from '../world/EnvironmentLayer';
import type { SecurityController } from '../security/SecurityController';
import { THE_LAUNCH } from '../world/level';
import { AIM_HEIGHT } from '../core/presentation';
interface EnemyView { model: EnemyController; sprite: Phaser.GameObjects.Sprite; caption: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Ellipse; telegraph: Phaser.GameObjects.Line; zone: Phaser.GameObjects.Zone; target: Damageable; gun: Phaser.GameObjects.Image; flash: Phaser.GameObjects.Image; lastShots: number; flashTime: number }

/** Three configured enemies; decisions/path searches are staggered, movement stays fixed-step. */
export class EnemySystem {
  readonly navigation: NavigationGrid;
  readonly enemies: EnemyController[];
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  private views: EnemyView[] = [];
  private unregister: (() => void)[] = [];
  private debug: Phaser.GameObjects.Graphics;
  private revision = -1; private budgetClock = 0; private allowed = new Set<string>();
  private context = { player: { x: 0, y: 0 }, alive: true, permitted: false, near: true };
  private occupants: EnemyController[] = [];
  constructor(private scene: Phaser.Scene, private session: ArenaSession, private environment: EnvironmentLayer, private combat: CombatSystem, private security: SecurityController) {
    this.navigation = new NavigationGrid(THE_LAUNCH.width, THE_LAUNCH.height, THE_LAUNCH.tileSize, environment.state.blockers);
    this.enemies = THE_LAUNCH.enemies.map((spawn, i) => new EnemyController(spawn, this.navigation, i * .05));
    this.solids = scene.physics.add.staticGroup();
    for (const model of this.enemies) {
      const key = model.config.art === session.getSnapshot().characterId ? 'rv-character' : 'rv-enemy-' + model.config.art;
      const sprite = scene.add.sprite(model.x, model.y, key, 'walk/down/2').setOrigin(.5,174 / 192).setScale(model.spawn.type === 'heavy' ? .76 : .64);
      const caption = scene.add.text(model.x,model.y - 122,'', { fontFamily: 'monospace', fontSize: '10px', color: '#ffc99b', align: 'center', lineSpacing: 3 }).setOrigin(.5);
      const ring = scene.add.ellipse(model.x,model.y,54,25,0x5f1919,.16).setStrokeStyle(2,model.config.tint,.7).setDepth(5);
      const telegraph = scene.add.line(0,0,0,0,0,0,0xffb44d,.8).setOrigin(0).setLineWidth(2).setDepth(19000).setVisible(false);
      const zone = scene.add.zone(model.x,model.y,36,36); scene.physics.add.existing(zone,true); (zone.body as Phaser.Physics.Arcade.StaticBody).setCircle(18); this.solids.add(zone);
      const target: Damageable = { id: model.spawn.id, team: 'security', x: model.x, y: model.y, radius: 18, alive: () => model.alive, damage: event => model.damage(event) };
      const gun = scene.add.image(model.x,model.y,'rv-carbine').setDisplaySize(38,12).setOrigin(.32,.5), flash = scene.add.image(0,0,'rv-muzzle',0).setDisplaySize(34,34).setDepth(19001).setVisible(false);
      this.unregister.push(combat.addTarget(target)); this.views.push({ model,sprite,caption,ring,telegraph,zone,target,gun,flash,lastShots: 0,flashTime: 0 });
    }
    this.debug = scene.add.graphics().setDepth(19999).setVisible(false);
    combat.onShot = point => this.enemies.forEach(enemy => enemy.hear(point));
  }
  step(dt: number, player: { x: number; y: number }, alive: boolean) {
    if (this.revision !== this.environment.state.revision) { this.revision = this.environment.state.revision; this.navigation.rebuild(); }
    this.budgetClock -= dt;
    if (this.budgetClock <= 0) {
      this.budgetClock = .2; this.allowed.clear();
      const candidates = this.enemies.filter(enemy => enemy.alive).sort((a,b) => Math.hypot(a.x - player.x,a.y - player.y) - Math.hypot(b.x - player.x,b.y - player.y));
      candidates.slice(0,AI_RULES.maximumPursuers).forEach(enemy => this.allowed.add(enemy.spawn.id));
      this.occupants.length = 0; this.occupants.push(...candidates); this.environment.state.occupants = this.occupants;
    }
    this.context.player = player; this.context.alive = alive;
    for (const view of this.views) {
      const enemy = view.model;
      if (this.security.alarmRemaining > 0) enemy.alarm(this.security.alarmSerial,this.security.alarmPosition);
      this.context.permitted = this.allowed.has(enemy.spawn.id);
      this.context.near = Math.hypot(enemy.x - player.x,enemy.y - player.y) < enemy.config.vision + 96 || this.security.alarmRemaining > 0;
      enemy.step(dt,this.context,this.shoot);
      view.target.x = enemy.x; view.target.y = enemy.y;
      const body = view.zone.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = enemy.alive;
      if (enemy.alive) { view.zone.setPosition(enemy.x,enemy.y); body.updateFromGameObject(); }
    }
  }
  private shoot = (enemy: EnemyController, angle: number) => this.combat.fireSecurity(enemy.spawn.id,enemy.x,enemy.y,angle,enemy.config.damage);
  update(dt: number) {
    const snapshot = this.session.getSnapshot(), debug = snapshot.debug && this.session.validation;
    const view = this.scene.cameras.main.worldView;
    this.debug.clear().setVisible(debug);
    for (const item of this.views) {
      const model = item.model, visible = model.x > view.left - 120 && model.x < view.right + 120 && model.y > view.top - 120 && model.y < view.bottom + 150;
      const moving = Math.hypot(model.vx,model.vy) > 1, facing = Math.abs(Math.cos(model.angle)) > Math.abs(Math.sin(model.angle)) ? Math.cos(model.angle) < 0 ? 'left' : 'right' : Math.sin(model.angle) < 0 ? 'up' : 'down';
      const frame = moving ? Math.floor(this.security.clock * 9) % 6 : 2;
      item.sprite.setPosition(model.x,model.y).setDepth(model.y + 1).setVisible(visible).setFrame(`walk/${facing}/${frame}`).setAlpha(model.hurt > 0 ? .5 : 1);
      if (!model.alive) item.sprite.setRotation(Math.min(1,model.stateAge / .45) * Math.PI / 2).setAlpha(Math.max(.18,1 - model.stateAge * 1.5));
      item.ring.setPosition(model.x,model.y + 4).setVisible(visible && model.alive);
      item.gun.setVisible(visible && model.alive).setPosition(model.x + Math.cos(model.angle) * 15,model.y - AIM_HEIGHT + Math.sin(model.angle) * 10).setRotation(model.angle).setFlipY(Math.cos(model.angle) < 0).setDepth(model.y + (Math.sin(model.angle) < -.5 ? -1 : 3));
      if (model.shots > item.lastShots) { item.lastShots = model.shots; item.flashTime = .08; }
      item.flash.setVisible(visible && model.alive && item.flashTime > 0).setPosition(model.x + Math.cos(model.angle) * 35,model.y - AIM_HEIGHT + Math.sin(model.angle) * 25); item.flashTime = Math.max(0,item.flashTime - dt);
      const warning = model.windup > 0 ? '⚠ FIRING' : model.detection > 0 && model.detection < 1 ? '? ' + Math.round(model.detection * 100) + '%' : ['CHASE','ATTACK','ALERT'].includes(model.state) ? '! ALERT' : '';
      item.caption.setVisible(visible && model.alive).setPosition(model.x,model.y - 119).setDepth(model.y + 4).setText((debug ? model.state : model.spawn.type.toUpperCase()) + '  ' + model.health.current + '/' + model.health.maximum + (warning ? '\n' + warning : ''));
      item.telegraph.setVisible(visible && model.alive && model.windup > 0);
      if (model.windup > 0) item.telegraph.setTo(model.x,model.y - AIM_HEIGHT,model.x + Math.cos(model.angle) * model.config.attackDistance,model.y - AIM_HEIGHT + Math.sin(model.angle) * model.config.attackDistance).setAlpha(snapshot.reducedMotion ? .65 : .35 + model.windup / model.config.windup * .5);
      if (debug && model.alive) {
        this.debug.lineStyle(1,0xffca72,.5).strokeCircle(model.x,model.y,model.config.vision);
        this.debug.lineBetween(model.x,model.y,model.x + Math.cos(model.angle - model.config.cone) * model.config.vision,model.y + Math.sin(model.angle - model.config.cone) * model.config.vision);
        this.debug.lineBetween(model.x,model.y,model.x + Math.cos(model.angle + model.config.cone) * model.config.vision,model.y + Math.sin(model.angle + model.config.cone) * model.config.vision);
        this.debug.lineStyle(2,0x6be9ff,.7);
        for (let i = model.pathIndex; i + 1 < model.path.length; i++) this.debug.lineBetween(model.path[i].x,model.path[i].y,model.path[i + 1].x,model.path[i + 1].y);
        this.debug.lineStyle(1,0x9bfa9e,.4); model.spawn.patrol.forEach((p,i) => this.debug.lineBetween(p.x,p.y,model.spawn.patrol[(i + 1) % model.spawn.patrol.length].x,model.spawn.patrol[(i + 1) % model.spawn.patrol.length].y));
        if (model.lastKnown) this.debug.strokeCircle(model.lastKnown.x,model.lastKnown.y,10);
      }
    }
  }
  publish() { this.session.update({ enemies: this.enemies.map(e => ({ id: e.spawn.id,type: e.spawn.type,state: e.state,x: e.x,y: e.y,health: e.health.current,maximum: e.health.maximum,detection: e.detection,shots: e.shots,deaths: e.deaths,windup: e.windup })) }); }
  dispose() { this.combat.onShot = undefined; this.unregister.forEach(remove => remove()); this.unregister.length = 0; this.solids.clear(true,true); this.views.forEach(v => { v.sprite.destroy(); v.caption.destroy(); v.ring.destroy(); v.telegraph.destroy(); v.gun.destroy(); v.flash.destroy(); }); this.debug.destroy(); this.environment.state.occupants = []; }
}
