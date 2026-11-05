import { THE_LAUNCH,type LevelDefinition } from '../world/level';
import { launchMission } from '../missions/definitions';
import { WorldState } from '../world/WorldState';
import { NavigationGrid } from '../ai/navigation';
import { buildingAt, cityPlan, CITY_SIZE, STREET_CENTRES } from './LivingCityPlan';
import { ASSIGNMENTS, assignmentAt, assignmentMission } from '../missions/assignments';

export const VENUES = [
  { name:'HELIX RESERVE',building:'Corporate bank',core:'Reserve Cipher',accent:0xd4ad65,sky:0xa9bbc3 },
  { name:'EMBER REACTOR',building:'Energy research facility',core:'Reactor Seed',accent:0xf19c62,sky:0xb8aaa0 },
  { name:'OBSIDIAN ARCHIVE',building:'Intelligence headquarters',core:'Archive Key',accent:0x80c9ce,sky:0x8ba9b7 },
] as const;
export interface Operation3D { seed:number; ordinal:number; venue:number; level:LevelDefinition; mission:ReturnType<typeof launchMission>; fingerprint:string; assignment?:number }
let sequence=0; const salt=crypto.getRandomValues(new Uint32Array(1))[0];
const validatedRoutes=new Set<string>();
/** Outdoor blocks share the art/collision plan. The original objectives and
 * their prerequisites retain validated routes through the civic plazas. */
export function createOperation(seed=(salt+sequence++)>>>0,ordinal=1):Operation3D {
  const venue=seed%VENUES.length,profile=VENUES[venue],level=structuredClone(THE_LAUNCH);
  const vaults=[{x:1536,y:192},{x:1600,y:224},{x:1472,y:160}],vault=vaults[venue];
  const extract=[{x:320,y:1216},{x:864,y:1216},{x:1472,y:1216}][venue];
  const objects=level.objects.map(o=>o.id==='vault'?{...o,...vault,name:profile.name+' vault'}:o.id==='training-core'?{...o,x:vault.x,y:vault.y+128,name:profile.core}:o.id==='extraction'?{...o,...extract}:o.id==='relay-b'?{...o,y:576}:o);
  level.objects=objects;level.props=level.props.map(p=>{
    if(p.id==='vault')return{...p,...vault};
    if(!p.solid||p.id.includes('console'))return p;
    if(p.id==='cover-a'||p.id==='cover-b')return{...p,x:640,y:p.id==='cover-a'?640:720};
    let x=p.x*.025,z=p.y*.025;
    // Rehouse old compound crates/utility units on the kerb, leaving both
    // travel lanes clear. Interactive cabinets retain their IDs and markers.
    for(const centre of STREET_CENTRES){if(Math.abs(x-centre)<6.4)x=centre+(x<centre?-6.4:6.4);if(Math.abs(z-centre)<6.4)z=centre+(z<centre?-6.4:6.4);}
    return{...p,x:x/.025,y:z/.025};
  });
  level.id=`operation-${seed}`;level.title=profile.name;
  const city=cityPlan(venue,seed);
  level.width=level.height=CITY_SIZE/1.6;
  const walls=Array.from({length:level.height},(_,y)=>Array.from({length:level.width},(_,x)=>Number(
    x===0||y===0||x===level.width-1||y===level.height-1||Boolean(buildingAt(city,(x+.5)*1.6,(y+.5)*1.6))
  )));level.walls=walls;
  const reachable=()=>{
    const world=new WorldState(level);world.blockers.forEach(b=>{if(['transit-door','vault-gate','vault'].includes(b.id))b.enabled=false;});
    // Mission interactions occupy the original civic-square area. Validate
    // that whole area with a detour margin, without searching distant blocks
    // once for every objective and every seed.
    const width=Math.min(level.width,Math.ceil(Math.max(level.spawn.x,...level.objects.map(o=>o.x))/level.tileSize)+3);
    const height=Math.min(level.height,Math.ceil(Math.max(level.spawn.y,...level.objects.map(o=>o.y))/level.tileSize)+3);
    const blockers=world.blockers.filter(b=>b.x-b.width/2<width*level.tileSize&&b.y-b.height/2<height*level.tileSize);
    const grid=new NavigationGrid(width,height,level.tileSize,blockers,22);
    return level.objects.every(o=>{const path=grid.path(level.spawn,o);return path.length>0&&Math.hypot(path[path.length-1].x-o.x,path[path.length-1].y-o.y)<=Math.max(o.range,100);});
  };
  // Heights and facade variants differ by seed, but do not affect routes.
  // Cache only an exact navigation-layout key, not a seed or a venue guess.
  const routeKey=JSON.stringify([walls,level.spawn,level.props,level.objects]);
  if(!validatedRoutes.has(routeKey)){if(!reachable())throw new Error('Operation generation failed its route validation.');validatedRoutes.add(routeKey);}
  const mission=launchMission();mission.id=level.id;mission.name=`OP ${String(ordinal).padStart(2,'0')} / ${profile.name}`;mission.description=`Infiltrate ${profile.building.toLowerCase()}, recover the ${profile.core} and reach the marked extraction.`;
  mission.objectives=mission.objectives.map(o=>{const object=objects.find(p=>p.id===o.event);return {...o,marker:object?{x:object.x,y:object.y}:o.marker,title:o.id==='infiltrate'?'Enter Riverside Square':o.id==='core'?`Recover the ${profile.core}`:o.id==='vault'?`Breach the ${profile.name} vault`:o.id==='extract'?'Reach the marked extraction and interact':o.title};});
  const fingerprint=walls.map(r=>r.join('')).join('/')+`:${vault.x},${vault.y}:${extract.x}:${city.signature}`;
  return{seed,ordinal,venue,level,mission,fingerprint};
}
export function createAssignmentOperation(index=0,seed=crypto.getRandomValues(new Uint32Array(1))[0]):Operation3D {
  index=Math.max(0,Math.min(ASSIGNMENTS.length-1,Math.floor(index)));
  const a=assignmentAt(index),base=seed%4294967200,normalized=base-base%21+index*3+a.district,operation=createOperation(normalized,index+1);
  const level=operation.level,mission=assignmentMission(a),s=a.site;
  level.title=a.name;level.props=[];level.targets=[];level.markers=[];level.signs=[];level.zones=[];
  level.objects=mission.objectives.filter(o=>o.id.startsWith('task-')||o.id==='recover'||o.id==='extract').map(o=>({id:o.event,kind:o.id==='extract'?'extraction':o.id==='recover'?'collectible':'terminal',name:o.title,x:o.marker.x,y:o.marker.y,range:85,solid:o.id.startsWith('task-')&&!a.convoy?{width:26,height:18}:undefined}));
  level.enemies=Array.from({length:a.security},(_,i)=>{const x=(s.x-3+(i%3)*3)*40,y=(s.z+1+Math.floor(i/3)*2)*40;return{id:'site-guard-'+i,type:index>3&&i%3===0?'heavy' as const:i%2?'enforcer' as const:'guard' as const,x,y,angle:Math.PI/2,patrol:[{x,y},{x,y:y+55},{x:x+25,y:y+55},{x:x+25,y}]};});
  level.security={...level.security,cameras:[],lasers:[],hacks:[]};
  return {...operation,mission,assignment:index,fingerprint:operation.fingerprint+':assignment:'+a.id};
}
export function nextOperation(previous:Operation3D,completed=false) {
  if(previous.assignment!==undefined)return createAssignmentOperation(completed?(previous.assignment+1)%ASSIGNMENTS.length:previous.assignment,completed?(previous.seed+31)>>>0:previous.seed);
  if(!completed)return createOperation(previous.seed,previous.ordinal);
  let seed=(previous.seed+1)>>>0;if(seed%3===previous.venue)seed=(seed+1)>>>0;return createOperation(seed,previous.ordinal+1);
}
