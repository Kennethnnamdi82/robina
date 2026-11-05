import { isWall, TRAINING_VAULT } from '../world/trainingVault';
import type { Vector } from '../core/contracts';
import { THE_LAUNCH,type LevelDefinition } from '../world/level';
import { useMemo } from 'react';

const walls = Array.from({ length: TRAINING_VAULT.height }, (_, y) => Array.from({ length: TRAINING_VAULT.width }, (_, x) => isWall(x, y) ? { x, y } : null)).flat().filter(Boolean);
const geometry = walls.map(wall => <rect key={wall!.x + ':' + wall!.y} x={wall!.x * 4} y={wall!.y * 4} width="4" height="4" fill="#405771" />);

export function MiniMap({ player, openDoors = [], objective, caption,level,route=[],enemies=[] }: { player: Vector; openDoors?: readonly string[]; objective?: Vector; caption?: string;level?:LevelDefinition;route?:readonly Vector[];enemies?:readonly Vector[] }) {
  const map=useMemo(()=>level?level.walls.flatMap((row,y)=>row.flatMap((wall,x)=>wall?[<rect key={x+':'+y} x={x*4} y={y*4} width="4" height="4" fill="#484d50"/>]:[])):geometry,[level]);
  return <div className="rivals-minimap" aria-label="Arena minimap">
    <svg viewBox={`0 0 ${(level?.width??TRAINING_VAULT.width) * 4} ${(level?.height??TRAINING_VAULT.height) * 4}`} role="img" aria-label="Live player and objective navigation">
      {map}
      {route.length>0&&<polyline aria-label="Accessible GPS route" points={[player,...route].map(p=>p.x/16+','+p.y/16).join(' ')} fill="none" stroke="#ff493f" strokeWidth="2" strokeLinejoin="round"/>}
      {enemies.map((p,i)=><circle key={i} cx={p.x/16} cy={p.y/16} r="1.8" fill="#ef6a64"/>)}
      {(level??THE_LAUNCH).objects.filter(o => ['door','extraction','vault','terminal'].includes(o.kind)).map(o => <rect key={o.id} x={o.x / 16 - 1.5} y={o.y / 16 - 1.5} width="3" height="3" fill={o.kind === 'door' ? openDoors.includes(o.id) ? '#6bf0b5' : '#ef9d60' : o.kind === 'vault' ? '#ffd069' : o.kind === 'extraction' ? '#79edab' : '#73baff'} />)}
      <circle cx={player.x / 16} cy={player.y / 16} r="2.8" fill="#61e8ff" stroke="#fff" strokeWidth="0.6" />
      {objective && <g aria-label="Mission objective marker"><circle cx={objective.x / 16} cy={objective.y / 16} r="4" fill="none" stroke="#ffcf72" strokeWidth=".8" /><path d={`M${objective.x / 16} ${objective.y / 16 - 2}l2 2 -2 2 -2 -2z`} fill="#ffe2a0" /></g>}
    </svg>
    <span aria-label={caption ? 'Security timing' : undefined}>{caption ?? 'NEON VAULT'}</span>
  </div>;
}
