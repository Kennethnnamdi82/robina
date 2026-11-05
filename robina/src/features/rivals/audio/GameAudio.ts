import { assetUrl } from '../assets';
import type { GameSettings } from '../core/settings';

type Sound = 'player_dash' | 'player_hit' | 'terminal_success' | 'turret_fire' | 'laser_hit' | 'core_pickup' | 'extract_success' | 'drone_alert' | 'terminal_fail' | 'vault_open';
const combatSounds = new Set<Sound>(['turret_fire', 'laser_hit', 'core_pickup', 'extract_success']);
const securitySounds = new Set<Sound>(['drone_alert','terminal_fail','vault_open']);
/** Optional audio uses a bounded pool and downloads only on user-authorized playback. */
export class GameAudio {
  private music: HTMLAudioElement | null = null;
  private effects = new Map<Sound, HTMLAudioElement>();
  private paused = false;
  private disposed = false;
  constructor(private settings: GameSettings,private readonly soundtrack=true) {}
  configure(settings: GameSettings) {
    this.settings = settings;
    if (this.music) this.music.volume = settings.masterVolume * settings.musicVolume;
    this.effects.forEach(sound => { sound.volume = settings.masterVolume * settings.sfxVolume; if (settings.muted) sound.pause(); });
    if (settings.muted || !settings.masterVolume || !settings.musicVolume || this.paused) this.music?.pause(); else this.playMusic();
  }
  playMusic() {
    const s = this.settings;
    if (!this.soundtrack || this.disposed || this.paused || s.muted || !s.masterVolume || !s.musicVolume) return;
    this.music ??= new Audio(assetUrl('audio/neon_ambient.wav'));
    this.music.loop = true; this.music.volume = s.masterVolume * s.musicVolume;
    void this.music.play().catch(() => { /* Device audio may be unavailable; gameplay remains usable. */ });
  }
  effect(name: Sound) {
    const s = this.settings;
    if (this.disposed || this.paused || s.muted || !s.masterVolume || !s.sfxVolume) return;
    let sound = this.effects.get(name);
    if (!sound) { sound = new Audio(import.meta.env.BASE_URL + 'assets/rivals/' + (securitySounds.has(name) ? 'security/' : combatSounds.has(name) ? 'combat/' : 'controls/') + name + '.wav'); this.effects.set(name, sound); }
    sound.currentTime = 0; sound.volume = s.masterVolume * s.sfxVolume; void sound.play().catch(() => {});
  }
  pause(paused: boolean) { this.paused = paused; if (paused) { this.music?.pause(); this.effects.forEach(sound => sound.pause()); } else this.playMusic(); }
  dispose() { this.disposed = true; this.pause(true); if (this.music) this.music.src = ''; this.effects.forEach(sound => { sound.src = ''; }); this.effects.clear(); this.music = null; }
}
