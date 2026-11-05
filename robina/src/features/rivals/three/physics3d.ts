import { Vector3 } from 'three';
import type { Solid3D } from './world3d';
export const BODY = { radius: .34,height: 1.75,gravity: 18,jump: 6.2,holdSeconds: .32,holdGravity: .35 } as const;
export interface Body3D { position: Vector3; vertical: number; grounded: boolean; jumpTime?: number }
export function rayBox(origin: Vector3,direction: Vector3,solid: Solid3D,max: number,padding = 0) {
  let near = 0,far = max;
  const oriented=solid.oriented,c=oriented?Math.cos(oriented.yaw):1,s=oriented?Math.sin(oriented.yaw):0;
  const ox=oriented?origin.x-oriented.center.x:0,oz=oriented?origin.z-oriented.center.z:0;
  for (const axis of ['x','y','z'] as const) {
    const low = (oriented?-oriented.half[axis]:solid.box.min[axis])-padding,high=(oriented?oriented.half[axis]:solid.box.max[axis])+padding;
    const p=oriented?(axis==='x'?c*ox-s*oz:axis==='z'?s*ox+c*oz:origin.y-oriented.center.y):origin[axis];
    const d=oriented?(axis==='x'?c*direction.x-s*direction.z:axis==='z'?s*direction.x+c*direction.z:direction.y):direction[axis];
    if (Math.abs(d) < 1e-9) { if (p < low || p > high) return Infinity; continue; }
    const a = (low - p) / d,b = (high - p) / d;
    near = Math.max(near,Math.min(a,b)); far = Math.min(far,Math.max(a,b)); if (near > far) return Infinity;
  }
  return near <= max && far >= 0 ? near : Infinity;
}
/** Circle versus the actual horizontal footprint. Unlike expanding an AABB,
 * this has rounded corners and also supports a vehicle's rotated rectangle. */
export function horizontalContact(x:number,z:number,radius:number,solid:Solid3D){
  const o=solid.oriented,c=o?Math.cos(o.yaw):1,s=o?Math.sin(o.yaw):0;
  const cx=o?.center.x??(solid.box.min.x+solid.box.max.x)/2,cz=o?.center.z??(solid.box.min.z+solid.box.max.z)/2;
  const hx=o?.half.x??(solid.box.max.x-solid.box.min.x)/2,hz=o?.half.z??(solid.box.max.z-solid.box.min.z)/2;
  const dx=x-cx,dz=z-cz,lx=c*dx-s*dz,lz=s*dx+c*dz;
  if(Math.abs(lx)>hx+radius||Math.abs(lz)>hz+radius)return null;
  const qx=Math.max(-hx,Math.min(hx,lx)),qz=Math.max(-hz,Math.min(hz,lz)),vx=lx-qx,vz=lz-qz,d=Math.hypot(vx,vz);
  let nx:number,nz:number,depth:number;
  if(d>1e-8){if(d>=radius-.000001)return null;nx=vx/d;nz=vz/d;depth=radius-d;}
  else {const ex=hx-Math.abs(lx),ez=hz-Math.abs(lz);if(ex<ez){nx=lx<0?-1:1;nz=0;depth=ex+radius;}else{nx=0;nz=lz<0?-1:1;depth=ez+radius;}}
  return{x:c*nx+s*nz,z:-s*nx+c*nz,depth};
}
export function traceSolids(origin: Vector3,direction: Vector3,solids: readonly Solid3D[],range: number,padding = 0) {
  let distance = range;
  for (const s of solids) if (s.enabled) distance = Math.min(distance,rayBox(origin,direction,s,range,padding));
  return distance;
}
/** One Y-up kinematic simulation for every POV. Substeps bound horizontal travel. */
export function moveKinematic(body: Body3D,dx: number,dz: number,dt: number,solids: readonly Solid3D[],jump = false,jumpHeld = false,highJump=false) {
  if (![dx,dz,dt].every(Number.isFinite) || dt <= 0) return;
  if (jump && body.grounded) { body.vertical = highJump?9:BODY.jump; body.grounded = false; body.jumpTime = 0; }
  else if(jump&&highJump&&(body.jumpTime??Infinity)<.35&&body.vertical>0){body.vertical=Math.max(body.vertical,8.4);body.jumpTime=.35;}
  const p = body.position,radius = BODY.radius;
  const relevant=(s:Solid3D)=>s.enabled&&((s.kind==='wall'||s.kind==='door')&&s.box.min.y<=.05||p.y<s.box.max.y-.005&&p.y+BODY.height>s.box.min.y+.005);
  const resolve=()=>{for(let pass=0;pass<12;pass++){let contact=false;for(const s of solids){if(!relevant(s))continue;const hit=horizontalContact(p.x,p.z,radius,s);if(hit){p.x+=hit.x*(hit.depth+.00001);p.z+=hit.z*(hit.depth+.00001);contact=true;}}if(!contact)break;}};
  // Resolve existing overlaps before movement. A turning vehicle or a newly
  // closed gate must not lock both movement axes and trap a live player.
  resolve();
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.10));
  for(let i=0;i<steps;i++){p.x+=dx/steps;p.z+=dz/steps;resolve();}
  const before = p.y,hold = jumpHeld && body.vertical > 0 && (body.jumpTime ?? Infinity) < BODY.holdSeconds;
  body.jumpTime = (body.jumpTime ?? 0) + dt;
  body.vertical -= BODY.gravity * (hold ? BODY.holdGravity : 1) * dt; p.y += body.vertical * dt; body.grounded = false;
  let landing = 0;
  for (const s of solids) {
    if (!s.enabled || !horizontalContact(p.x,p.z,radius,s)) continue;
    if (body.vertical <= 0 && before >= s.box.max.y - .01 && p.y <= s.box.max.y) landing = Math.max(landing,s.box.max.y);
    if (body.vertical > 0 && before + BODY.height <= s.box.min.y && p.y + BODY.height >= s.box.min.y) { p.y = s.box.min.y - BODY.height; body.vertical = 0; }
  }
  if (p.y <= landing) { p.y = landing; body.vertical = 0; body.grounded = true; }
}
