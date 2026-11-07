import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { QUALITY_PRESETS, isQuality } from '../core/presentation';
import type { GameSettings } from '../core/settings';
import { ControlHelp } from './ControlHelp';

export function SettingsPanel({ settings, onChange, persisted }: { settings: GameSettings; onChange: (patch: Partial<GameSettings>) => void; persisted: boolean }) {
  const preview = useRef<HTMLAudioElement | null>(null);
  const [audioError, setAudioError] = useState(false);
  useEffect(() => () => { preview.current?.pause(); if (preview.current) preview.current.src = ''; }, []);
  return <div className="rv-settings-content">
    <p className="rv-panel-intro">Tune your field kit. Changes apply immediately.</p>
    <fieldset><legend>Audio</legend>
      <label className="rv-check"><input type="checkbox" checked={settings.muted} onChange={e => onChange({ muted: e.target.checked })} />Mute all audio</label>
      {(['masterVolume', 'musicVolume', 'sfxVolume'] as const).map((key, i) => <label key={key} className="rv-slider"><span>{['Master volume', 'Music volume', 'Sound effects volume'][i]}<output>{Math.round(settings[key] * 100)}%</output></span><input aria-label={['Master volume', 'Music volume', 'Sound effects volume'][i]} type="range" min="0" max="100" step="1" value={Math.round(settings[key] * 100)} onChange={e => onChange({ [key]: Number(e.target.value) / 100 })} /></label>)}
      <button className="rivals-text-button" disabled={settings.muted || settings.masterVolume === 0 || settings.sfxVolume === 0} onClick={() => {
        preview.current ??= new Audio(import.meta.env.BASE_URL + 'assets/rivals/controls/ui_confirm.wav');
        preview.current.volume = settings.masterVolume * settings.sfxVolume; preview.current.currentTime = 0;
        void preview.current.play().then(() => setAudioError(false)).catch(() => setAudioError(true));
      }}><Volume2 size={16} />Test sound effects</button>
      {audioError && <p role="status">Audio playback is unavailable in this browser session.</p>}
    </fieldset>
    <fieldset><legend>Display & controls</legend>
      <label className="rv-option">Graphics quality<select aria-label="Graphics quality" value={settings.quality} onChange={e => { if (isQuality(e.target.value)) onChange({ quality: e.target.value }); }}>{Object.entries(QUALITY_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}</select></label>
      <label className="rv-option">Mobile controls<select aria-label="Mobile controls" value={settings.mobileControls} onChange={e => onChange({ mobileControls: e.target.value as GameSettings['mobileControls'] })}><option value="auto">Automatic</option><option value="show">Always show</option><option value="hide">Hide</option></select></label>
      <label className="rv-option">Motion preference<select aria-label="Motion preference" value={settings.motion} onChange={e => onChange({ motion: e.target.value as GameSettings['motion'] })}><option value="system">Respect device preference</option><option value="reduce">Reduce motion</option></select></label>
      <label className="rv-check"><input type="checkbox" checked={settings.highContrast} onChange={e => onChange({ highContrast: e.target.checked })} />High contrast HUD</label>
      <label className="rv-check"><input type="checkbox" checked={settings.cameraShake} onChange={e => onChange({ cameraShake: e.target.checked })} />Subtle camera feedback</label>
    </fieldset>
    <fieldset><legend>Control help</legend><ControlHelp /></fieldset>
    <p className="rv-storage-note" role="status">{persisted ? 'Settings saved on this device.' : 'Settings apply for this session. Browser storage is unavailable.'}</p>
  </div>;
}
