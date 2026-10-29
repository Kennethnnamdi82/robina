import Phaser from 'phaser';
import { floorFrame, isWall, TRAINING_VAULT } from './trainingVault';
import { NEON_PROPS, type NeonProp } from './neonDistrict';
import type { ArenaSession } from '../core/session';
import type { SceneSystem } from '../core/contracts';
import type { CinematicEffects } from '../rendering/CinematicEffects';

export class EnvironmentLayer implements SceneSystem {
  readonly collision: Phaser.Tilemaps.TilemapLayer;
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  private focus: NeonProp | null = null;
  private active = new Set<string>();
  private inspected = '';
  private inspectElapsed = 0;
  private highlight: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, private session: ArenaSession, private effects: CinematicEffects, private actor: { x: number; y: number }) {
    const { width, height } = TRAINING_VAULT;
    const data = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => floorFrame(x, y)));
    const map = scene.make.tilemap({ data, tileWidth: 128, tileHeight: 128 });
    const tiles = map.addTilesetImage('neon', 'rv-floor', 128, 128)!;
    map.createLayer(0, tiles, 0, 0)!.setScale(.5).setDepth(0);
    this.collision = map.createBlankLayer('collision', tiles, 0, 0)!.setScale(.5).setVisible(false);
    this.solids = scene.physics.add.staticGroup();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!isWall(x, y)) continue;
      this.collision.putTileAt(0, x, y);
      const wall = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < width && cy < height && isWall(cx, cy);
      const north = wall(x, y - 1), south = wall(x, y + 1), east = wall(x + 1, y), west = wall(x - 1, y);
      const count = Number(north) + Number(south) + Number(east) + Number(west);
      const frame = count >= 3 ? 'junction' : count === 1 ? 'end' : (north || south) && (east || west) ? 'corner' : north && south ? 'vertical' : (x + y) % 9 === 0 ? 'lamp' : (x + y) % 13 === 0 ? 'vent' : (x + y) % 7 === 0 ? 'glass' : 'horizontal';
      scene.add.image(x * 64 + 32, y * 64 + 60, 'rv-walls', frame).setOrigin(.5, 238 / 256).setDisplaySize(77, 104).setDepth(y * 64 + 60);
      if (frame === 'lamp') effects.addLight(`wall-${x}-${y}`, x * 64 + 32, y * 64 + 47, 0xffb455, 155, .3);
    }
    this.collision.setCollision(0);
    // A light color grade over independent floor tiles; it is not a baked environment image.
    scene.add.rectangle(width * 32, height * 32, width * 64, height * 64, 0x15102c, .16).setDepth(1);

    for (const prop of NEON_PROPS) {
      scene.add.image(prop.x, prop.y, 'rv-props', prop.frame).setOrigin(.5, 230 / 256).setDisplaySize(prop.size, prop.size).setDepth(prop.y);
      effects.addShadow(prop.x, prop.y, prop.size * .8);
      if (prop.solid) {
        const zone = scene.add.zone(prop.x, prop.y + 5, prop.solid.width, prop.solid.height);
        scene.physics.add.existing(zone, true); this.solids.add(zone);
      }
      if (prop.light) effects.addLight(prop.id, prop.x, prop.y - 30, prop.light, prop.id === 'vault' ? 290 : 210, prop.id === 'vault' ? .5 : .35, Boolean(prop.inspect));
      if (prop.scanner) effects.addScanner(prop.x - 13, prop.y - 70);
    }
    this.highlight = scene.add.image(0, 0, 'rv-props', 'hologram').setOrigin(.5, .9).setDisplaySize(55, 55).setAlpha(.6).setVisible(false);
    scene.add.text(288, 475, 'INSERTION  /  01', { fontFamily: 'monospace', fontSize: '10px', color: '#8589bc', letterSpacing: 2 }).setOrigin(.5).setDepth(5);
    scene.add.text(896, 854, 'NEON DISTRICT', { fontFamily: 'monospace', fontSize: '25px', color: '#45516b', letterSpacing: 4 }).setOrigin(.5).setDepth(5);
    scene.add.text(896, 888, 'SECTOR 01 / RECON ACCESS', { fontFamily: 'monospace', fontSize: '9px', color: '#5d6686', letterSpacing: 2 }).setOrigin(.5).setDepth(5);
  }

  inspect() {
    if (!this.focus?.inspect) return;
    const id = this.focus.id;
    this.inspected = id;
    if (this.focus.inspect.toggle) {
      if (this.active.has(id)) this.active.delete(id); else this.active.add(id);
      this.effects.activate(id, this.active.has(id));
    }
    this.publishFocus();
  }

  private publishFocus() {
    this.session.update({ nearby: this.focus?.inspect ? { id: this.focus.id, name: this.focus.inspect.name, description: this.inspected !== this.focus.id ? 'Press E or tap Inspect for equipment details.' : this.focus.inspect.toggle ? this.active.has(this.focus.id) ? 'Local uplink active.' : 'Local uplink in standby.' : this.focus.inspect.description, active: this.active.has(this.focus.id) } : null });
  }

  update(deltaSeconds: number) {
    this.inspectElapsed += deltaSeconds;
    if (this.inspectElapsed < .12) return;
    this.inspectElapsed = 0;
    let focus: NeonProp | null = null, distance = 105 ** 2;
    for (const prop of NEON_PROPS) {
      if (!prop.inspect) continue;
      const value = (prop.x - this.actor.x) ** 2 + (prop.y - this.actor.y) ** 2;
      if (value < distance) { focus = prop; distance = value; }
    }
    if (focus !== this.focus) { this.focus = focus; this.publishFocus(); }
    this.highlight.setVisible(Boolean(this.focus));
    if (this.focus) this.highlight.setPosition(this.focus.x, this.focus.y - 35).setDepth(this.focus.y + 2);
  }

  dispose() { this.active.clear(); this.focus = null; }
}
