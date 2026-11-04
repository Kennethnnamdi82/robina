import type { CityModel } from './CityAssets';

export type DistrictId = 'downtown' | 'industrial' | 'compound';
export type DistrictBuilding = { model: Extract<CityModel,'residence'|'commerce'|'headquarters'>; x:number; z:number; yaw?:number; scale?:number };

export interface DistrictPlan {
  id: DistrictId;
  label: string;
  /** Visual-only exterior shells. Gameplay collision is always derived from level walls. */
  skyline: readonly DistrictBuilding[];
  crossRoads: readonly { x:number; z:number; yaw?:number }[];
  planters: readonly { x:number; z:number }[];
  utility: readonly { x:number; z:number; kind:'ac'|'barrel'|'vent' }[];
}

const plans: readonly Omit<DistrictPlan,'skyline'>[] = [
  {
    id:'downtown',label:'HELIX FINANCIAL DISTRICT',
    crossRoads:[{x:-7,z:-7},{x:51.8,z:6,yaw:Math.PI/2},{x:51.8,z:30,yaw:Math.PI/2},{x:5,z:42.2},{x:35,z:42.2}],
    planters:[{x:-2.7,z:4},{x:-2.7,z:16},{x:-2.7,z:28},{x:47.5,z:6},{x:47.5,z:23},{x:6,z:-2.7},{x:23,z:-2.7},{x:12,z:37.3},{x:34,z:37.3}],
    utility:[{x:12,z:-22,kind:'ac'},{x:33,z:-23,kind:'ac'},{x:64,z:15,kind:'ac'}],
  },
  {
    id:'industrial',label:'EMBER ENERGY YARDS',
    crossRoads:[{x:-7,z:1},{x:-7,z:25},{x:8,z:42.2},{x:38,z:42.2},{x:51.8,z:12,yaw:Math.PI/2},{x:51.8,z:30,yaw:Math.PI/2}],
    planters:[{x:-2.7,z:7},{x:-2.7,z:27},{x:47.5,z:10},{x:47.5,z:29},{x:8,z:37.3},{x:38,z:37.3}],
    utility:[{x:-12,z:2,kind:'barrel'},{x:-12,z:7,kind:'barrel'},{x:59,z:29,kind:'vent'},{x:60,z:34,kind:'vent'},{x:35,z:-23,kind:'ac'}],
  },
  {
    id:'compound',label:'OBSIDIAN SECURITY CAMPUS',
    crossRoads:[{x:-7,z:-7},{x:-7,z:42.2},{x:10,z:42.2},{x:42,z:42.2},{x:51.8,z:3,yaw:Math.PI/2},{x:51.8,z:27,yaw:Math.PI/2}],
    planters:[{x:-2.7,z:5},{x:-2.7,z:15},{x:-2.7,z:25},{x:47.5,z:5},{x:47.5,z:15},{x:47.5,z:25},{x:10,z:37.3},{x:42,z:37.3}],
    utility:[{x:11,z:-22,kind:'ac'},{x:33,z:-23,kind:'ac'},{x:64,z:15,kind:'ac'},{x:61,z:21,kind:'vent'}],
  },
] as const;

const skyline: Record<DistrictId,readonly DistrictBuilding[]> = {
  downtown:[
    {model:'commerce',x:-20,z:8,scale:.92},{model:'residence',x:10,z:-23,scale:.86},{model:'commerce',x:31,z:-24,scale:1},
    {model:'headquarters',x:65,z:13,yaw:-Math.PI/2,scale:.86},{model:'headquarters',x:65,z:49,yaw:Math.PI,scale:1.08},{model:'residence',x:17,z:60,yaw:Math.PI,scale:.9},
  ],
  industrial:[
    {model:'commerce',x:-21,z:7,scale:1.05},{model:'headquarters',x:9,z:-24,scale:.82},{model:'commerce',x:34,z:-24,scale:.9},
    {model:'commerce',x:65,z:13,yaw:-Math.PI/2,scale:1.04},{model:'headquarters',x:65,z:49,yaw:Math.PI,scale:.9},{model:'commerce',x:16,z:60,yaw:Math.PI,scale:1.05},
  ],
  compound:[
    {model:'headquarters',x:-21,z:8,scale:1.08},{model:'headquarters',x:10,z:-24,scale:.94},{model:'headquarters',x:34,z:-24,scale:1.02},
    {model:'headquarters',x:65,z:13,yaw:-Math.PI/2,scale:.94},{model:'headquarters',x:65,z:49,yaw:Math.PI,scale:1.16},{model:'headquarters',x:17,z:60,yaw:Math.PI,scale:.96},
  ],
};

/** A seeded exterior composition. Its data never participates in movement or AI navigation. */
export function districtPlan(venue:number,seed:number): DistrictPlan {
  const base=plans[((venue % plans.length) + plans.length) % plans.length]!;
  // Swap two distant shells per restart, retaining an authored street rhythm.
  const shells=[...skyline[base.id]];
  if ((seed >>> 0) & 1) [shells[0],shells[1]]=[shells[1]!,shells[0]!];
  if ((seed >>> 1) & 1) [shells[3],shells[4]]=[shells[4]!,shells[3]!];
  return {...base,skyline:shells};
}
