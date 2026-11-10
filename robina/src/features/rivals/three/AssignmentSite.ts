import * as T from 'three';
import type { WorldState } from '../world/WorldState';
import type {Assignment} from '../missions/assignments';
import {siteLayout} from './SiteLayout';

export function addAssignmentWalls(world:WorldState,a:Assignment){
  siteLayout(a).forEach((p,i)=>world.blockers.push({id:'mission-'+p.kind+'-'+i,x:(a.site.x+p.x)*40,y:(a.site.z+p.z)*40,width:p.width*40,height:p.depth*40,enabled:true}));
  if(a.id==='reserve')world.blockers.push({id:'mission-vault-door',x:a.site.x*40,y:(a.site.z-3.2)*40,width:3.8*40,height:.3*40,enabled:true});
}
/** Bespoke open-roof interiors, with shared art/collision footprints.
 * Static details are instanced by material; only the entrance and vault move. */
export class AssignmentSite {
  readonly root=new T.Group();private geometry=new T.BoxGeometry(1,1,1);private materials=new Set<T.Material>();private textures:T.Texture[]=[];
  private parts=new Map<T.Material,T.Matrix4[]>();private transform=new T.Object3D();private doors:T.Group[]=[];private vault?:T.Group;private drill?:T.Group;private opening=0;
  constructor(readonly assignment:Assignment,private world:WorldState){
    const a=assignment;this.root.name=a.name+' / '+a.type;
    const mat=(color:number,metalness=0,roughness=.65)=>{const m=new T.MeshStandardMaterial({color,metalness,roughness});this.materials.add(m);return m;};
    const stone=mat(a.id==='reserve'?0xe2d8bc:a.id==='reactor'?0xc4d7d6:a.hostage?0xe0c29d:0x737c7c),dark=mat(0x26323a,.35),metal=mat(0x849398,.75,.3),wood=mat(0x78543b),gold=mat(0xd9b76d,.6,.3),tile=mat(0x77796f);
    const accent=mat(a.id==='reactor'?0x62ded0:a.id==='archive'?0x9b81de:a.id==='military'?0x929f68:0xc69560);
    const glow=new T.MeshStandardMaterial({color:0x91dedc,emissive:0x41b6c2,emissiveIntensity:.8,roughness:.3});this.materials.add(glow);
    const glass=new T.MeshStandardMaterial({color:0xafd5db,metalness:.25,roughness:.14,transparent:true,opacity:.24,depthWrite:false});this.materials.add(glass);
    for(const p of siteLayout(a))this.box(p.x,p.height/2,p.z,p.width,p.height,p.depth,p.kind==='wall'?stone:a.id==='reserve'?wood:dark);
    this.box(0,-.025,0,12.5,.08,11.5,stone);
    if(a.id==='reserve'){for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)if((x+z)%2===0)this.box(x,.025,z,.98,.012,.98,tile);}
    else if(a.id==='archive'){for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++){this.box(x,.024,z,.97,.012,.97,metal);this.box(x,.034,z,.8,.012,.12,dark);}}
    else if(a.hostage){for(let z=-5;z<=5;z+=.3)this.box(0,.026,z,11.8,.015,.27,wood);}
    else{for(const x of [-5.5,5.5]){this.box(x,.035,0,.12,.012,10,gold);for(let z=-4.5;z<5;z+=1)this.box(x,.038,z,.4,.012,.12,gold);}}
    if(a.convoy||a.id==='cargo'){
      for(const p of siteLayout(a).filter(p=>p.kind==='furniture'&&p.height>2)){for(let x=p.x-p.width/2+.15;x<p.x+p.width/2;x+=.3)this.box(x,p.height/2,p.z+p.depth/2+.01,.055,p.height-.1,.035,accent);this.sign('BONDED FREIGHT',p.x,p.height*.7,p.z+p.depth/2+.04,p.width*.9,.35);}
      for(const x of [-5.7,5.7])this.box(x,3.8,0,.22,7.6,.22,gold);this.box(0,7.5,0,11.6,.2,.3,gold);
      this.sign(a.convoy?'CROSSLINE / MOVING FREIGHT':'IRONWORKS / BONDED CARGO',0,5.8,0,10,.7);
    }else if(a.id==='military'){
      for(const x of [-4.8,4.8]){this.box(x,4,-4,.35,8,.35,metal);this.box(x,5.5,-4,1.5,.5,1.1,dark);}
      this.box(0,3.7,-4.7,12.5,.35,2,accent);this.sign('NORTHGATE / COMMAND 07',0,3.25,-4.1,10,.65);
      for(const x of [-3,3])for(let y=.2;y<.85;y+=.22)for(let dx=-1.2;dx<1.5;dx+=.55)this.box(x+dx,y,4,.5,.2,.9,wood);
      for(const x of [-4,4])for(let y=.4;y<1.6;y+=.4)this.box(x,y,-2,1.6,.06,3.1,accent);
      this.sign('PERIMETER RELAY',-3,2.6,-2,3,.4);this.sign('COMMAND UPLINK',3,2.6,-2,3,.4);
    }else if(a.hostage){
      for(const x of [-5.7,5.7]){this.box(x,1.6,4.8,.22,3.2,.22,wood);this.box(x,3.2,2.9,.22,.25,4,wood);}
      this.box(0,3.2,4.8,12,.25,.3,wood);this.sign('WESTHAVEN / GARDEN HOUSE',0,2.8,1.7,9,.65);
      for(const side of [-1,1])for(let x=2.5;x<6;x+=.45)this.box(x*side,.7,5.4,.08,1.3,.08,stone);
      this.box(-4,.9,-2,2.4,.2,2,stone);this.box(-4,1.2,-2.8,2.4,.5,.2,wood);for(const x of [3,4.5])this.box(x,.6,2.5,.8,1.1,.8,wood);
      for(const x of [-4,4]){this.box(x,1.7,1.68,2,1.2,.04,glass);this.box(x,2.35,1.7,2.2,.1,.1,wood);}
    }else{
      const front=a.id==='reactor'?2.5:5.5;
      this.box(0,3.8,front,12.5,.6,.7,a.id==='reactor'?stone:dark);this.sign(a.id==='reserve'?'HELIX RESERVE / PRIVATE BANK':a.location.toUpperCase(),0,3.8,front+.38,10,.6);
      for(const x of [-4,4]){this.box(x,1.8,front,3.65,2.4,.055,glass);for(const dx of [-1.9,0,1.9])this.box(x+dx,1.8,front+.04,.055,2.5,.08,metal);}
      for(const side of [-1,1]){const door=new T.Group(),pane=new T.Mesh(this.geometry,glass),frame=new T.Mesh(this.geometry,metal);pane.scale.set(1.9,2.8,.07);frame.scale.set(.07,2.8,.09);frame.position.x=side*.93;door.add(pane,frame);door.position.set(a.site.x+side*.98,1.4,a.site.z+front);this.root.add(door);this.doors.push(door);}
      for(const x of [-5.8,5.8]){this.box(x,3.9,0,.24,.3,11.5,dark);this.box(x,3.66,0,.08,.04,10.5,glow);}
      if(a.id==='reserve'){
        for(const x of [-5.7,-2.1,2.1,5.7]){this.box(x,1.7,5.65,.36,3.4,.5,stone);this.box(x,.2,5.65,.65,.4,.65,gold);this.box(x,3.25,5.65,.65,.25,.65,gold);}
        this.sign('CASH SERVICES',-3,2.5,-.8,3,.35);this.sign('CLIENT SERVICES',3,2.5,-.8,3,.35);
        for(const x of [-3,3]){this.box(x,1.44,-.7,.65,.45,.08,dark);this.box(x,1.44,-.65,.54,.32,.015,glow);this.box(x,1.18,-.18,.5,.04,.2,metal);}
        for(const x of [-4.7,4.7])for(const z of [1.2,3.4]){this.box(x,.44,z,.65,.8,.65,dark);this.box(x,.88,z+.25,.65,.25,.12,wood);}
        for(const x of [-1.4,1.4])for(const z of [1,2.5,4]){this.box(x,.48,z,.065,.95,.065,gold);this.box(x,.94,z-.65,.04,.04,1.25,dark);}
        this.vault=new T.Group();const door=new T.Mesh(this.geometry,metal);door.scale.set(3.8,2.9,.3);door.position.x=1.9;this.vault.add(door);this.vault.position.set(a.site.x-1.9,1.45,a.site.z-3.2);this.root.add(this.vault);
        const wheel=new T.Mesh(new T.TorusGeometry(.52,.065,6,24),gold);wheel.position.set(1.9,0,.22);this.vault.add(wheel);for(const sign of [-1,1]){const spoke=new T.Mesh(this.geometry,gold);spoke.scale.set(.065,1,.065);spoke.rotation.z=sign*Math.PI/4;spoke.position.copy(wheel.position);this.vault.add(spoke);}
        this.sign('VAULT / TIME LOCK',0,3,-3,4,.42);
        this.box(0,.65,-2.45,.22,1.3,.22,dark);this.box(0,1.25,-2.5,.65,.45,.65,gold);
        this.drill=new T.Group();const bit=new T.Mesh(new T.CylinderGeometry(.08,.08,.7,8),metal);bit.rotation.x=Math.PI/2;const fin=new T.Mesh(this.geometry,gold);fin.scale.set(.25,.035,.4);this.drill.add(bit,fin);this.drill.position.set(a.site.x,1.3,a.site.z-2.95);this.root.add(this.drill);
        for(let x=-4.5;x<=4.5;x+=.65)for(let y=.45;y<2.6;y+=.42)this.box(x,y,-5.25,.58,.34,.18,metal);
      }else if(a.id==='reactor'){
        for(const x of [-3,3])for(const z of [-1.3,.7]){this.box(x,1.3,z,.6,.55,.5,glass);this.box(x,1.05,z,.64,.06,.54,glow);this.box(x,1.8,z,.08,.55,.08,metal);}
        const cylinder=new T.CylinderGeometry(1.1,1.1,2.8,20),chamber=new T.Mesh(cylinder,glass);chamber.position.set(a.site.x,1.6,a.site.z-4.2);this.root.add(chamber);
        const core=new T.Mesh(new T.CylinderGeometry(.38,.38,2,12),glow);core.position.copy(chamber.position);this.root.add(core);this.box(0,.25,-4.2,2.8,.5,2.8,metal);this.box(0,3.1,-4.2,2.8,.25,2.8,metal);
        for(const x of [-5,5]){this.box(x,4,-3,.2,7,.2,metal);this.box(x,6.5,-3,1.2,.5,1.2,metal);}
        this.sign('EMBER / CONTAINMENT LAB',0,5,-4.5,7,.45);
      }else if(a.id==='archive'){
        for(const x of [-4,4])for(let z=-3;z<=1;z+=.6){this.box(x,2,z,1.55,2.7,.45,metal);for(let y=1;y<3;y+=.35)this.box(x,y,z+.24,1.2,.045,.02,glow);}
        this.sign('OBSIDIAN / SECURE DATA FLOOR',0,3,-4.8,8,.5);
      }else if(a.hostage){
        this.box(-3,.5,-3,2.4,.6,2,wood);this.box(-3,.85,-3,2.4,.16,2,stone);this.box(3,.8,1,2.5,.18,1.3,wood);for(const x of [2,4])this.box(x,.4,1,.12,.8,.9,wood);this.sign('WESTHAVEN / SAFE HOUSE',0,3,-4.8,7,.5);
      }else{
        for(const x of [-4,4]){this.box(x,1,-2,1.5,1.9,2.2,accent);this.box(x,2.1,-2,1.1,.2,1.8,metal);}this.sign('NORTHGATE / COMMAND BUNKER',0,3,-4.8,9,.5);
      }
    }
    for(const [material,matrices]of this.parts){const mesh=new T.InstancedMesh(this.geometry,material,matrices.length);matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;this.root.add(mesh);}this.parts.clear();
  }
  private box(x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material){this.transform.position.set(this.assignment.site.x+x,y,this.assignment.site.z+z);this.transform.rotation.set(0,0,0);this.transform.scale.set(w,h,d);this.transform.updateMatrix();if(!this.parts.has(material))this.parts.set(material,[]);this.parts.get(material)!.push(this.transform.matrix.clone());}
  private sign(text:string,x:number,y:number,z:number,w:number,h:number){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d')!;c.fillStyle='#17232c';c.fillRect(0,0,1024,128);c.fillStyle='#eddfbc';c.font='600 42px Arial';c.textAlign='center';c.fillText(text,512,81);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;this.textures.push(texture);const material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});this.materials.add(material);const plane=new T.Mesh(new T.PlaneGeometry(w,h),material);plane.position.set(this.assignment.site.x+x,y,this.assignment.site.z+z);this.root.add(plane);}
  update(dt:number,player:T.Vector3,progress=0){this.opening=T.MathUtils.damp(this.opening,Math.hypot(player.x-this.assignment.site.x,player.z-this.assignment.site.z-5.5)<8?1:0,5,dt);this.doors.forEach((door,i)=>door.position.x=this.assignment.site.x+(i?1:-1)*(.98+this.opening*1.85));if(this.drill&&progress>0&&progress<1)this.drill.rotation.z+=dt*28;if(this.vault){const unlocked=this.world.active.has('task-1');this.vault.rotation.y=T.MathUtils.damp(this.vault.rotation.y,unlocked?-Math.PI*.48:0,2,dt);}}
  dispose(){this.root.traverse(n=>{if(n instanceof T.InstancedMesh)n.dispose();if(n instanceof T.Mesh&&n.geometry!==this.geometry)n.geometry.dispose();});this.textures.forEach(t=>t.dispose());this.materials.forEach(m=>m.dispose());this.geometry.dispose();this.root.clear();}
}
