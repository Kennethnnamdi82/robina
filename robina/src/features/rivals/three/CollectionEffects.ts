import {Group,Mesh,MeshBasicMaterial,SphereGeometry,TorusGeometry,Vector3,AdditiveBlending} from 'three';
/** Bounded cosmetic-only geometry. Never enters collision, damage or AI. */
export class CollectionEffects {
  readonly root=new Group();
  private particles:Mesh[]=[];private rings:Mesh[]=[];private geometry=new SphereGeometry(.025,5,4);private ringGeometry=new TorusGeometry(.6,.012,4,32);
  private material=new MeshBasicMaterial({color:0x70dce6,transparent:true,opacity:.8,depthWrite:false,blending:AdditiveBlending});
  private began=0;private age=0;private won=false;private selected:string|null=null;private cursor=0;private last=new Vector3(Infinity,0,0);
  constructor(){for(let i=0;i<40;i++){const p=new Mesh(this.geometry,this.material);p.visible=false;this.particles.push(p);this.root.add(p);}for(let i=0;i<3;i++){const ring=new Mesh(this.ringGeometry,this.material);ring.rotation.x=-Math.PI/2;ring.visible=false;this.rings.push(ring);this.root.add(ring);}}
  step(dt:number,position:Vector3,id:string|null,success:boolean,moving:boolean){
    this.age+=dt;
    if(id!==this.selected){this.selected=id;this.began=this.age;this.won=false;this.particles.forEach(p=>{p.visible=false;});}
    if(success&&!this.won){this.won=true;this.began=this.age;}
    const t=this.age-this.began,victory=success&&t<4;
    this.material.color.set(id==='extraction'?0xd8b86c:id==='explosion'?0xff9b56:0x70dce6);
    this.rings.forEach((ring,i)=>{ring.visible=Boolean(id&&(id==='entrance'&&t<2.5||victory&&['extraction','entrance','thunder','explosion'].includes(id)));ring.position.copy(position).y+=.04+i*.05;ring.scale.setScalar(.6+(t*.8+i*.3)%2);});
    if(id==='trail'&&moving&&this.last.distanceToSquared(position)>.035){const p=this.particles[this.cursor++%this.particles.length];p.position.copy(position).y+=.08;p.userData.expires=this.age+.7;p.visible=true;this.last.copy(position);}
    this.particles.forEach((p,i)=>{
      if(id==='trail'){const remaining=Math.max(0,Number(p.userData.expires??0)-this.age);p.visible=remaining>0;p.scale.setScalar(Math.max(.1,remaining*1.5));return;}
      p.visible=Boolean(victory&&id&&id!=='entrance');if(!p.visible)return;
      const angle=i*2.39996,radius=(id==='dissolve'?.28:.3+t*.32)*(1+i%3*.3);
      p.position.set(position.x+Math.cos(angle+t*.6)*radius,position.y+(id==='thunder'?((i%8)/8)*2.3:((i*.137+t*.4)%1)*1.9),position.z+Math.sin(angle+t*.6)*radius);
      p.scale.setScalar(id==='thunder'?1.4:.5+(i%4)*.25);
    });
    this.material.opacity=Math.max(0,.8-(victory?t/5:0));
  }
  dispose(){this.root.removeFromParent();this.geometry.dispose();this.ringGeometry.dispose();this.material.dispose();}
}
