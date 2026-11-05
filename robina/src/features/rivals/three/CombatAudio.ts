import type { GameSettings } from '../core/settings';
import type { GunClass } from './WeaponRig';

type Cue = `${GunClass}-${0 | 1}` | 'shotgun-0' | `step-${0 | 1 | 2}` | `metal-${0 | 1}` | 'clack' | 'body-hit' | 'collapse';
interface Voice { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; filter?: BiquadFilterNode; priority: number }
const cues: Cue[] = ['rifle-0','rifle-1','smg-0','smg-1','pistol-0','pistol-1','shotgun-0','step-0','step-1','step-2','metal-0','metal-1','clack','body-hit','collapse'];

/** Combat-only Web Audio bus. No queued shots after loading/unmute, no audio
 * downloads while muted, bounded voices, and explicit user-gesture unlock. */
export class CombatAudio {
  readonly maximumVoices = 16;
  private context?: AudioContext; private master?: GainNode; private analyser?: AnalyserNode;
  private buffers = new Map<Cue, AudioBuffer>(); private voices = new Set<Voice>();
  private abort = new AbortController(); private loading = false; private disposed = false; private paused = false;
  private sequence = 0; private samples = new Float32Array(128);
  played = 0; dropped = 0; errors = 0; peak = 0; footfallDistance = 0;footfalls=0;
  constructor(private settings: GameSettings) {
    document.addEventListener('pointerdown', this.unlock); document.addEventListener('keydown', this.unlock);
  }
  configure(settings: GameSettings) { this.settings = settings; this.volume(); if (settings.muted) this.stop(); else this.unlock(); }
  private volume() { if (this.master && this.context) this.master.gain.setTargetAtTime(this.paused || this.settings.muted ? 0 : this.settings.masterVolume * this.settings.sfxVolume, this.context.currentTime, .015); }
  private unlock = () => {
    if (this.disposed || this.settings.muted || this.paused) return;
    try {
      if (!this.context) {
        this.context = new AudioContext({ latencyHint: 'interactive' }); this.master = this.context.createGain();
        const compressor = this.context.createDynamicsCompressor(); compressor.threshold.value = -12; compressor.ratio.value = 4;
        this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256;
        this.master.connect(compressor); compressor.connect(this.analyser); this.analyser.connect(this.context.destination); this.volume();
      }
      void this.context.resume().catch(() => { /* A later gesture retries on restricted browsers. */ });
      if (!this.loading) { this.loading = true; void this.load(); }
    } catch { this.errors++; }
  };
  private async load() {
    await Promise.all(cues.map(async cue => {
      try {
        const response = await fetch(`/assets/rivals/combat3d/audio/${cue}.${cue.includes('rifle') || cue.includes('pistol') || cue.includes('smg') || cue.includes('shotgun') ? 'wav' : 'ogg'}`, { signal: this.abort.signal });
        if (!response.ok) throw new Error('Combat sound unavailable');
        const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
        if (!this.disposed) this.buffers.set(cue, buffer);
      } catch { if (!this.disposed) this.errors++; }
    }));
  }
  private play(cue: Cue, gain: number, distance = 0, pan = 0, priority = 1, pitch = 1, lowpass = 0) {
    const ctx = this.context, buffer = this.buffers.get(cue);
    if (this.disposed || this.paused || this.settings.muted || !ctx || ctx.state !== 'running' || !buffer) return;
    const attenuation = 1 / (1 + Math.max(0, distance - 2) ** 2 / 45); if (attenuation < .015) return;
    if (this.voices.size >= this.maximumVoices) {
      const oldest = [...this.voices].find(v => v.priority <= priority);
      if (!oldest) { this.dropped++; return; } this.release(oldest, true); this.dropped++;
    }
    const source = ctx.createBufferSource(), volume = ctx.createGain(), stereo = ctx.createStereoPanner();
    source.buffer = buffer; source.playbackRate.value = pitch; volume.gain.value = gain * attenuation; stereo.pan.value = Math.max(-.9, Math.min(.9, pan));
    const voice: Voice = { source, gain: volume, pan: stereo, priority };
    if (lowpass) { voice.filter = ctx.createBiquadFilter(); voice.filter.type = 'lowpass'; voice.filter.frequency.value = lowpass; source.connect(voice.filter); voice.filter.connect(volume); } else source.connect(volume);
    volume.connect(stereo); stereo.connect(this.master!); this.voices.add(voice); source.onended = () => this.release(voice, false); source.start(); this.played++;
  }
  private release(voice: Voice, stop: boolean) { if (!this.voices.delete(voice)) return; voice.source.onended = null; if (stop) { try { voice.source.stop(); } catch { /* Already ended. */ } } voice.source.disconnect(); voice.gain.disconnect(); voice.pan.disconnect(); voice.filter?.disconnect(); }
  private stop() { [...this.voices].forEach(v => this.release(v, true)); }
  shot(kind: GunClass, distance = 0, pan = 0) { this.play(`${kind}-${this.sequence++ % 2 as 0 | 1}`, kind === 'pistol' ? .48 : .55, distance, pan, 3, .97 + this.sequence % 3 * .025); }
  reload(done = false) { this.play(done ? 'metal-1' : 'clack', done ? .38 : .45, 0, .15, 2, done ? 1.1 : .8); }
  empty() { this.play('clack', .22, 0, 0, 1, 1.65); }
  hit(body: boolean, distance = 0, pan = 0) { this.play(body ? 'body-hit' : `metal-${this.sequence++ % 2 as 0 | 1}`, body ? .6 : .3, distance, pan, body ? 2 : 1); }
  death(distance = 0, pan = 0) { this.play('collapse', .8, distance, pan, 2, .85); }
  blast(distance = 0, pan = 0) { this.play('shotgun-0', .7, distance, pan, 3, .65, 950); this.play('metal-0', .65, distance, pan, 2, .6); }
  walk(travel: number, grounded: boolean, sprinting: boolean) {
    if (!grounded) { this.footfallDistance = 0; return; } this.footfallDistance += travel;
    if (this.footfallDistance >= (sprinting ? 1.12 : .76)) { this.footfalls++;this.footfallDistance = 0; this.play(`step-${this.sequence++ % 3 as 0 | 1 | 2}`, sprinting ? .5 : .35, 0, this.sequence % 2 ? -.1 : .1, 0, sprinting ? 1.1 : 1); }
  }
  pause(paused: boolean) { this.paused = paused; if (paused) this.stop(); this.volume(); if (!paused) this.unlock(); }
  snapshot() {
    if (this.analyser) { this.analyser.getFloatTimeDomainData(this.samples); for (const sample of this.samples) this.peak = Math.max(this.peak, Math.abs(sample)); }
    return { state: this.context?.state ?? 'locked', buffers: this.buffers.size, voices: this.voices.size, maximum: this.maximumVoices, played: this.played, dropped: this.dropped, errors: this.errors, peak: this.peak,footfalls:this.footfalls, muted: this.settings.muted };
  }
  dispose() { if (this.disposed) return; this.disposed = true; document.removeEventListener('pointerdown', this.unlock); document.removeEventListener('keydown', this.unlock); this.abort.abort(); this.stop(); this.buffers.clear(); void this.context?.close().catch(() => {}); }
}
