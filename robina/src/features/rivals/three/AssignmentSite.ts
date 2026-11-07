import * as T from 'three';
import type { WorldState } from '../world/WorldState';
import type {Assignment} from '../missions/assignments';

export function addAssignmentWalls(world:WorldState,a:Assignment){
  const {x,z}=a.site;
  const walls=[[-5,0,.3,8],[5,0,.3,8],[0,-4,10,.3],[-3.3,4,3.4,.3],[3.3,4,3.4,.3]];
  walls.forEach(([dx,dz,w,d],i)=>world.blockers.push({id:'mission-wall-'+i,x:(x+dx)*40,y:(z+dz)*40,width:w*40,height:d*40,enabled:true}));
  for(const [i,f]of [[x-3.8,z-1.8,1.1,2.6],[x+3.8,z-1.8,1.1,2.6],[x,z-3.35,5.5,.55]].entries())world.blockers.push({id:'mission-furniture-'+i,x:f[0]*40,y:f[1]*40,width:f[2]*40,height:f[3]*40,enabled:true});
}
/** Permanent open clerestory geometry: no roofs/walls are hidden by POV. */
export class AssignmentSite {
  readonly root=new T.Group();private geometry=new T.BoxGeometry(1,1,1);private materials:T.Material[]=[];
  constructor(a:Assignment,world:WorldState){
    this.root.name=a.type+' / walkable mission interior';
    const concrete=new T.MeshStandardMaterial({color:a.district===1?0x757775:0xbbb9b3,roughness:.9});
    const trim=new T.MeshStandardMaterial({color:0x282d30,roughness:.5,metalness:.4});
    const floor=new T.MeshStandardMaterial({color:a.district===0?0x9c9d97:0x626965,roughness:.82});this.materials.push(concrete,trim,floor);
    const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const mesh=new T.Mesh(this.geometry,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=mesh.receiveShadow=true;this.root.add(mesh);};
    for(const b of world.blockers.filter(b=>b.id.startsWith('mission-wall-')))box(b.x*.025,1.7,b.y*.025,b.width*.025,3.4,b.height*.025,concrete);
    for(const b of world.blockers.filter(b=>b.id.startsWith('mission-furniture-'))){box(b.x*.025,.525,b.y*.025,b.width*.025,1.05,b.height*.025,trim);box(b.x*.025,1.08,b.y*.025,b.width*.025+.06,.06,b.height*.025+.06,floor);}
    box(a.site.x,.015,a.site.z,10,.03,8,floor);
    box(a.site.x,3.5,a.site.z+4,10,.35,.65,trim);
    for(const dx of [-4.6,4.6])box(a.site.x+dx,1.8,a.site.z+4,.34,3.6,.65,trim);
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d')!;c.fillStyle='#15191c';c.fillRect(0,0,1024,128);c.fillStyle='#f1f2ef';c.font='600 42px Arial';c.textAlign='center';c.fillText(a.type,512,82);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const sign=new T.MeshBasicMaterial({map:texture});this.materials.push(sign);const plane=new T.Mesh(new T.PlaneGeometry(8,.95),sign);plane.position.set(a.site.x,2.8,a.site.z+4.18);this.root.add(plane);
  }
  dispose(){this.root.traverse(n=>{if(n instanceof T.Mesh&&n.geometry!==this.geometry)n.geometry.dispose();});this.materials.forEach(m=>{if(m instanceof T.MeshBasicMaterial)m.map?.dispose();m.dispose();});this.geometry.dispose();this.root.clear();}
}
