/** World coordinates, in metres. Rendering, navigation and collision use this
 * same immutable plan. No camera information ever enters city generation. */
export const CITY_SIZE = 96;
export const STREET_CENTRES = [8, 32, 56, 80] as const;
export const ROAD_HALF = 4.6;
export const WALK_EDGE = 6.4;
export type CityDistrict = 'downtown' | 'industrial' | 'residential';
export type CityWeather = 'golden' | 'daylight' | 'night';
export interface CityBuilding { id: string; model: 'residence' | 'commerce' | 'headquarters'; x: number; z: number; width: number; depth: number; height: number; yaw: number }
export interface CityBlock { x: number; z: number; park: boolean; building?: CityBuilding }
export interface CityPlan { seed: number; district: CityDistrict; label: string; weather: CityWeather; blocks: CityBlock[]; buildings: CityBuilding[]; signature: string }
export interface CityPoint { x: number; z: number }
export function cityRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let n = value; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export function cityPlan(venue: number, seed: number): CityPlan {
  const random = cityRandom(seed), district = (['downtown', 'industrial', 'residential'] as const)[venue % 3];
  const variant=Math.floor((seed%21)/3),heightBands=[[22,32],[9,14],[30,44],[7,11],[8,14],[6,10],[8,12]][variant];
  const blocks: CityBlock[] = [], buildings: CityBuilding[] = [];
  for (let row = -1; row < 4; row++) for (let col = -1; col < 4; col++) {
    const x = 20 + col * 24, z = 20 + row * 24;
    // The original mission is now an outdoor civic square. Keep its devices,
    // patrols, phase-link route and vault access in these open blocks.
    const park = row === 0 && (col === 0 || col === 1) || row === 1 && col === 0 || row>=1&&col>=1&&((row*3+col+variant)%7===(variant===4?2:0));
    const variation=random();
    const model = district === 'residential' ? variation>.25?'residence':'commerce' : district === 'industrial' ? variation>.2?'commerce':'residence' : variation>.5?'headquarters':variation>.15?'commerce':'residence';
    const building: CityBuilding | undefined = park ? undefined : {
      id: `city-${col}-${row}`, model, x, z, width: 11.2, depth: 11.2,
      height: heightBands[0]+random()*(heightBands[1]-heightBands[0]),
      yaw: row<0?0:col%2===0?-Math.PI/2:Math.PI/2,
    };
    blocks.push({ x, z, park, building }); if (building) buildings.push(building);
  }
  // Entry always offers the requested sunset; later missions vary lighting.
  const weather = (['golden', 'golden', 'daylight', 'night'] as const)[(seed >>> 3) % 4];
  return { seed, district, weather, label: district === 'downtown' ? 'HELIX / DOWNTOWN' : district === 'industrial' ? 'EMBER / FREIGHT DISTRICT' : 'OBSIDIAN / GARDEN QUARTER', blocks, buildings,
    signature: 'district-layout-'+variant+'|'+buildings.map(b => `${b.id}:${b.model}:${b.height.toFixed(2)}`).join('|') };
}
export function buildingAt(plan: CityPlan, x: number, z: number) {
  return plan.buildings.find(b => Math.abs(x - b.x) < b.width / 2 && Math.abs(z - b.z) < b.depth / 2);
}
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
