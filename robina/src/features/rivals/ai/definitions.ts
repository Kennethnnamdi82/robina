import type { Point } from './navigation';
export type EnemyState = 'IDLE' | 'PATROL' | 'SUSPICIOUS' | 'INVESTIGATE' | 'ALERT' | 'CHASE' | 'ATTACK' | 'SEARCH' | 'RETURN_TO_PATROL' | 'HURT' | 'STUNNED' | 'DEAD';
export interface EnemyConfig {
  health: number; damage: number; speed: number; vision: number; cone: number; detectionSeconds: number;
  hearing: number; alertRange: number; attackDistance: number; minimumDistance: number; interval: number; windup: number;
  accuracy: number; pursuit: number; searchSeconds: number; art: 'vex' | 'nyx' | 'rook'; tint: number;
}
export const ENEMY_TYPES: Record<'guard' | 'enforcer' | 'heavy', EnemyConfig> = {
  guard: { health: 75, damage: 8, speed: 92, vision: 300, cone: .8, detectionSeconds: 1, hearing: 420, alertRange: 800, attackDistance: 220, minimumDistance: 90, interval: 1.8, windup: .5, accuracy: .09, pursuit: 600, searchSeconds: 4, art: 'vex', tint: 0xffca9a },
  enforcer: { health: 100, damage: 10, speed: 100, vision: 340, cone: .7, detectionSeconds: .9, hearing: 460, alertRange: 800, attackDistance: 300, minimumDistance: 175, interval: 2.1, windup: .7, accuracy: .06, pursuit: 650, searchSeconds: 5, art: 'nyx', tint: 0xffa299 },
  heavy: { health: 175, damage: 22, speed: 62, vision: 280, cone: .8, detectionSeconds: 1.2, hearing: 400, alertRange: 650, attackDistance: 240, minimumDistance: 60, interval: 3.2, windup: 1.25, accuracy: .025, pursuit: 500, searchSeconds: 5, art: 'rook', tint: 0xffbf79 },
};
export interface EnemySpawn { id: string; type: keyof typeof ENEMY_TYPES; x: number; y: number; angle: number; patrol: readonly Point[] }
export const AI_RULES = { decisionSeconds: .16, repathSeconds: .8, maximumPursuers: 2, stunSeconds: .22 } as const;
