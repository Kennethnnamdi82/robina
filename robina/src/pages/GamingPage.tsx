import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArenaView } from '@/features/rivals/ui/ArenaView';
import { Lobby } from '@/features/rivals/ui/Lobby';
import { MissionLobby } from '@/features/rivals/ui/MissionLobby';
import { MenuPage, MissionSelect, Customization, RankingsPreview } from '@/features/rivals/ui/MenuPages';
import { SettingsPanel } from '@/features/rivals/ui/SettingsPanel';
import { ConfirmDialog } from '@/features/rivals/ui/ConfirmDialog';
import { ArenaSession } from '@/features/rivals/core/session';
import type { MissionMode } from '@/features/rivals/missions/types';
import { CHARACTER_IDS, type CharacterId } from '@/features/rivals/core/presentation';
import { loadSettings, persistSettings, resolveReducedMotion, sanitizeSettings, type GameSettings } from '@/features/rivals/core/settings';
import '@/features/rivals/rivals.css';

type Screen = 'menu' | 'missions' | 'briefing' | 'customization' | 'settings' | 'rankings' | 'arena';
export default function GamingPage({ validation = false }: { validation?: boolean }) {
  const navigate = useNavigate(), shell = useRef<HTMLElement>(null);
  const [screen, setScreen] = useState<Screen>('menu'), [run, setRun] = useState<ArenaSession | null>(null);
  const [missionMode, setMissionMode] = useState<MissionMode>('standard');
  const [settings, setSettings] = useState(loadSettings), [persisted, setPersisted] = useState(true);
  const [systemMotion, setSystemMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [characterId, setCharacterId] = useState<CharacterId>(() => {
    try { const saved = localStorage.getItem('rivals_operative_v1'); return CHARACTER_IDS.includes(saved as CharacterId) ? saved as CharacterId : 'vex'; } catch { return 'vex'; }
  });
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; action: () => void } | null>(null);
  const reducedMotion = resolveReducedMotion(settings, systemMotion);
  const settingsRef = useRef(settings);
  const updateSettings = useCallback((patch: Partial<GameSettings>) => {
    const next = sanitizeSettings({ ...settingsRef.current, ...patch }); settingsRef.current = next;
    setPersisted(persistSettings(next)); setSettings(next);
  }, []);
  const chooseCharacter = (id: CharacterId) => { setCharacterId(id); try { localStorage.setItem('rivals_operative_v1', id); } catch { /* Session selection still works. */ } };
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), changed = () => setSystemMotion(media.matches);
    media.addEventListener('change', changed); return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => { if (screen !== 'arena') shell.current?.querySelector<HTMLElement>('h1')?.focus(); }, [screen]);
  const begin = (operative = characterId) => { run?.dispose(); setRun(new ArenaSession({ characterId: operative, settings, reducedMotion, validation, missionMode })); setScreen('arena'); };
  const start = () => {
    if (run) setConfirmation({ title: 'Start a new insertion?', description: 'This replaces your paused local run. Position, health, timer and objective progress will reset.', action: () => begin() });
    else begin();
  };
  const leave = (path = '/') => {
    if (run) setConfirmation({ title: 'Leave RIVALS?', description: 'Your local recon run will end. Account balances, records and entitlements are unaffected.', action: () => { run.dispose(); navigate(path); } });
    else navigate(path);
  };
  const menu = () => { run?.pause(); setScreen('menu'); };
  const end = () => { run?.dispose(); setRun(null); setScreen('menu'); };
  const back = () => setScreen('menu');
  return <main ref={shell} className="rivals-shell" data-motion={reducedMotion ? 'reduced' : 'full'} data-screen={screen} aria-label="RIVALS Rival Heist">
    {run && <ArenaView key={run.startedAt} session={run} active={screen === 'arena'} settings={settings} reducedMotion={reducedMotion} persisted={persisted} onSettingsChange={updateSettings} onMenu={menu} onRestart={() => begin(run.getSnapshot().characterId)} onEnd={end} validation={validation} />}
    {screen === 'menu' && <Lobby onPlay={() => setScreen('briefing')} onContinue={() => setScreen('arena')} canContinue={run !== null} onMissions={() => setScreen('missions')} onCustomise={() => setScreen('customization')} onSettings={() => setScreen('settings')} onRankings={() => setScreen('rankings')} onBack={() => leave()} onProfile={() => leave('/profile')} />}
    {screen === 'briefing' && <MissionLobby characterId={characterId} onCharacter={chooseCharacter} quality={settings.quality} onQuality={quality => updateSettings({ quality })} reducedMotion={reducedMotion} onStart={start} onBack={back} mode={missionMode} onMode={setMissionMode} />}
    {screen === 'missions' && <MenuPage title="Choose your approach." eyebrow="OPERATIONS" onBack={back}><MissionSelect onSelect={() => setScreen('briefing')} /></MenuPage>}
    {screen === 'customization' && <MenuPage title="Field operatives." eyebrow="CHARACTER CUSTOMIZATION" onBack={back}><Customization characterId={characterId} onCharacter={chooseCharacter} quality={settings.quality} onQuality={quality => updateSettings({ quality })} reducedMotion={reducedMotion} /></MenuPage>}
    {screen === 'settings' && <MenuPage title="Field settings." eyebrow="PREFERENCES" onBack={back}><SettingsPanel settings={settings} onChange={updateSettings} persisted={persisted} /></MenuPage>}
    {screen === 'rankings' && <MenuPage title="The rivals to beat." eyebrow="LEADERBOARDS" onBack={back}><RankingsPreview onCommunity={() => leave('/rank')} /></MenuPage>}
    {confirmation && <ConfirmDialog title={confirmation.title} description={confirmation.description} confirmLabel="CONFIRM" onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); confirmation.action(); }} />}
  </main>;
}
