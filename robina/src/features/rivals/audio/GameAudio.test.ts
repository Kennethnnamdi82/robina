import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from './GameAudio';
import { defaultSettings } from '../core/settings';

class TestAudio {
  static created: TestAudio[] = [];
  volume = 1; currentTime = 0; loop = false;
  play = vi.fn(() => Promise.resolve()); pause = vi.fn();
  constructor(public src: string) { TestAudio.created.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); TestAudio.created.length = 0; });
describe('optional game audio', () => {
  it('disables the old ambient loop for 3D without disabling effect cues',()=>{
    vi.stubGlobal('Audio',TestAudio);const settings={...defaultSettings(),muted:false},audio=new GameAudio(settings,false);audio.playMusic();audio.configure(settings);expect(TestAudio.created).toHaveLength(0);audio.effect('player_dash');expect(TestAudio.created).toHaveLength(1);expect(TestAudio.created[0].src).toContain('player_dash.wav');audio.dispose();
  });
  it('does not eagerly download muted audio and applies separate music/effect gains', () => {
    vi.stubGlobal('Audio', TestAudio);
    const defaults = defaultSettings(), audio = new GameAudio(defaults);
    audio.playMusic(); audio.effect('player_dash'); expect(TestAudio.created).toHaveLength(0);
    audio.configure({ ...defaults, muted: false, masterVolume: .5, musicVolume: .4, sfxVolume: .8 });
    expect(TestAudio.created[0].volume).toBeCloseTo(.2);
    audio.effect('player_dash'); expect(TestAudio.created[1].volume).toBeCloseTo(.4);
    audio.effect('player_dash'); expect(TestAudio.created).toHaveLength(2);
    audio.dispose(); expect(TestAudio.created.every(sound => sound.src === '')).toBe(true);
  });
  it('keeps audio suspended during paused settings changes and resumes explicitly', () => {
    vi.stubGlobal('Audio', TestAudio);
    const settings = { ...defaultSettings(), muted: false }, audio = new GameAudio(settings);
    audio.playMusic(); const music = TestAudio.created[0], plays = music.play.mock.calls.length;
    audio.pause(true); audio.configure({ ...settings, musicVolume: .8 });
    expect(music.play).toHaveBeenCalledTimes(plays); expect(music.pause).toHaveBeenCalled();
    audio.pause(false); expect(music.play).toHaveBeenCalledTimes(plays + 1);
    audio.dispose();
  });
});
