import type { HeistMissionDefinition, MissionObjective } from './types';
import {CAMPAIGN_DISTRICTS} from '../three/CampaignDistrict';

export interface Assignment {
  id: string; name: string; type: string; location: string; description: string; target: string;
  district: number; site: { x: number; z: number }; extraction: { x: number; z: number };
  tasks: readonly string[]; security: number; response: number; vehicleDelivery?: boolean; hostage?: boolean; convoy?: boolean;
  entry?:{x:number;z:number}; holdTask?:number; holdSeconds?:number;
  bridge?:boolean; bossHandoff?:boolean;
}
// Immutable mission data. Coordinates are metres; adapters explicitly convert
// to the existing gameplay engine's coordinates instead of mixing units.
const CATALOG: readonly Assignment[] = [
  {id:'reserve',name:'THE RESERVE',type:'BANK HEIST',location:'Helix / Financial district',description:'Enter the bank, collect the marked classified briefcase and escape. Police respond when you enter: fight or slip past them, lose contact and return the case to the riverside pickup.',target:'Classified briefcase',district:0,site:{x:44,z:20},extraction:{x:8,z:80},tasks:[],security:3,response:2},
  {id:'reactor',name:'EMBER PROTOCOL',type:'LABORATORY RAID',location:'Ember / Research quarter',description:'Disable laboratory containment, collect both chemical components and extract the sealed production formula. Police will mobilize when containment is breached.',target:'Sealed chemical case',district:1,site:{x:20,z:44},extraction:{x:80,z:8},tasks:['Disable laboratory containment','Recover catalyst A','Recover reagent B'],security:4,response:2},
  {id:'convoy',name:'MOVING TARGET',type:'CONVOY INTERCEPTION',location:'Crossline / Logistics interchange',description:'Intercept the marked cargo transport. Stop it, take its manifest and deliver the recovered transport intact to the freight depot.',target:'Armored cargo manifest',district:1,site:{x:44,z:20},extraction:{x:8,z:80},tasks:['Intercept and commandeer the marked transport'],security:4,response:2,vehicleDelivery:true,convoy:true},
  {id:'hostage',name:'SAFE PASSAGE',type:'HOSTAGE RESCUE',location:'Westhaven / Residential quarter',description:'Cut the holding-room lock and escort the captive through the district. Stay close on foot, or let them board your vehicle before driving to the safehouse.',target:'Rescued witness',district:2,site:{x:20,z:20},extraction:{x:80,z:80},tasks:['Release the captive'],security:4,response:2,hostage:true},
  {id:'archive',name:'SILENT ARCHIVE',type:'CORPORATE INFILTRATION',location:'Obsidian / Corporate centre',description:'Authenticate at two separate access nodes, download the corporate dossier and bring the data out through the garden extraction.',target:'Encrypted corporate dossier',district:0,site:{x:20,z:44},extraction:{x:80,z:8},tasks:['Authenticate the west network node','Authenticate the east network node','Download the encrypted dossier'],security:5,response:3},
  {id:'cargo',name:'LOST FREIGHT',type:'CARGO RECOVERY',location:'Ironworks / Freight yards',description:'Recover the stolen shipment from the yard. Load its cargo into a van or heavy vehicle and return it to the depot without destroying your transport.',target:'Recovered shipment',district:1,site:{x:20,z:20},extraction:{x:80,z:56},tasks:['Identify the shipment serial','Release the cargo clamps'],security:5,response:3,vehicleDelivery:true},
  {id:'military',name:'BLACK STANDARD',type:'MILITARY FACILITY RAID',location:'Northgate / Military perimeter',description:'Disable the perimeter relay and command uplink, recover the equipment case and escape a reinforced response. Extraction requires the actual case, not just defeated soldiers.',target:'Designated equipment case',district:1,site:{x:44,z:20},extraction:{x:8,z:80},tasks:['Disable the perimeter relay','Disconnect the command uplink','Unlock the equipment cage'],security:6,response:3},
];
// Preserve existing saved dossier indices while extending the campaign.
const stages = [
  {name:'THE LAST DEPOSIT',description:'The bank is open. Enter through the lobby or side passages, take the manager’s vault key and start the drill. Keep the vault operation running while police close in, recover the briefcase, then break contact and cross Meridian Bridge to the getaway.',site:{x:44,z:20},extraction:{x:136,z:32},entry:{x:8,z:32},tasks:["Take the manager's vault key",'Start the vault drill and hold the bank'],holdTask:1,holdSeconds:12},
  {name:'COLD REACTION',site:{x:68,z:44},extraction:{x:136,z:56},entry:{x:80,z:8},holdTask:0,holdSeconds:16},
  {name:'GHOST IN THE GLASS',site:{x:68,z:68},extraction:{x:8,z:80},entry:{x:8,z:56},holdTask:2,holdSeconds:20},
  {name:'RUNNING RED',site:{x:44,z:20},extraction:{x:136,z:80},entry:{x:80,z:32}},
  {name:'NO ONE LEFT BEHIND',site:{x:44,z:68},extraction:{x:136,z:8},entry:{x:56,z:80}},
  {name:'MIDNIGHT MANIFEST',site:{x:68,z:20},extraction:{x:136,z:56},entry:{x:8,z:8},holdTask:1,holdSeconds:24},
  {name:'BLACK STANDARD',site:{x:20,z:68},extraction:{x:136,z:80},entry:{x:80,z:80},holdTask:1,holdSeconds:28},
] as const;
const BRIEFINGS = [
  'Helix Reserve is open for business. Enter through the main doors or a side opening, take the manager’s vault key, and hold the drill position until the time lock releases. Collect the classified case, lose the police, then cross Meridian Bridge. Meet the Broker at the waterfront table and hand over the case to collect your cut. Leave the customers and cashiers unharmed.',
  'Ember Island’s containment team is guarding a sealed formula. Override containment and defend the control point for 16 seconds, then collect the catalyst and reagent before recovering the chemical case. Escape across the river with the sealed case and break police contact before using the research pickup. This job is about the formula, not emptying a bank.',
  'Obsidian’s secure data floor has two independent access nodes. Authenticate the west and east terminals, hold the download for 20 seconds, and collect the encrypted dossier. Use the neon district’s side streets to lose the police, then return the data to the garden extraction. Your mission cash and achievement coins arrive only after delivery.',
  'A bonded cargo transport is moving through Crossline. Follow the road marker to the truck, take control of it and recover its manifest. Drive that same marked vehicle to the freight extraction without destroying it. Shake pursuit before delivery: arriving on foot or in another car will not complete the job.',
  'A witness is being held inside the Westhaven garden house. Reach the holding room, release the captive, and escort them out alive. Stay nearby on foot, or let the witness board before you drive away. Lose the police and bring the witness all the way to the eastern safehouse. The witness, not a bag, is your objective.',
  'Ironworks has impounded a stolen shipment. Verify its serial and defend the clamp-release device for 24 seconds, then collect the cargo. Load it into a van or heavy vehicle and deliver that loaded vehicle intact across the bridge. Once the police lose contact, meet the Broker and sign over the shipment for your share.',
  'Northgate is on full alert. Disable the perimeter relay, hold the command-uplink disconnect for 28 seconds, and unlock the equipment cage. Recover the designated case and fight your way out of the restricted zone. Break pursuit before meeting the Broker at the far-side handoff. Heavy security makes this the highest-risk original contract.',
] as const;
export const ASSIGNMENTS:readonly Assignment[]=[
  ...[CATALOG[0],CATALOG[1],CATALOG[4],CATALOG[2],CATALOG[3],CATALOG[5],CATALOG[6]].map((a,i)=>({...a,...stages[i],description:BRIEFINGS[i],site:CAMPAIGN_DISTRICTS[i].site,security:3+i,response:Math.min(4,1+Math.floor(i/2)),bossHandoff:[0,5,6].includes(i)})),
  {id:'bridge',name:'TOLL OF THE DEAD',type:'BRIDGE CASH INTERCEPTION',location:'Meridian Bridge / Eastbound span',description:'The courier exchange is exposed on Meridian Bridge. Take a vehicle and follow the road marker onto the span. Dismount behind the concrete cover, eliminate the bridge security team, and open the courier case to recover the money bag. Escape the police and meet the Broker’s waterfront crew for a face-to-face handoff. He pays your cut; your revive coins are awarded only when the job is complete.',target:'Courier money bag',district:0,site:{x:106,z:32},extraction:{x:136,z:64},entry:{x:80,z:56},tasks:['Open the courier case'],security:10,response:4,bridge:true,bossHandoff:true},
  {id:'bridge-night',name:'LAST LIGHT PAYDAY',type:'NIGHT BRIDGE AMBUSH',location:'Southbank Bridge / Midnight transfer',description:'An armored payroll transfer is waiting on Southbank Bridge. Drive to the southern span, use the barriers as cover, and eliminate every payroll guard before releasing the cash bag. Expect reinforced police and vehicle pursuit. Carry the money to the Broker’s southern waterfront table, lose all active pursuit, and hand over the bag. This late-campaign job pays the largest achievement-coin award.',target:'Armored payroll bag',district:1,site:{x:106,z:80},extraction:{x:136,z:88},entry:{x:136,z:8},tasks:['Release the armored payroll bag'],security:12,response:4,bridge:true,bossHandoff:true},
];
export const assignmentAt = (index: number) => ASSIGNMENTS[Math.max(0,Math.min(ASSIGNMENTS.length-1,index))];
export function assignmentObjectives(a: Assignment): MissionObjective[] {
  const marker=(x:number,z:number)=>({x:x*40,y:z*40});
  const tasks:MissionObjective[] = a.tasks.map((title,i)=>({id:'task-'+i,title,stage:a.holdTask===i?'HOLD POSITION':'ON SITE',event:'task-'+i,prerequisites:[i?'task-'+(i-1):a.id==='reserve'?'locate':'security'],marker:a.id==='reserve'?marker(a.site.x+(i===0?-3:0),a.site.z+(i===0?1:-2)):marker(a.site.x-2+i*2,a.site.z-1)}));
  return [
    {id:'locate',title:a.bridge?'Drive to the marked bridge':a.convoy?'Locate the moving cargo transport':'Enter '+a.location.split(' / ')[0],stage:a.bridge?'DRIVE TO THE BRIDGE':'INFILTRATION',event:'site-entered',prerequisites:[],marker:marker(a.site.x,a.site.z+(a.bridge?0:5))},
    ...(a.id==='reserve'?[]:[{id:'security',title:a.bridge?'Eliminate the bridge security team':a.convoy?'Identify the transport':'Bypass the site access control or defeat security',stage:'SECURITY',event:'site-secured',prerequisites:['locate'],marker:marker(a.site.x-4,a.site.z+2)}]),
    ...tasks,
    {id:'recover',title:a.hostage?'Escort the released witness':'Recover '+a.target,stage:'RECOVERY',event:'cargo-recovered',prerequisites:[tasks.length?'task-'+(tasks.length-1):a.id==='reserve'?'locate':'security'],marker:marker(a.site.x,a.site.z-(a.id==='reserve'?4.3:2))},
    {id:'escape',title:'Reach extraction under pursuit',stage:'EVASION',event:'extraction-approach',prerequisites:['recover'],marker:marker(a.extraction.x,a.extraction.z)},
    {id:'extract',title:a.bossHandoff?'Meet the Broker and hand over '+a.target:a.vehicleDelivery?'Deliver the recovered cargo vehicle':a.hostage?'Bring the witness to the safehouse':'Deliver '+a.target+' to extraction',stage:a.bossHandoff?'BOSS HANDOFF':'EXTRACTION',event:'extraction',prerequisites:['recover','escape'],marker:marker(a.extraction.x,a.extraction.z)},
  ];
}
export function assignmentMission(a:Assignment):HeistMissionDefinition {
  return {id:'assignment-'+a.id,version:2,name:a.name,description:a.description,difficulty:'Adaptive security',prerequisites:[],spawn:{x:288,y:288},replayable:true,timer:{seconds:null,warnings:[]},failures:['player-down'],rewards:{practiceXP:100,optionalXP:0,economic:false},boss:{id:'none',prerequisites:['never'],unlock:'none'},success:['extract'],objectives:assignmentObjectives(a)};
}
