import { isWall, TRAINING_VAULT } from '../world/trainingVault';
import type { Vector } from '../core/contracts';
import { THE_LAUNCH } from '../world/level';

const walls = Array.from({ length: TRAINING_VAULT.height }, (_, y) => Array.from({ length: TRAINING_VAULT.width }, (_, x) => isWall(x, y) ? { x, y } : null)).flat().filter(Boolean);
const geometry = walls.map(wall => <rect key={wall!.x + ':' + wall!.y} x={wall!.x * 4} y={wall!.y * 4} width="4" height="4" fill="#405771" />);

export function MiniMap({ player, openDoors = [], objective }: { player: Vector; openDoors?: readonly string[]; objective?: Vector }) {
  return <div className="rivals-minimap" aria-label="Arena minimap">
    <svg viewBox={`0 0 ${TRAINING_VAULT.width * 4} ${TRAINING_VAULT.height * 4}`} role="img" aria-label="Your position in Neon Vault">
      {geometry}
      {THE_LAUNCH.objects.filter(o => ['door','extraction','vault','terminal'].includes(o.kind)).map(o => <rect key={o.id} x={o.x / 16 - 1.5} y={o.y / 16 - 1.5} width="3" height="3" fill={o.kind === 'door' ? openDoors.includes(o.id) ? '#6bf0b5' : '#ef9d60' : o.kind === 'vault' ? '#ffd069' : o.kind === 'extraction' ? '#79edab' : '#73baff'} />)}
      <circle cx={player.x / 16} cy={player.y / 16} r="2.8" fill="#61e8ff" stroke="#fff" strokeWidth="0.6" />
      {objective && <g aria-label="Mission objective marker"><circle cx={objective.x / 16} cy={objective.y / 16} r="4" fill="none" stroke="#ffcf72" strokeWidth=".8" /><path d={`M${objective.x / 16} ${objective.y / 16 - 2}l2 2 -2 2 -2 -2z`} fill="#ffe2a0" /></g>}
    </svg>
    <span>NEON VAULT</span>
  </div>;
}
