import type { Diagnostics3D } from './RaidRuntime';

/** Screen-reader announcements only; the objective and radar already give visual guidance. */
export function PursuitAnnouncement({metrics}:{metrics?:Diagnostics3D}) {
  const message=metrics?.pursuit?.active
    ? `POLICE RESPONSE / ${metrics.pursuit.units} UNITS${metrics.pursuit.evading>0?' / BREAKING CONTACT':''}`
    : metrics?.pursuit?.lost?'PURSUIT LOST / PROCEED TO EXTRACTION'
    : metrics?.campaign?.carrying?'OBJECTIVE SECURED':'';
  return <span className="r3-announcement" role="status" aria-live="polite">{message}</span>;
}
