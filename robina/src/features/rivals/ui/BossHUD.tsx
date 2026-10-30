import type { ArenaSession } from '../core/session';
import { useArenaValue } from './useArenaValue';
const phases = { A: 'DEFENSIVE', B: 'AGGRESSIVE', C: 'FINAL STAND' };
export function BossHUD({ session }: { session: ArenaSession }) {
  useArenaValue(session, s => [s.boss?.state,s.boss?.phase,s.boss?.health,s.boss?.ability].join(':'));
  const boss = session.getSnapshot().boss;
  if (!boss || boss.state === 'DORMANT' || boss.state === 'DEFEATED') return null;
  const warning = boss.state === 'WINDUP' ? '⚠ ' + boss.ability?.toUpperCase() + ' / MOVE NOW' : boss.state === 'INTRO' ? 'AEGIS WARDEN // LOCKDOWN ENGAGED' : boss.state === 'TRANSITION' ? 'ARMOR SHIFT / SHIELDED' : boss.vulnerable ? 'VULNERABLE / COUNTERATTACK' : boss.shielded ? 'SHIELD / HALF DAMAGE' : 'WATCH THE TELEGRAPHS';
  return <aside className="rv-boss-hud" data-phase={boss.phase} aria-label="Vault Guardian encounter">
    <header><strong>{boss.name}</strong><span>{boss.health} / {boss.maximum}</span></header>
    <div className="rv-boss-track" role="progressbar" aria-label="Vault Guardian health" aria-valuemin={0} aria-valuemax={boss.maximum} aria-valuenow={boss.health}><i style={{ width: boss.health / boss.maximum * 100 + '%' }} /><b style={{ left: '65%' }} /><b style={{ left: '30%' }} /></div>
    <p><span>PHASE {boss.phase} / {phases[boss.phase]}</span><small role="status">{warning}</small></p>
    {boss.state === 'INTRO' && <button className="rivals-text-button" onClick={session.skipBossIntro}>SKIP REVEAL</button>}
  </aside>;
}
