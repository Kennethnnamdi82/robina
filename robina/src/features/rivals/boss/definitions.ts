export type BossPhase = 'A' | 'B' | 'C';
export type BossAbility = 'burst' | 'charge' | 'pulse' | 'reposition';
export type BossState = 'DORMANT' | 'INTRO' | 'READY' | 'WINDUP' | 'ACTIVE' | 'RECOVERY' | 'TRANSITION' | 'STAGGERED' | 'DEFEATED';
export interface BossDefinition {
  id: string; name: string; health: number; spawn: { x: number; y: number }; intro: number;
  thresholds: { B: number; C: number }; stagger: { damage: number; seconds: number; cooldown: number };
  phases: Record<BossPhase, { speed: number; cadence: number; pattern: readonly BossAbility[] }>;
  abilities: Record<BossAbility, { windup: number; active: number; recovery: number; cooldown: number; damage: number; speed: number; count: number; spread: number; radius: number }>;
}
export const VAULT_GUARDIAN: BossDefinition = {
  id: 'vault-guardian', name: 'VAULT GUARDIAN', health: 450, spawn: { x: 1408, y: 224 }, intro: 1.6,
  thresholds: { B: .65, C: .3 }, stagger: { damage: 150, seconds: 1.1, cooldown: 9 },
  phases: {
    A: { speed: 48, cadence: 1.25, pattern: ['burst', 'charge'] },
    B: { speed: 64, cadence: .85, pattern: ['burst', 'reposition', 'charge', 'pulse'] },
    C: { speed: 70, cadence: .6, pattern: ['charge', 'pulse', 'burst', 'reposition'] },
  },
  abilities: {
    burst: { windup: .85, active: .2, recovery: 1.05, cooldown: 2.4, damage: 9, speed: 250, count: 3, spread: .24, radius: 0 },
    charge: { windup: 1.15, active: .18, recovery: 1.35, cooldown: 4.5, damage: 18, speed: 320, count: 1, spread: 0, radius: 0 },
    pulse: { windup: 1.4, active: .18, recovery: 1.4, cooldown: 5, damage: 16, speed: 0, count: 1, spread: 0, radius: 88 },
    reposition: { windup: .65, active: .35, recovery: .8, cooldown: 4, damage: 0, speed: 220, count: 0, spread: 0, radius: 0 },
  },
};
