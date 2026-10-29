import Phaser from 'phaser';
import { QUALITY_PRESETS, type QualityId } from '../core/presentation';
import type { SceneSystem } from '../core/contracts';

interface LightPool {
  id: string; sprite: Phaser.GameObjects.Image; x: number; y: number;
  intensity: number; phase: number; essential: boolean; active: boolean;
}

/** Canvas-compatible lighting: cached textures, bounded particles and no full-screen shaders. */
export class CinematicEffects implements SceneSystem {
  private lights: LightPool[] = [];
  private shadows: Phaser.GameObjects.Image[] = [];
  private scanners: Phaser.GameObjects.Image[] = [];
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private contact: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private elapsed = 0;
  private quality: QualityId;
  private reduced: boolean;
  private paused = false;

  constructor(private scene: Phaser.Scene, private actor: { x: number; y: number }, quality: QualityId, reduced: boolean, color: number) {
    this.quality = quality; this.reduced = reduced;
    this.createShadow();
    this.contact = scene.add.image(actor.x, actor.y + 5, 'rv-shadow').setDisplaySize(55, 26).setAlpha(.7).setDepth(4);
    this.aura = scene.add.image(actor.x, actor.y, this.lightTexture(color)).setDisplaySize(175, 130).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.24).setDepth(3);
    if (!scene.textures.exists('rv-operative-ring')) {
      const texture = scene.textures.createCanvas('rv-operative-ring', 128, 64)!, ctx = texture.context;
      ctx.strokeStyle = '#43bfff'; ctx.lineWidth = 2; ctx.shadowColor = '#359cff'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.ellipse(64, 32, 49, 21, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = '#92dfff88'; ctx.beginPath(); ctx.ellipse(64, 32, 44, 18, 0, .2, Math.PI * .85); ctx.stroke(); texture.refresh();
    }
    this.ring = scene.add.image(actor.x, actor.y + 4, 'rv-operative-ring').setDisplaySize(65, 32).setAlpha(.65).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    this.dust = scene.add.particles(0, 0, this.lightTexture(0x8fbdff), {
      lifespan: { min: 3000, max: 6500 }, speedX: { min: -3, max: 6 }, speedY: { min: -9, max: -3 },
      scale: { start: .035, end: 0 }, alpha: { start: .28, end: 0 },
      maxParticles: 30, maxAliveParticles: 30, frequency: 170,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(64, 64, 1664, 1280) }, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(20000);
    this.configure(quality, reduced);
  }

  private createShadow() {
    if (this.scene.textures.exists('rv-shadow')) return;
    const texture = this.scene.textures.createCanvas('rv-shadow', 128, 64)!;
    const ctx = texture.context; ctx.scale(1, .5);
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, '#000912c9'); gradient.addColorStop(.55, '#00050c75'); gradient.addColorStop(1, '#00000000');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); texture.refresh();
  }

  private lightTexture(color: number) {
    const key = `rv-light-${color}`;
    if (this.scene.textures.exists(key)) return key;
    const texture = this.scene.textures.createCanvas(key, 128, 128)!;
    const ctx = texture.context, rgb = Phaser.Display.Color.IntegerToRGB(color);
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},.9)`);
    gradient.addColorStop(.26, `rgba(${rgb.r},${rgb.g},${rgb.b},.38)`);
    gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); texture.refresh(); return key;
  }

  addLight(id: string, x: number, y: number, color: number, radius = 190, intensity = .35, essential = false) {
    const sprite = this.scene.add.image(x, y, this.lightTexture(color)).setDisplaySize(radius, radius * .75).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    this.lights.push({ id, sprite, x, y, intensity, essential, active: false, phase: this.lights.length * 1.74 });
  }

  activate(id: string, active: boolean) { const pool = this.lights.find(light => light.id === id); if (pool) pool.active = active; }

  addShadow(x: number, y: number, size: number) {
    this.shadows.push(this.scene.add.image(x + 7, y + 6, 'rv-shadow').setDisplaySize(size * .9, size * .32).setAlpha(.65).setDepth(4));
  }

  addScanner(x: number, y: number) {
    const key = 'rv-scanner';
    if (!this.scene.textures.exists(key)) {
      const texture = this.scene.textures.createCanvas(key, 256, 128)!, ctx = texture.context;
      const gradient = ctx.createLinearGradient(0, 64, 256, 64); gradient.addColorStop(0, '#ff96619a'); gradient.addColorStop(1, '#ff695000');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(256, 0); ctx.lineTo(256, 128); ctx.closePath(); ctx.fill(); texture.refresh();
    }
    this.scanners.push(this.scene.add.image(x, y, key).setOrigin(0, .5).setDisplaySize(210, 92).setDepth(5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.14));
  }

  configure(quality: QualityId, reduced = this.reduced) {
    this.quality = quality; this.reduced = reduced;
    const preset = QUALITY_PRESETS[quality];
    this.dust.setFrequency(preset.particleFrequency); this.dust.setVisible(preset.particles > 0 && !reduced);
    this.dust.maxAliveParticles = preset.particles;
    if (!preset.particles || reduced) { this.dust.stop(); this.dust.killAll(); } else if (!this.paused) this.dust.start();
    this.shadows.forEach(shadow => shadow.setVisible(preset.shadows));
    this.scanners.forEach(scanner => scanner.setVisible(quality !== 'low'));
  }

  pause(paused: boolean) { this.paused = paused; this.dust.timeScale = paused ? 0 : 1; if (!paused) this.configure(this.quality, this.reduced); }

  update(deltaSeconds: number) {
    this.elapsed += deltaSeconds;
    const preset = QUALITY_PRESETS[this.quality], view = this.scene.cameras.main.worldView;
    let closest: LightPool | undefined, closestDistance = Infinity;
    for (const light of this.lights) {
      const visible = light.essential || view.contains(light.x, light.y);
      light.sprite.setVisible(visible && (this.quality !== 'low' || light.essential));
      if (!visible) continue;
      const pulse = this.reduced || this.quality === 'low' ? 1 : 1 + Math.sin(this.elapsed * 1.2 + light.phase) * .09;
      light.sprite.setAlpha(light.intensity * preset.lightScale * pulse * (light.active ? 1.65 : 1));
      const distance = (light.x - this.actor.x) ** 2 + (light.y - this.actor.y) ** 2;
      if (distance < closestDistance) { closestDistance = distance; closest = light; }
    }
    const dx = closest ? this.actor.x - closest.x : 0, dy = closest ? this.actor.y - closest.y : 1, length = Math.max(1, Math.hypot(dx, dy));
    this.contact.setPosition(this.actor.x + dx / length * 5, this.actor.y + 6 + dy / length * 2);
    this.contact.setDisplaySize(55 + Math.min(12, length / 60), 25);
    this.aura.setPosition(this.actor.x, this.actor.y - 8).setAlpha(this.quality === 'low' ? .15 : .24);
    this.ring.setPosition(this.actor.x, this.actor.y + 4);
    if (!this.reduced) this.scanners.forEach((scanner, i) => scanner.setRotation(.5 + Math.sin(this.elapsed * .45 + i) * .6));
  }

  dispose() { this.dust.destroy(); this.lights.length = 0; this.shadows.length = 0; this.scanners.length = 0; }
}
