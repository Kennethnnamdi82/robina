/** The seed reserves three district slots per contract. Keep the saved contract
 * indices stable while giving every stage its own art direction and geography. */
export const CAMPAIGN_DISTRICTS = [
  { name:'HELIX / FINANCIAL MILE', site:{x:44,z:20}, style:'financial', heights:[24,43], paving:0xa4a199, road:0x676765, foliage:1, accent:0xd6bd79, weather:'golden' },
  { name:'EMBER / RESEARCH ISLAND', site:{x:68,z:44}, style:'research', heights:[7,14], paving:0xadc3c3, road:0x535c61, foliage:.35, accent:0x5ee5de, weather:'daylight' },
  { name:'OBSIDIAN / NEON EXCHANGE', site:{x:68,z:68}, style:'corporate', heights:[38,64], paving:0x596675, road:0x454b59, foliage:.2, accent:0xb993f3, weather:'night' },
  { name:'CROSSLINE / PORT AUTHORITY', site:{x:44,z:20}, style:'port', heights:[5,10], paving:0x9c8d76, road:0x746c60, foliage:.1, accent:0xf3ae51, weather:'golden' },
  { name:'WESTHAVEN / GARDEN ESTATE', site:{x:44,z:68}, style:'garden', heights:[5,9], paving:0xc9bb9d, road:0x79766b, foliage:1.3, accent:0x90bb8c, weather:'daylight' },
  { name:'IRONWORKS / CONTAINER TERMINAL', site:{x:68,z:20}, style:'freight', heights:[5,12], paving:0x857d70, road:0x655b52, foliage:.08, accent:0xe58a49, weather:'night' },
  { name:'NORTHGATE / RESTRICTED ZONE', site:{x:20,z:68}, style:'military', heights:[5,11], paving:0x8c947d, road:0x606a5c, foliage:.25, accent:0xd8cb8b, weather:'golden' },
] as const;
export const campaignDistrict = (seed:number) => CAMPAIGN_DISTRICTS[Math.floor(((seed%21)+21)%21/3)];
export function cityParkPatches(seed:number){const site=campaignDistrict(seed).site;return[{x:20,z:20,width:7,depth:7},{x:44,z:20,width:6,depth:8},{x:20,z:44,width:8,depth:7}].filter(p=>p.x!==site.x||p.z!==site.z);}
