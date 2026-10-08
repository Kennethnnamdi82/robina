import type { WeaponId } from './gameData';
export class CombatAudio {
  private context?: AudioContext; private output?: GainNode; private ambient?: OscillatorNode;
  private buffers = new Map<WeaponId | 'enemy', AudioBuffer>(); private disposed = false;
  muted = false;
  async unlock(): Promise<boolean> {
    if (this.disposed) return false;
    try {
      const Factory = globalThis.AudioContext || (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Factory) { this.muted = true; return false; }
      if (!this.context) {
        this.context = new Factory(); this.output = this.context.createGain();
        this.output.gain.value = this.muted ? 0 : .34; this.output.connect(this.context.destination);
        this.ambient = this.context.createOscillator(); this.ambient.frequency.value = 48;
        const gain = this.context.createGain(); gain.gain.value = .025;
        this.ambient.connect(gain); gain.connect(this.output); this.ambient.start();
        for (const id of ['pistol', 'smg', 'rifle', 'enemy'] as const) {
          const duration = id === 'pistol' ? .16 : id === 'smg' ? .09 : .2;
          const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate), data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * .16));
          this.buffers.set(id, buffer);
        }
      }
      await this.context.resume(); return !this.disposed && this.context.state === 'running';
    } catch { this.muted = true; return false; }
  }
  toggle() { this.muted = !this.muted; if (this.output) this.output.gain.value = this.muted ? 0 : .34; }
  tone(frequency: number, duration = .12, volume = .12, type: OscillatorType = 'sine') {
    if (!this.context || !this.output || this.context.state !== 'running' || this.disposed) return;
    const time = this.context.currentTime, oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, frequency * .35), time + duration);
    gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    oscillator.connect(gain); gain.connect(this.output); oscillator.start(); oscillator.stop(time + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  shot(weapon: WeaponId | 'enemy') {
    if (!this.context || !this.output || this.context.state !== 'running' || this.disposed) return;
    const buffer = this.buffers.get(weapon); if (!buffer) return;
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = weapon === 'smg' ? 3200 : 1900;
    gain.gain.value = weapon === 'enemy' ? .25 : .65;
    source.connect(filter); filter.connect(gain); gain.connect(this.output); source.start();
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    this.tone(weapon === 'smg' ? 155 : 95, buffer.duration, weapon === 'enemy' ? .06 : .23, 'triangle');
  }
  reload() { this.tone(620, .08, .12, 'square'); }
  hit(kill = false) { this.tone(kill ? 950 : 700, kill ? .18 : .055, .1, 'triangle'); }
  damage() { this.tone(65, .22, .25, 'sawtooth'); }
  footstep() { this.tone(80 + Math.random() * 30, .035, .045, 'triangle'); }
  suspend() { if (this.context && this.context.state !== 'closed') void this.context.suspend().catch(() => {}); }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    try { this.ambient?.stop(); } catch { /* Already stopped. */ }
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.buffers.clear();
  }
}
