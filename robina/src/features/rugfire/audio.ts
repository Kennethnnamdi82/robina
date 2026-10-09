import type { WeaponId } from './gameData';
import { assetURL } from './assets';
export class CombatAudio {
  private samples = new Map<string, AudioBuffer>(); private requests = new AbortController();
  private sampleLoad?: Promise<void>; private loop?: AudioBufferSourceNode;
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
      await this.context.resume();
      if (!this.sampleLoad) this.sampleLoad = this.loadSamples();
      return !this.disposed && this.context.state === 'running';
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
  private async loadSamples() {
    const names = ['rifle_fire', 'smg_fire', 'pistol_fire', 'reload_mag', 'footstep_concrete', 'hit_marker', 'enemy_damage', 'city_ambience_loop'];
    const timeout = setTimeout(() => this.requests.abort(), 12000);
    await Promise.allSettled(names.map(async name => {
      const response = await fetch(assetURL('audio/ogg/' + name + '.ogg'), { signal: this.requests.signal });
      if (!response.ok || !this.context || this.disposed) return;
      const sample = await this.context.decodeAudioData(await response.arrayBuffer());
      if (this.disposed) return;
      this.samples.set(name, sample);
      if (name === 'city_ambience_loop' && this.output) {
        this.ambient?.stop(); this.ambient?.disconnect(); this.ambient = undefined;
        const loop = this.context.createBufferSource(), gain = this.context.createGain();
        loop.buffer = sample; loop.loop = true; gain.gain.value = .12; loop.connect(gain); gain.connect(this.output); loop.start(); this.loop = loop;
      }
    }));
    clearTimeout(timeout);
  }
  private sample(name: string, volume: number, pan = 0) {
    const buffer = this.samples.get(name);
    if (!buffer || !this.context || !this.output || this.disposed || this.context.state !== 'running') return false;
    const source = this.context.createBufferSource(), gain = this.context.createGain(), panner = this.context.createStereoPanner();
    source.buffer = buffer; gain.gain.value = volume; panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(gain); gain.connect(panner); panner.connect(this.output); source.start();
    source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); }; return true;
  }
  shot(weapon: WeaponId | 'enemy', pan = 0, distance = 0) {
    if (this.sample((weapon === 'enemy' ? 'rifle' : weapon) + '_fire', weapon === 'enemy' ? .5 / (1 + distance * .08) : .75, pan)) return;
    if (!this.context || !this.output || this.context.state !== 'running' || this.disposed) return;
    const buffer = this.buffers.get(weapon); if (!buffer) return;
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = weapon === 'smg' ? 3200 : 1900;
    gain.gain.value = weapon === 'enemy' ? .25 : .65;
    source.connect(filter); filter.connect(gain); gain.connect(this.output); source.start();
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    this.tone(weapon === 'smg' ? 155 : 95, buffer.duration, weapon === 'enemy' ? .06 : .23, 'triangle');
  }
  reload() { if (!this.sample('reload_mag', .45)) this.tone(620, .08, .12, 'square'); }
  hit(kill = false) { if (!this.sample('hit_marker', kill ? .5 : .3)) this.tone(kill ? 950 : 700, kill ? .18 : .055, .1, 'triangle'); }
  damage() { if (!this.sample('enemy_damage', .4)) this.tone(65, .22, .25, 'sawtooth'); }
  footstep() { if (!this.sample('footstep_concrete', .2)) this.tone(80 + Math.random() * 30, .035, .045, 'triangle'); }
  suspend() { if (this.context && this.context.state !== 'closed') void this.context.suspend().catch(() => {}); }
  dispose() {
    if (this.disposed) return; this.disposed = true; this.requests.abort(); this.samples.clear();
    try { this.loop?.stop(); } catch { /* Already stopped. */ }
    try { this.ambient?.stop(); } catch { /* Already stopped. */ }
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.buffers.clear();
  }
}
