import { Box3, Vector3 } from 'three';
import { THE_LAUNCH } from '../world/level';
import type { WorldState } from '../world/WorldState';
import { buildingAt, cityPlan } from './LivingCityPlan';
import {siteLayout} from './SiteLayout';
import {assignmentAt} from '../missions/assignments';

export const METRES = .025;
export interface Solid3D { id: string; box: Box3; enabled: boolean; kind: 'wall' | 'door' | 'cover' | 'platform'; oriented?: {center:Vector3;half:Vector3;yaw:number} }
export const point3 = (x: number,y: number,elevation = 0) => new Vector3(x * METRES,elevation,y * METRES);
export const platformDefinitions = [
  { id: 'dev-step-1',x: 96,z: 480,width: 40,depth: 48,height: .28 },
  { id: 'dev-step-2',x: 144,z: 480,width: 40,depth: 48,height: .5 },
  { id: 'dev-platform',x: 192,z: 480,width: 48,depth: 64,height: .68 },
] as const;
/** Non-destructive conversion; legacy IDs/footprints remain the source of truth. */
export function convertSolids(world: WorldState): Solid3D[] {
  const seed=Number(world.level.id.replace('operation-',''));
  const city=Number.isFinite(seed)?cityPlan(seed%3,seed):undefined;
  const site=Number.isFinite(seed)?siteLayout(assignmentAt(Math.floor(seed%21/3))):[];
  return [
    ...world.blockers.map(b => {
      const kind: Solid3D['kind'] = b.id.startsWith('wall-')||b.id.startsWith('mission-wall-') ? 'wall' : ['transit-door','vault-gate','vault','guardian-lockdown','mission-vault-door'].includes(b.id) ? 'door' : 'cover';
      const part=b.id.match(/^mission-(?:wall|furniture)-(\d+)$/);
      const height = part?site[Number(part[1])]?.height??1.05:kind === 'wall' ? (city?buildingAt(city,b.x*METRES,b.y*METRES)?.height??3.4:3.4) : kind === 'door' ? 3.1 : b.id.startsWith('task-')?1.3:b.id.includes('console') || b.id.startsWith('relay') ? 1.25 : 1.05;
      return { id: b.id,enabled: b.enabled,kind,box: new Box3(new Vector3((b.x - b.width / 2) * METRES,0,(b.y - b.height / 2) * METRES),new Vector3((b.x + b.width / 2) * METRES,height,(b.y + b.height / 2) * METRES)) };
    }),
    ...(city?[]:platformDefinitions).map(p => ({ id: p.id,enabled: true,kind: 'platform' as const,box: new Box3(new Vector3((p.x - p.width / 2) * METRES,0,(p.z - p.depth / 2) * METRES),new Vector3((p.x + p.width / 2) * METRES,p.height,(p.z + p.depth / 2) * METRES)) })),
  ];
}
export function validateConversion(solids: readonly Solid3D[],level = THE_LAUNCH) {
  const ids = new Set<string>();
  for (const s of solids) { if (ids.has(s.id) || s.box.isEmpty() || [...s.box.min.toArray(),...s.box.max.toArray()].some(n => !Number.isFinite(n))) throw new Error('Invalid converted solid: ' + s.id); ids.add(s.id); }
  return { width: level.width * level.tileSize * METRES,depth: level.height * level.tileSize * METRES,solids: solids.length };
}
