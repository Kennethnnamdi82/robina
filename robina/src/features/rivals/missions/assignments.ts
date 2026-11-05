import type { HeistMissionDefinition, MissionObjective } from './types';

export interface Assignment {
  id: string; name: string; type: string; location: string; description: string; target: string;
  district: number; site: { x: number; z: number }; extraction: { x: number; z: number };
  tasks: readonly string[]; security: number; response: number; vehicleDelivery?: boolean; hostage?: boolean; convoy?: boolean;
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
export const ASSIGNMENTS:readonly Assignment[]=[CATALOG[0],CATALOG[1],CATALOG[4],CATALOG[2],CATALOG[3],CATALOG[5],CATALOG[6]];
export const assignmentAt = (index: number) => ASSIGNMENTS[Math.max(0,Math.min(ASSIGNMENTS.length-1,index))];
export function assignmentObjectives(a: Assignment): MissionObjective[] {
  const marker=(x:number,z:number)=>({x:x*40,y:z*40});
  const tasks:MissionObjective[] = a.tasks.map((title,i)=>({id:'task-'+i,title,stage:'ON SITE',event:'task-'+i,prerequisites:[i?'task-'+(i-1):'security'],marker:marker(a.site.x-2+i*2,a.site.z-1)}));
  return [
    {id:'locate',title:'Locate '+a.location.split(' / ')[0],stage:'INFILTRATION',event:'site-entered',prerequisites:[],marker:marker(a.site.x,a.site.z+5)},
    ...(a.id==='reserve'?[]:[{id:'security',title:'Overcome the site security',stage:'SECURITY',event:'site-secured',prerequisites:['locate'],marker:marker(a.site.x,a.site.z+2)}]),
    ...tasks,
    {id:'recover',title:a.hostage?'Escort the released witness':'Recover '+a.target,stage:'RECOVERY',event:'cargo-recovered',prerequisites:[a.id==='reserve'?'locate':'task-'+(tasks.length-1)],marker:marker(a.site.x,a.site.z-2)},
    {id:'escape',title:'Reach extraction under pursuit',stage:'EVASION',event:'extraction-approach',prerequisites:['recover'],marker:marker(a.extraction.x,a.extraction.z)},
    {id:'extract',title:a.vehicleDelivery?'Deliver the recovered cargo vehicle':a.hostage?'Bring the witness to the safehouse':'Deliver '+a.target+' to extraction',stage:'EXTRACTION',event:'extraction',prerequisites:['recover','escape'],marker:marker(a.extraction.x,a.extraction.z)},
  ];
}
export function assignmentMission(a:Assignment):HeistMissionDefinition {
  return {id:'assignment-'+a.id,version:2,name:a.name,description:a.description,difficulty:'Adaptive security',prerequisites:[],spawn:{x:288,y:288},replayable:true,timer:{seconds:null,warnings:[]},failures:['player-down'],rewards:{practiceXP:100,optionalXP:0,economic:false},boss:{id:'none',prerequisites:['never'],unlock:'none'},success:['extract'],objectives:assignmentObjectives(a)};
}
