import type { Assignment } from '../missions/assignments';
export interface SitePart { x:number;z:number;width:number;depth:number;height:number;kind:'wall'|'furniture' }
/** Collision and art consume the same footprints; doorways are actual gaps. */
export function siteLayout(a:Assignment):SitePart[]{
  const wall=(x:number,z:number,width:number,depth:number,height=3.7):SitePart=>({x,z,width,depth,height,kind:'wall'});
  const furniture=(x:number,z:number,width:number,depth:number,height=1):SitePart=>({x,z,width,depth,height,kind:'furniture'});
  if(a.convoy)return [furniture(-5,-3,3,2,2.3),furniture(5,2,3,2,2.3),furniture(-4,4,2,1,1.1)];
  if(a.id==='cargo')return [wall(-6,0,.3,10,2.5),wall(6,0,.3,10,2.5),wall(0,-5,12,.3,2.5),furniture(-4,-1,2.3,5,2.4),furniture(4,-1,2.3,5,2.4)];
  if(a.id==='reactor')return [wall(0,-5.5,12,.3,3.3),wall(-6,-2.5,.3,6,3.3),wall(6,2.5,.3,6,1),wall(-4,2.5,4,.15,.65),wall(4,2.5,4,.15,.65),furniture(-3,0,1.8,4,1),furniture(3,0,1.8,4,1)];
  if(a.id==='military')return [wall(-6,-2,.4,7,2.7),wall(6,-2,.4,7,2.7),wall(0,-5.5,12,.4,2.7),furniture(-3,4,3,1,.85),furniture(3,4,3,1,.85),furniture(-4,-2,1.5,3,1.5),furniture(4,-2,1.5,3,1.5)];
  if(a.hostage)return [wall(0,-5.5,12,.25,3),wall(-6,-2,.25,7,3),wall(6,-2,.25,7,3),wall(-4,1.5,4,.25,2.6),wall(4,1.5,4,.25,2.6),furniture(-4,-2,2,2,1),furniture(4,0,2,1,1)];
  const parts=[wall(0,-5.5,12,.3),wall(-4,5.5,4,.3,.65),wall(4,5.5,4,.3,.65),wall(-6,-3.6,.3,3.8),wall(-6,3.6,.3,3.8),wall(6,-3.6,.3,3.8),wall(6,3.6,.3,3.8)];
  if(a.id==='reserve')parts.push(furniture(-3,-.6,3.4,.8,1.15),furniture(3,-.6,3.4,.8,1.15),wall(-4,-3.2,4,.3,2.9),wall(4,-3.2,4,.3,2.9));
  else if(a.id==='reactor')parts.push(furniture(-3,0,1.8,4,1),furniture(3,0,1.8,4,1));
  else if(a.id==='archive')parts.push(furniture(-4,-1,1.5,5,2.4),furniture(4,-1,1.5,5,2.4));
  else if(a.hostage)parts.push(furniture(-4,-2,2,2,1),furniture(4,1,2,1,1));
  else parts.push(furniture(-4,-2,1.5,3,1.5),furniture(4,-2,1.5,3,1.5));
  return parts;
}
