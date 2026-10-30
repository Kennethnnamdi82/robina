import type { Point } from '../ai/navigation';
export interface CameraDefinition extends Point { id: string; angle: number; sweep: number; period: number; range: number; cone: number; detection: number }
export interface LaserDefinition { id: string; a: Point; b: Point; off: number; warning: number; active: number; offset: number; damage: number }
export interface HackDefinition { id: string; objectId: string; sequence: readonly number[]; timeLimit: number; disable: readonly string[]; disableSeconds: number }
export interface SecurityDefinition {
  cameras: readonly CameraDefinition[]; lasers: readonly LaserDefinition[]; hacks: readonly HackDefinition[];
  sequence: { start: string; finish: string; grant: string; off: number; warning: number; open: number; deadline: number };
}
export const HEIST_SECURITY: SecurityDefinition = {
  cameras: [
    { id: 'optics-a', x: 568, y: 176, angle: Math.PI / 2, sweep: .6, period: 7, range: 220, cone: .35, detection: 1.25 },
    { id: 'optics-b', x: 1152, y: 832, angle: -2.35, sweep: .65, period: 8, range: 300, cone: .42, detection: 1 },
  ],
  lasers: [
    { id: 'vault-grid', a: { x: 1024, y: 544 }, b: { x: 1152, y: 544 }, off: 3, warning: 1, active: 2, offset: 0, damage: 12 },
    { id: 'east-grid', a: { x: 1480, y: 928 }, b: { x: 1664, y: 928 }, off: 3.5, warning: 1, active: 1.5, offset: 2, damage: 12 },
  ],
  hacks: [{ id: 'sector-hack', objectId: 'sector-console', sequence: [2, 4, 1, 3], timeLimit: 0, disable: ['vault-grid', 'optics-b'], disableSeconds: 24 }],
  sequence: { start: 'sequence-start', finish: 'sequence-end', grant: 'timed-access', off: 2, warning: 1, open: 5, deadline: 3.5 },
};
