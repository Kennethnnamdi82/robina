import type Phaser from 'phaser';
import { floorFrame } from './trainingVault';
import { THE_LAUNCH } from './level';

/** Cache only static floor tiles in 256px chunks; solid art and gameplay remain independent. */
export class GroundLayer {
  readonly images: Phaser.GameObjects.Image[] = [];
  private keys: string[] = [];
  constructor(private scene: Phaser.Scene) {
    const level = THE_LAUNCH, source = scene.textures.get('rv-floor').getSourceImage() as HTMLImageElement;
    const cells = 4, tile = level.tileSize;
    for (let row = 0; row < level.height; row += cells) for (let col = 0; col < level.width; col += cells) {
      const columns = Math.min(cells, level.width - col), rows = Math.min(cells, level.height - row);
      const key = `rv-ground-${col}-${row}`, texture = scene.textures.createCanvas(key, columns * tile, rows * tile)!;
      const ctx = texture.context;
      for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        const frame = floorFrame(col + x, row + y);
        ctx.drawImage(source, frame % 4 * 128, Math.floor(frame / 4) * 128, 128, 128, x * tile, y * tile, tile, tile);
      }
      texture.refresh(); this.keys.push(key);
      this.images.push(scene.add.image(col * tile, row * tile, key).setOrigin(0).setDepth(0));
    }
  }
  update() {
    const view = this.scene.cameras.main.worldView;
    for (const image of this.images) image.setVisible(image.x < view.right + 80 && image.x + image.width > view.left - 80 && image.y < view.bottom + 80 && image.y + image.height > view.top - 80);
  }
  dispose() { this.images.forEach(image => image.destroy()); this.keys.forEach(key => this.scene.textures.remove(key)); this.images.length = 0; this.keys.length = 0; }
}
