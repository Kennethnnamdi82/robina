import Phaser from 'phaser';
import { SecurityController } from './SecurityController';
import { segmentBox } from '../combat/geometry';
import type { ArenaSession } from '../core/session';
import type { EnvironmentLayer } from '../world/EnvironmentLayer';
import type { DamageEvent } from '../combat/Health';
import type { GameAudio } from '../audio/GameAudio';
import { AIM_HEIGHT } from '../core/presentation';
export class SecuritySystem {
  readonly model: SecurityController;
  private graphics: Phaser.GameObjects.Graphics;
  private labels = new Map<string,Phaser.GameObjects.Text>();
  private lastAlarm = 0; private renderClock = 0;
  constructor(private scene: Phaser.Scene, private session: ArenaSession, private environment: EnvironmentLayer, private actor: { x: number; y: number }, private audio: GameAudio) {
    this.model = new SecurityController(environment.state,environment.state.level.security);
    this.graphics = scene.add.graphics().setDepth(6);
    for (const laser of this.model.definition.lasers) this.labels.set(laser.id,scene.add.text((laser.a.x + laser.b.x) / 2,laser.a.y - 24,'', { fontFamily: 'monospace',fontSize: '10px',color: '#ffca8c',backgroundColor: '#07131fd9',padding: { x: 5,y: 3 } }).setOrigin(.5).setDepth(18999));
    for (const id of [this.model.definition.sequence.start,this.model.definition.sequence.finish]) {
      const object = environment.state.level.objects.find(o => o.id === id)!;
      this.labels.set(id,scene.add.text(object.x,object.y - 73,'', { fontFamily: 'monospace',fontSize: '10px',color: '#97e6f3',align: 'center',backgroundColor: '#07131fd9' }).setOrigin(.5).setDepth(18999));
    }
  }
  step(dt: number, alive: boolean, damage: (event: DamageEvent) => number) {
    this.model.step(dt,this.actor,alive,damage);
    if (this.model.alarmSerial !== this.lastAlarm) { this.lastAlarm = this.model.alarmSerial; this.audio.effect('drone_alert'); }
  }
  interact(): 'hack' | 'handled' | null {
    const object = this.environment.state.nearest(this.actor); if (!object) return null;
    if (object.hack && this.model.beginHack(object,this.actor)) {
      this.session.openHack(this.model.hack!.getSnapshot()); this.publish(); return 'hack';
    }
    const failures = this.model.sequenceFailures;
    if (this.model.timedInteract(object,this.actor)) {
      this.environment.sync(); this.audio.effect(this.model.sequenceFailures > failures ? 'terminal_fail' : 'terminal_success'); this.publish(); return 'handled';
    }
    return null;
  }
  submit = (pad: number) => {
    if (!this.model.hack) return;
    this.model.submitHack(pad,this.actor); this.environment.sync(); this.session.update({ hack: this.model.hack.getSnapshot() }); this.publish();
  };
  retry = () => { this.model.hack?.retry(); if (this.model.hack) this.session.update({ hack: this.model.hack.getSnapshot() }); };
  close = (resume = true) => {
    const success = this.model.hack?.getSnapshot().result === 'success'; this.model.hack = null; this.session.finishHack(resume);
    if (resume && success) this.audio.effect('terminal_success'); this.publish();
  };
  update(dt: number) {
    this.renderClock += dt; if (this.renderClock < .1) return; this.renderClock = 0;
    const view = this.scene.cameras.main.worldView, reduced = this.session.getSnapshot().reducedMotion;
    this.graphics.clear();
    for (const camera of this.model.definition.cameras) {
      if (Math.abs(camera.x - view.centerX) > view.width / 2 + camera.range || Math.abs(camera.y - view.centerY) > view.height / 2 + camera.range) continue;
      const disabled = this.model.disabledFor(camera.id) > 0, angle = this.model.cameraAngle(camera.id), alerted = (this.model.detections.get(camera.id) ?? 0) > .15;
      if (!disabled) {
        this.graphics.fillStyle(alerted ? 0xff7867 : 0xffc365,alerted ? .15 : .075).beginPath().moveTo(camera.x,camera.y - AIM_HEIGHT);
        for (let i = 0; i <= 16; i++) {
          const theta = angle - camera.cone + camera.cone * 2 * i / 16, dx = Math.cos(theta) * camera.range, dy = Math.sin(theta) * camera.range;
          let fraction = 1;
          for (const box of this.environment.state.blockers) if (box.enabled) fraction = Math.min(fraction,segmentBox(camera.x,camera.y,dx,dy,box));
          this.graphics.lineTo(camera.x + dx * fraction,camera.y - AIM_HEIGHT + dy * fraction);
        }
        this.graphics.closePath().fillPath();
      } else this.graphics.lineStyle(2,0x7ce4cc,.8).strokeCircle(camera.x,camera.y - 30,12);
    }
    for (const laser of this.model.definition.lasers) {
      const phase = this.model.laserPhase(laser.id), label = this.labels.get(laser.id)!;
      const visible = laser.a.x < view.right + 200 && laser.b.x > view.left - 200 && Math.abs(laser.a.y - view.centerY) < view.height / 2 + 120;
      label.setVisible(visible).setText(this.model.disabledFor(laser.id) ? 'GRID SUPPRESSED' : phase === 'ACTIVE' ? '⚠ LIVE LASER' : phase === 'WARNING' ? '⚠ ARMING' : '— SAFE WINDOW');
      if (!visible) continue;
      if (phase === 'ACTIVE') {
        this.graphics.lineStyle(12,0xff6f70,.12).lineBetween(laser.a.x,laser.a.y,laser.b.x,laser.b.y);
        this.graphics.lineStyle(3,0xffb5ad,.95).lineBetween(laser.a.x,laser.a.y,laser.b.x,laser.b.y);
      } else if (phase === 'WARNING') {
        this.graphics.lineStyle(2,0xffd58a,reduced ? .85 : .45 + Math.sin(this.model.clock * 8) * .3);
        for (let i = 0; i < 8; i += 2) this.graphics.lineBetween(laser.a.x + (laser.b.x - laser.a.x) * i / 8,laser.a.y,laser.a.x + (laser.b.x - laser.a.x) * (i + 1) / 8,laser.a.y);
      }
      this.graphics.lineStyle(2,phase === 'ACTIVE' ? 0xffa397 : 0x7ecfd2,.8).strokeCircle(laser.a.x,laser.a.y,5).strokeCircle(laser.b.x,laser.b.y,5);
    }
    const phase = this.model.sequencePhase;
    for (const id of [this.model.definition.sequence.start,this.model.definition.sequence.finish]) {
      const object = this.environment.state.level.objects.find(o => o.id === id)!;
      this.labels.get(id)!.setText((id === this.model.definition.sequence.start ? 'WEST' : 'EAST') + ' / ' + (this.environment.state.active.has('timed-access') ? 'LINKED ✓' : phase === 'ACTIVE' ? 'OPEN' : phase === 'WARNING' ? 'READY…' : 'LOCKED'));
      this.graphics.lineStyle(2,phase === 'ACTIVE' ? 0x83f0d1 : 0xe8b877,.7).strokeEllipse(object.x,object.y,65,28);
    }
  }
  publish() {
    const model = this.model, sequence = model.definition.sequence, period = sequence.off + sequence.warning + sequence.open;
    const window = model.sequencePhase === 'ACTIVE' ? period - model.clock % period : sequence.off + sequence.warning - model.clock % period;
    this.session.update({ security: { alarm: model.alarmRemaining > 0,seconds: model.alarmRemaining,source: model.alarmSource,serial: model.alarmSerial,phase: model.sequencePhase,window,linkRemaining: model.sequenceRemaining,linked: model.world.active.has(sequence.grant),relays: Number(model.world.active.has('relay-a')) + Number(model.world.active.has('relay-b')),hacks: model.hacksCompleted,failures: model.sequenceFailures,disabled: [...model.disabled.keys()].filter(id => model.disabledFor(id) > 0),message: model.message } });
  }
  dispose() { this.model.hack = null; this.graphics.destroy(); this.labels.forEach(label => label.destroy()); this.labels.clear(); }
}
