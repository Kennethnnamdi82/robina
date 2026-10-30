import { useEffect, useRef } from 'react';
import { ArrowLeft, Crosshair, RotateCcw, ShieldCheck, Trophy } from 'lucide-react';
import type { ArenaSession } from '../core/session';
import { useArenaValue } from './useArenaValue';
import { loadPractice } from '../missions/progression';
import { trapFocus } from './trapFocus';
import { missionTime } from '../core/presentation';

export function MissionResults({ session, onRestart, onLobby }: { session: ArenaSession; onRestart: () => void; onLobby: () => void }) {
  const mission = useArenaValue(session, s => s.mission), saved = useArenaValue(session, s => s.practiceSaved);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, []);
  if (!mission) return null;
  const success = mission.state === 'SUCCESS', progress = loadPractice(), best = progress.best[mission.id + ':' + mission.mode];
  return <div className="rv-result-overlay"><section ref={panel} className="rv-result-panel" data-outcome={mission.state} role="dialog" aria-modal="true" aria-labelledby="rv-result-title" onKeyDown={trapFocus}>
    <span className="rivals-overline">{success ? 'AEGIS SIGNAL LOST / EXTRACTION CONFIRMED' : 'AEGIS LOCKDOWN / INSERTION LOST'}</span>
    <div className="rv-result-emblem">{success ? <Trophy size={34} /> : <Crosshair size={34} />}</div>
    <p className="rv-result-mission">{mission.name} / NEON DISTRICT</p>
    <h2 id="rv-result-title">{success ? 'Mission complete.' : 'Regroup. Re-enter.'}</h2>
    <p>{success ? 'The Guardian is down. The Vault Core is yours. Get ready for the next insertion.' : mission.reason}</p>
    <dl className="rv-result-stats">
      <div><dt>Field time</dt><dd>{missionTime(mission.elapsed)}</dd></div><div><dt>Objectives</dt><dd>{mission.completed} / {mission.mandatory}</dd></div>
      <div><dt>Patrols defeated</dt><dd>{mission.stats.enemiesDefeated} / 3</dd></div><div><dt>Damage taken</dt><dd>{mission.stats.damageTaken} HP</dd></div>
      <div><dt>Shots / confirmed hits</dt><dd>{mission.stats.shots} / {mission.stats.hits}</dd></div><div><dt>Vault Guardian</dt><dd>{mission.stats.bossDefeated ? 'DEFEATED' : 'STANDING'}</dd></div>
    </dl>
    <ul className="rv-result-objectives" aria-label="Mission objectives">{mission.objectives.map(o => <li key={o.id} data-complete={o.state === 'COMPLETED'}><span>{o.state === 'COMPLETED' ? '✓' : '○'}</span>{o.title}</li>)}</ul>
    <aside className="rv-practice-reward"><ShieldCheck size={20} /><div><strong>{success ? '+' + mission.practiceXP + ' PRACTICE XP' : 'PRACTICE RUN RECORDED'}</strong><p>Local practice only. No currency, ranked score or account rewards.{success && Number.isFinite(best) ? ' Personal best (' + mission.mode + '): ' + missionTime(best) + '.' : ''}</p>{!saved && <p role="status">Browser storage is unavailable. This result has not been saved.</p>}</div></aside>
    <div className="rv-result-actions"><button className="rivals-primary" onClick={onRestart}><RotateCcw size={17} />{success ? 'REPLAY MISSION' : 'RESTART MISSION'}</button><button className="rivals-secondary" onClick={onLobby}><ArrowLeft size={16} />RETURN TO MAIN MENU</button></div>
  </section></div>;
}
