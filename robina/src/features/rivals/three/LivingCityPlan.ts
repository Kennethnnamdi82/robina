/** World coordinates, in metres. Rendering, navigation and collision use this
 * same immutable plan. No camera information ever enters city generation. */
import { campaignDistrict } from './CampaignDistrict';
export const CITY_SIZE = 96;
export const CITY_WIDTH = 144;
export const STREET_CENTRES = [8, 32, 56, 80] as const;
export const ROAD_HALF = 4.6;
export const WALK_EDGE = 6.4;
export type CityDistrict = 'downtown' | 'industrial' | 'residential';
export type CityWeather = 'golden' | 'daylight' | 'night';
export interface CityBuilding { id: string; model: 'residence' | 'commerce' | 'headquarters'; x: number; z: number; width: number; depth: number; height: number; yaw: number; name?:string }
export const WATERFRONT_BUILDINGS:readonly CityBuilding[]=[
  {id:'waterfront-hotel',name:'HOTEL MERIDIAN',model:'headquarters',x:126,z:20,width:11.2,depth:11.2,height:25,yaw:-Math.PI/2},
  {id:'waterfront-bar',name:'THE AMBER ROOM / BAR',model:'commerce',x:126,z:44,width:11.2,depth:11.2,height:8,yaw:-Math.PI/2},
];
export const BRIDGE_SPAN={from:98,to:114,halfWidth:5.8} as const;
/** Quay rails run along the water, never across one of the four avenues. */
export function waterfrontRails(){
  const rails:{x:number;z:number;width:number;depth:number}[]=[];let start=1.6;
  for(const end of [...STREET_CENTRES.map(z=>z-BRIDGE_SPAN.halfWidth),94.4]){
    if(end>start)for(const x of [99,113])rails.push({x,z:(start+end)/2,width:.14,depth:end-start});
    start=end===94.4?end:end+BRIDGE_SPAN.halfWidth*2;
  }return rails;
}
export interface CityBlock { x: number; z: number; park: boolean; building?: CityBuilding }
export interface CityPlan { seed: number; district: CityDistrict; label: string; weather: CityWeather; blocks: CityBlock[]; buildings: CityBuilding[]; signature: string }
export interface CityPoint { x: number; z: number }
export function cityRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let n = value; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export function cityPlan(venue: number, seed: number): CityPlan {
  const random = cityRandom(seed), district = (['downtown', 'industrial', 'residential'] as const)[venue % 3];
  const variant=Math.floor((seed%21)/3),profile=campaignDistrict(seed),heightBands=profile.heights;
  const missionLot=profile.site;
  const blocks: CityBlock[] = [], buildings: CityBuilding[] = [];
  for (let row = -1; row < 4; row++) for (let col = -1; col < 4; col++) {
    const x = 20 + col * 24, z = 20 + row * 24;
    // The original mission is now an outdoor civic square. Keep its devices,
    // patrols, phase-link route and vault access in these open blocks.
    const park = row === 0 && (col === 0 || col === 1) || row === 1 && col === 0 || x===missionLot.x&&z===missionLot.z || (variant===4?(row+col)%2===0:variant===3||variant===5?row>=1&&col>=1:row>=1&&col>=1&&((row*3+col+variant)%7===(variant===4?2:0)));
    const variation=random();
    const model = district === 'residential' ? variation>.25?'residence':'commerce' : district === 'industrial' ? variation>.2?'commerce':'residence' : variation>.5?'headquarters':variation>.15?'commerce':'residence';
    const footprints=[[9.6,12],[13.6,9.6],[10,10],[14,8],[8,9],[13,8],[12,10]][variant];
    const building: CityBuilding | undefined = park ? undefined : {
      id: `city-${col}-${row}`, model, x, z, width: footprints[0], depth: footprints[1],
      height: heightBands[0]+random()*(heightBands[1]-heightBands[0]),
      yaw: row<0?0:col%2===0?-Math.PI/2:Math.PI/2,
    };
    blocks.push({ x, z, park, building }); if (building) buildings.push(building);
  }
  // Entry always offers the requested sunset; later missions vary lighting.
  // The Amber Room now has an enterable, furnished interior, supplied by SocialScene.
  buildings.push(...WATERFRONT_BUILDINGS.filter(b=>b.id!=='waterfront-bar').map(b=>({...b})));
  const weather = profile.weather;
  return { seed, district, weather, label: profile.name, blocks, buildings,
    signature: 'district-layout-'+variant+'|'+buildings.map(b => `${b.id}:${b.model}:${b.height.toFixed(2)}`).join('|') };
}
export function buildingAt(plan: CityPlan, x: number, z: number) {
  return plan.buildings.find(b => Math.abs(x - b.x) < b.width / 2 && Math.abs(z - b.z) < b.depth / 2);
}
/** Width/depth describe world collision. Quarter-turn facades need swapped
 * local scales to keep their rendered footprint aligned with that collision. */
export function buildingPlacement(b:CityBuilding){const turned=Math.abs(Math.sin(b.yaw))>.5;return{...b,width:turned?b.depth:b.width,depth:turned?b.width:b.depth};}
export type TrafficAxis = 'x' | 'z';
export type SignalColor = 'green' | 'amber' | 'red';
/** Protected all-red pedestrian interval follows each pair of traffic phases. */
export function trafficPhase(time: number): { x: SignalColor; z: SignalColor; crossing: boolean; phase: number } {
  const phase = ((time % 34) + 34) % 34;
  return { x: phase < 11 ? 'green' : phase < 13 ? 'amber' : 'red', z: phase >= 15 && phase < 26 ? 'green' : phase >= 26 && phase < 28 ? 'amber' : 'red', crossing: phase >= 29, phase };
}
/** Clockwise right-turn block routes, in the right-hand lane. Corners are
 * rounded by sampling quadratic curves, not by snapping mesh headings. */
export function trafficRoute(col: number, row: number, span = 1): CityPoint[] {
  const left = STREET_CENTRES[col], top = STREET_CENTRES[row], right = left + 24 * span, bottom = top + 24 * span, lane = 2.1;
  const corners = [{ x: left + lane, z: top + lane }, { x: right - lane, z: top + lane }, { x: right - lane, z: bottom - lane }, { x: left + lane, z: bottom - lane }];
  const result: CityPoint[] = [], radius = 2.2;
  for (let i = 0; i < 4; i++) {
    const prev = corners[(i + 3) % 4], p = corners[i], next = corners[(i + 1) % 4];
    const a = Math.hypot(prev.x - p.x, prev.z - p.z), b = Math.hypot(next.x - p.x, next.z - p.z);
    const entry = { x: p.x + (prev.x - p.x) / a * radius, z: p.z + (prev.z - p.z) / a * radius };
    const exit = { x: p.x + (next.x - p.x) / b * radius, z: p.z + (next.z - p.z) / b * radius };
    for (let j = 0; j <= 6; j++) { const t = j / 6, u = 1 - t; result.push({ x: u * u * entry.x + 2 * u * t * p.x + t * t * exit.x, z: u * u * entry.z + 2 * u * t * p.z + t * t * exit.z }); }
  }
  return result;
}
