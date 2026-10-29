import { isWall, TRAINING_VAULT } from '../world/trainingVault';
import type { Vector } from '../core/contracts';

const walls = Array.from({ length: TRAINING_VAULT.height }, (_, y) => Array.from({ length: TRAINING_VAULT.width }, (_, x) => isWall(x, y) ? { x, y } : null)).flat().filter(Boolean);

export function MiniMap({ player }: { player: Vector }) {
  return <div className="rivals-minimap" aria-label="Arena minimap">
    <svg viewBox={`0 0 ${TRAINING_VAULT.width * 4} ${TRAINING_VAULT.height * 4}`} role="img" aria-label="Your position in Neon Vault">
      {walls.map(wall => <rect key={`${wall!.x}:${wall!.y}`} x={wall!.x * 4} y={wall!.y * 4} width="4" height="4" fill="#405771" />)}
      <circle cx={player.x / 16} cy={player.y / 16} r="2.8" fill="#61e8ff" stroke="#fff" strokeWidth="0.6" />
    </svg>
    <span>NEON VAULT</span>
  </div>;
}
