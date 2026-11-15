import * as T from 'three';
import {groundDecal} from './GroundDecal';

export const EXPLOSION_VISUALS={radius:10,shockLife:.65,smokeLife:4.5,scorchLife:45,maxBlasts:4} as const;
interface Fragment {position:T.Vector3;velocity:T.Vector3;life:number;duration:number;size:number;blood:boolean}
/** Independent visual pool: never applies damage, invents hits or changes AI. */
export class CinematicImpacts {
  readonly root=new T.Group();
  private particles:Fragment[]=Array.from({length:72},()=>({position:new T.Vector3(),velocity:new T.Vector3(),life:0,duration:1,size:.01,blood:false}));
  private fragments=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshStandardMaterial({roughness:.8} ),72);
  private rings=Array.from({length:EXPLOSION_VISUALS.maxBlasts},()=>({mesh:new T.Mesh(new T.RingGeometry(.94,1,64),new T.MeshBasicMaterial({color:0xffce93,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide})),life:0}));
  private stains=Array.from({length:8},(_,i)=>({mesh:new T.Mesh(new T.CircleGeometry(1,24),groundDecal(0x491619,i*2.3)),life:0}));
  private transform=new T.Object3D();private color=new T.Color();private cursor=0;private ringCursor=0;private stainCursor=0;private seed=17;
  constructor(){
    this.fragments.frustumCulled=false;this.fragments.instanceMatrix.setUsage(T.DynamicDrawUsage);this.fragments.setColorAt(0,this.color);this.root.add(this.fragments);this.fragments.count=0;this.root.visible=false;
    for(const r of this.rings){r.mesh.rotation.x=-Math.PI/2;r.mesh.visible=false;this.root.add(r.mesh);}
    for(const s of this.stains){s.mesh.rotation.x=-Math.PI/2;s.mesh.visible=false;this.root.add(s.mesh);}
  }
  private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  private emit(point:T.Vector3,direction:T.Vector3,blood:boolean,size:number,speed:number){
    this.root.visible=true;const p=this.particles[this.cursor++%this.particles.length];p.position.copy(point);p.velocity.copy(direction).multiplyScalar(speed);p.velocity.x+=(this.random()-.5)*2;p.velocity.y+=this.random()*1.6;p.velocity.z+=(this.random()-.5)*2;
    p.life=p.duration=blood?.48:.9;p.size=size;p.blood=blood;
  }
  blood(point:T.Vector3,direction:T.Vector3){
    for(let i=0;i<10;i++)this.emit(point,direction,true,.009+this.random()*.014,.5+this.random()*1.9);
    // A floor trace in CombatEffects decides whether there is a visible floor.
  }
  stain(point:T.Vector3){const s=this.stains[this.stainCursor++%8];s.life=14;s.mesh.position.copy(point);s.mesh.position.y+=.012;s.mesh.scale.set(.17+this.random()*.13,.12+this.random()*.1,1);s.mesh.material.uniforms.fade.value=.6;s.mesh.visible=true;}
  shell(point:T.Vector3,direction:T.Vector3){this.emit(point,direction,false,.018,1.7);}
  blast(point:T.Vector3){
    const r=this.rings[this.ringCursor++%this.rings.length];r.life=EXPLOSION_VISUALS.shockLife;r.mesh.position.copy(point);r.mesh.position.y=Math.max(.06,point.y*.15);r.mesh.visible=true;
    for(let i=0;i<14;i++){const a=this.random()*Math.PI*2;this.emit(point,new T.Vector3(Math.cos(a),.4+this.random()*.7,Math.sin(a)),false,.025+this.random()*.035,3+this.random()*4);}
  }
  update(dt:number){
    dt=Number.isFinite(dt)?Math.max(0,dt):0;const step=Math.min(.1,dt);let count=0;
    for(const p of this.particles){p.life=Math.max(0,p.life-dt);if(!p.life)continue;p.velocity.y-=9.8*step;p.position.addScaledVector(p.velocity,step);
      if(p.position.y<.04){p.position.y=.04;p.velocity.y=Math.abs(p.velocity.y)*.18;p.velocity.x*=.8;p.velocity.z*=.8;}
      this.transform.position.copy(p.position);this.transform.rotation.set(p.life*3,p.life*5,p.life*2);this.transform.scale.set(p.size,p.size*(p.blood?1.8:.45),p.size*.6);this.transform.updateMatrix();this.fragments.setMatrixAt(count,this.transform.matrix);this.color.setHex(p.blood?0x8c1d23:0xb69c62);this.fragments.setColorAt(count++,this.color);
    }
    this.fragments.count=count;this.fragments.instanceMatrix.needsUpdate=true;if(this.fragments.instanceColor)this.fragments.instanceColor.needsUpdate=true;
    for(const r of this.rings){r.life=Math.max(0,r.life-dt);r.mesh.visible=r.life>0;const t=1-r.life/EXPLOSION_VISUALS.shockLife;r.mesh.scale.setScalar(Math.max(.1,t*EXPLOSION_VISUALS.radius));r.mesh.material.opacity=(1-t)*.55;}
    for(const s of this.stains){s.life=Math.max(0,s.life-dt);s.mesh.visible=s.life>0;s.mesh.material.uniforms.fade.value=Math.min(.6,s.life*.16);}
    this.root.visible=count>0||this.rings.some(r=>r.life>0)||this.stains.some(s=>s.life>0);
  }
  get snapshot(){return{fragments:this.particles.filter(p=>p.life>0).length,capacity:this.particles.length,shockwaves:this.rings.filter(r=>r.life>0).length,stains:this.stains.filter(s=>s.life>0).length};}
  dispose(){this.fragments.geometry.dispose();(this.fragments.material as T.Material).dispose();for(const r of [...this.rings,...this.stains]){r.mesh.geometry.dispose();r.mesh.material.dispose();}this.root.clear();}
}

/** Bounded screen droplets, short lived and pointer transparent. */
export class ScreenBlood {
  readonly root=document.createElement('div');private age=1;private life=0;
  constructor(host:HTMLElement){this.root.className='r3-screen-blood';this.root.setAttribute('aria-hidden','true');for(let i=0;i<9;i++){const drop=document.createElement('i');drop.style.setProperty('--drop',String(i));drop.style.top=6+(i*17%80)+'%';this.root.append(drop);}host.append(this.root);}
  hurt(angle:number,amount:number){this.age=0;this.life=Math.min(1.2,.5+amount*.012);this.root.style.setProperty('--impact-angle',`${angle}rad`);this.root.dataset.kind='hurt';}
  closeHit(){this.age=0;this.life=.55;this.root.dataset.kind='close';}
  update(dt:number){this.age+=dt;this.root.style.opacity=String(Math.max(0,1-this.age/Math.max(.01,this.life))*.65);}
  dispose(){this.root.remove();}
}
