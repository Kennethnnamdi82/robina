import Phaser from 'phaser';
import { floorFrame } from './trainingVault';
import { THE_LAUNCH, solidTile, type WorldObject } from './level';
import { WorldState, type InteractionEvent } from './WorldState';
import { GroundLayer } from './GroundLayer';
import type { ArenaSession } from '../core/session';
import type { SceneSystem } from '../core/contracts';
import type { CinematicEffects } from '../rendering/CinematicEffects';

/** Independent render, collision, decoration and interaction layers from one definition. */
export class EnvironmentLayer implements SceneSystem {
  readonly collision: Phaser.Tilemaps.TilemapLayer;
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  readonly state = new WorldState(THE_LAUNCH);
  private focus: WorldObject | null = null;
  private doors = new Map<string, { image: Phaser.GameObjects.Image; zone: Phaser.GameObjects.Zone; open: boolean; y: number }>();
  private vault?: { image: Phaser.GameObjects.Image; zone: Phaser.GameObjects.Zone; open: boolean; y: number };
  private vaultLabel: Phaser.GameObjects.Text;
  private revision = -1;
  private collectibles = new Map<string, Phaser.GameObjects.Image>();
  private culled: Phaser.GameObjects.Image[] = [];
  private inspectElapsed = 0;
  private highlight: Phaser.GameObjects.Image;
  private map: Phaser.Tilemaps.Tilemap;
  private ground: GroundLayer;

  constructor(private scene: Phaser.Scene, private session: ArenaSession, private effects: CinematicEffects, private actor: { x: number; y: number }) {
    const level = THE_LAUNCH, { width, height } = level;
    const data = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => floorFrame(x, y)));
    const map = this.map = scene.make.tilemap({ data, tileWidth: 128, tileHeight: 128 });
    const tiles = map.addTilesetImage('neon', 'rv-floor', 128, 128)!;
    this.ground = new GroundLayer(scene);
    this.collision = map.createBlankLayer('collision', tiles, 0, 0)!.setScale(.5).setVisible(false);
    this.solids = scene.physics.add.staticGroup();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!solidTile(level, x, y)) continue;
      this.collision.putTileAt(0, x, y);
      const wall = (cx: number, cy: number) => solidTile(level, cx, cy);
      const north = wall(x, y - 1), south = wall(x, y + 1), east = wall(x + 1, y), west = wall(x - 1, y);
      const count = Number(north) + Number(south) + Number(east) + Number(west);
      const frame = count >= 3 ? 'junction' : count === 1 ? 'end' : (north || south) && (east || west) ? 'corner' : north && south ? 'vertical' : (x + y) % 9 === 0 ? 'lamp' : (x + y) % 13 === 0 ? 'vent' : (x + y) % 7 === 0 ? 'glass' : 'horizontal';
      this.culled.push(scene.add.image(x * 64 + 32, y * 64 + 60, 'rv-walls', frame).setOrigin(.5, 238 / 256).setDisplaySize(77, 104).setDepth(y * 64 + 60));
      if (frame === 'lamp') effects.addLight(`wall-${x}-${y}`, x * 64 + 32, y * 64 + 47, 0xffb455, 155, .3);
    }
    this.collision.setCollision(0);
    for (const zone of level.zones) scene.add.rectangle(zone.x, zone.y, zone.width, zone.height, zone.color, .12).setStrokeStyle(1, zone.color, .4).setDepth(1);
    for (const prop of level.props) {
      const image = scene.add.image(prop.x, prop.y, 'rv-props', prop.frame).setOrigin(.5, 230 / 256).setDisplaySize(prop.size, prop.size).setDepth(prop.y);
      if (prop.id !== 'vault') this.culled.push(image);
      effects.addShadow(prop.x, prop.y, prop.size * .8);
      const zone = prop.solid ? this.body(prop.x, prop.y + 5, prop.solid.width, prop.solid.height) : null;
      if (prop.id === 'vault' && zone) this.vault = { image,zone,open: false,y: image.y };
      if (prop.light) effects.addLight(prop.id, prop.x, prop.y - 30, prop.light, prop.id === 'vault' ? 290 : 210, prop.id === 'vault' ? .5 : .35, Boolean(prop.inspect));
    }
    for (const object of level.objects) {
      if (!object.frame) continue;
      const image = scene.add.image(object.x, object.y, 'rv-props', object.frame).setOrigin(.5, 230 / 256).setDisplaySize(object.size!, object.size!).setDepth(object.y);
      if (object.kind === 'door') {
        if (object.id === 'transit-door') image.setDisplaySize(76, 180).setOrigin(.5, .82).setPosition(object.x, object.y + 42);
        this.doors.set(object.id, { image, zone: this.body(object.x, object.y, object.width!, object.height!), open: false, y: image.y });
      } else if (object.kind === 'collectible') this.collectibles.set(object.id, image);
      if (object.solid) this.body(object.x,object.y + 5,object.solid.width,object.solid.height);
      effects.addLight(object.id, object.x, object.y - 25, object.kind === 'extraction' ? 0x49e6b1 : 0x43c9ef, 160, .24, true);
    }
    for (const sign of level.signs) scene.add.text(sign.x, sign.y, sign.text, { fontFamily: 'monospace', fontSize: sign.size + 'px', color: sign.color, align: 'center', lineSpacing: 5, letterSpacing: 1 }).setOrigin(.5).setDepth(5);
    this.highlight = scene.add.image(0, 0, 'rv-props', 'hologram').setOrigin(.5, .9).setDisplaySize(45, 45).setAlpha(.55).setVisible(false);
    const vault = level.objects.find(object => object.id === 'vault')!;
    this.vaultLabel = scene.add.text(vault.x,vault.y + 44,'VAULT SEALED', { fontFamily: 'monospace',fontSize: '10px',color: '#ffd184',align: 'center',backgroundColor: '#08121fe8',padding: { x: 8,y: 5 } }).setOrigin(.5).setDepth(19000);
  }
  private body(x: number, y: number, width: number, height: number) {
    const zone = this.scene.add.zone(x, y, width, height);
    this.scene.physics.add.existing(zone, true); this.solids.add(zone); return zone;
  }
  inspect(health: number): InteractionEvent | null {
    this.focus = this.state.nearest(this.actor); if (!this.focus) return null;
    const event = this.state.interact(this.focus, this.actor, health);
    if (event) {
      this.effects.activate(event.objectId, event.active);
      if (event.objectId === 'insertion-uplink' && event.active) this.session.update({ objectiveProgress: 1 });
      this.sync();
    }
    this.publishFocus(); return event;
  }
  sync() {
    this.revision = this.state.revision;
    const panels = [...this.doors.entries(), ...(this.vault ? [['vault',this.vault] as const] : [])];
    for (const [id,panel] of panels) {
      const open = this.state.active.has(id); (panel.zone.body as Phaser.Physics.Arcade.StaticBody).enable = !open;
      if (open === panel.open) continue; panel.open = open; this.scene.tweens.killTweensOf(panel.image);
      panel.image.setVisible(true);
      if (this.session.getSnapshot().reducedMotion) panel.image.setVisible(!open).setAlpha(open ? 0 : 1).setY(panel.y);
      else this.scene.tweens.add({ targets: panel.image,y: panel.y - (open ? 32 : 0),alpha: open ? 0 : 1,duration: 240,ease: 'Cubic.easeOut',onComplete: () => panel.image.setVisible(!panel.open) });
    }
    for (const [id,image] of this.collectibles) image.setVisible(!this.state.active.has(id));
    const vault = this.state.level.objects.find(object => object.id === 'vault')!, missing = this.state.missing(vault);
    this.vaultLabel.setText(this.state.active.has('vault') ? 'VAULT OPEN / CORE ACCESS' : missing.length ? 'VAULT SEALED\n' + missing.map(id => id === 'guardian-defeated' ? 'DEFEAT GUARDIAN' : id.toUpperCase().replaceAll('-',' ')).join(' + ') : 'VAULT AUTHORIZED / INTERACT').setColor(this.state.active.has('vault') ? '#8ef5cf' : '#ffd184');
    this.publishWorld(); this.publishFocus();
  }
  private publishWorld() {
    const state = this.state;
    const message = state.extracted ? 'MISSION COMPLETE / Guardian defeated. Core extracted.' : state.active.has('training-core') ? 'CORE SECURED / Follow the south route to extraction.' : state.active.has('guardian-defeated') ? 'GUARDIAN DOWN / Open central vault access.' : state.active.has('sector-console') ? 'ACCESS AUTHORIZED / Link phase pads and bring both vault relays online.' : 'THE LAUNCH / Range ↓  •  Sector terminal in the central concourse →';
    this.session.update({ world: { revision: state.revision, openDoors: [...this.doors.keys()].filter(id => state.active.has(id)), core: state.active.has('training-core'), extracted: state.extracted, rangeActive: state.active.has('auxiliary-console'), message } });
  }
  private publishFocus() {
    this.session.update({ nearby: this.focus ? { id: this.focus.id, name: this.focus.name, description: this.state.description(this.focus), active: this.state.active.has(this.focus.id) } : null });
  }
  update(deltaSeconds: number) {
    this.ground.update();
    if (this.revision !== this.state.revision) this.sync();
    this.inspectElapsed += deltaSeconds; if (this.inspectElapsed < .12) return; this.inspectElapsed = 0;
    const focus = this.state.nearest(this.actor);
    if (focus !== this.focus) { this.focus = focus; this.publishFocus(); }
    this.highlight.setVisible(Boolean(focus));
    if (focus) this.highlight.setPosition(focus.x, focus.y - 35).setDepth(focus.y + 2);
    const view = this.scene.cameras.main.worldView;
    for (const image of this.culled) image.setVisible(image.x > view.left - 150 && image.x < view.right + 150 && image.y > view.top - 150 && image.y < view.bottom + 200);
  }
  dispose() {
    this.solids.clear(true, true); this.ground.dispose(); this.map.destroy(); this.doors.clear(); this.collectibles.clear(); this.culled.length = 0; this.focus = null;
    this.vaultLabel.destroy();
  }
}
