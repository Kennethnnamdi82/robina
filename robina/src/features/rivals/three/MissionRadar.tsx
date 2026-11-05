import { MiniMap } from '../ui/MiniMap';
import { useArenaValue } from '../ui/useArenaValue';
import type { SandboxSession } from './SandboxSession';
import type { Diagnostics3D } from './RaidRuntime';
export function MissionRadar({session,metrics}:{session:SandboxSession;metrics?:Diagnostics3D}){
  const player=useArenaValue(session,s=>s.player),mission=useArenaValue(session,s=>s.mission),enemies=useArenaValue(session,s=>s.enemies);
  const objective=mission?.objectives.find(o=>o.id===mission.activeId);
  return <div className="r3-mission-radar"><MiniMap level={session.operation.level} player={player} objective={metrics?.navigation?.goal??objective?.marker} route={metrics?.navigation?.route} enemies={enemies.filter(e=>e.health>0)} caption={`${Math.round(metrics?.navigation?.distance??0)}m / ${metrics?.vehicle?.driving?'DRIVE':'GPS'}`}/></div>;
}
