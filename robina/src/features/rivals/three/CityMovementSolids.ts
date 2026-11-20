import {Box3,Vector3} from 'three';
import type {Assignment} from '../missions/assignments';
import {avenueLightPosts,cityPlan,streetLampPlacements,trafficSignalPosts} from './LivingCityPlan';
import type {Solid3D} from './world3d';

export const bankFrontPillars=[-5.7,-2.1,2.1,5.7].map(x=>({x,z:5.65,width:.65,depth:.65,height:3.4}));

export function cityMovementSolids(venue:number,seed:number,assignment?:Assignment):Solid3D[]{
  const box=(id:string,x:number,z:number,width:number,depth:number,height:number,kind:Solid3D['kind']):Solid3D=>({
    id,kind,enabled:true,box:new Box3(new Vector3(x-width/2,0,z-depth/2),new Vector3(x+width/2,height,z+depth/2)),
  });
  const buildings=cityPlan(venue,seed).buildings.map(b=>box('building-'+b.id,b.x,b.z,b.width,b.depth,b.height,'wall'));
  const lamps=streetLampPlacements.map((lamp,i)=>box('street-lamp-'+i,lamp.x,lamp.z,.42,.42,lamp.height,'wall'));
  const avenue=avenueLightPosts.map((p,i)=>box('avenue-lamp-'+i,p.x,p.z,.11,.11,5.4,'wall'));
  const signals=trafficSignalPosts.map((p,i)=>box('traffic-signal-'+i,p.x,p.z,.10,.10,3.7,'wall'));
  // Leave the automatic entrance and the two intended side passages open.
  const pillars=assignment?.id==='reserve'?bankFrontPillars.map((p,i)=>box('bank-pillar-'+i,
    assignment.site.x+p.x,assignment.site.z+p.z,p.width,p.depth,p.height,'wall')):[];
  return [...buildings,...lamps,...avenue,...signals,...pillars];
}
