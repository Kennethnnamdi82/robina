import * as T from 'three';
import type {Solid3D} from './world3d';
import type {CityCar} from './CitySimulation';
interface Fire {point:T.Vector3;life:number;vehicle:boolean}
/** Persistent, bounded fire: two instanced draws, no per-fire lights, meshes or
 * timers. Solid geometry stays intact; ignitions never alter navigation. */
export class WorldFires {
  readonly root=new T.Group();readonly capacity=12;
  private entries=new Map<string,Fire>();private geometry=new T.PlaneGeometry(1,1);
  private flame:T.InstancedMesh;private smoke:T.InstancedMesh;private transform=new T.Object3D();
  constructor(textures:{blast:T.Texture;smoke:T.Texture}){
    this.flame=new T.InstancedMesh(this.geometry,new T.MeshBasicMaterial({map:textures.blast,color:0xff9b35,transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending}),36);
    this.smoke=new T.InstancedMesh(this.geometry,new T.MeshBasicMaterial({map:textures.smoke,color:0x454744,transparent:true,opacity:.42,depthWrite:false}),24);
    this.flame.frustumCulled=this.smoke.frustumCulled=false;this.flame.instanceMatrix.setUsage(T.DynamicDrawUsage);this.smoke.instanceMatrix.setUsage(T.DynamicDrawUsage);this.flame.count=this.smoke.count=0;this.root.add(this.flame,this.smoke);this.root.name='Persistent explosion fires';
  }
  private ignite(id:string,point:T.Vector3,life:number,vehicle=false){
    const previous=this.entries.get(id);if(previous){previous.point.copy(point);previous.life=Math.max(previous.life,life);return;}
    if(this.entries.size>=16){const oldest=[...this.entries].sort((a,b)=>a[1].life-b[1].life)[0];this.entries.delete(oldest[0]);}
    this.entries.set(id,{point:point.clone(),life,vehicle});
  }
  blast(point:T.Vector3,radius:number,solids:readonly Solid3D[]){
    const candidates=solids.filter(s=>s.enabled&&(s.kind==='wall'||s.kind==='cover')&&!s.id.startsWith('city-traffic-')).map(s=>({solid:s,point:s.box.clampPoint(point,new T.Vector3())})).filter(c=>c.point.distanceTo(point)<radius*.8).sort((a,b)=>a.point.distanceToSquared(point)-b.point.distanceToSquared(point)).slice(0,4);
    for(const candidate of candidates){const outward=new T.Vector3().subVectors(point,candidate.point);if(outward.lengthSq()>.001)candidate.point.addScaledVector(outward.normalize(),.12);candidate.point.y=Math.max(.15,candidate.point.y);this.ignite(candidate.solid.id,candidate.point,26);}
  }
  step(dt:number,cars:readonly CityCar[]){
    for(const [id,f]of this.entries){f.life-=dt;if(f.life<=0)this.entries.delete(id);}
    for(const car of cars)if((car.fire??0)>0)this.ignite('car-'+car.id,new T.Vector3(car.x+car.dx*car.length*.25,.65,car.z+car.dz*car.length*.25),car.fire!,true);
  }
  draw(camera:T.Camera,time:number,player:T.Vector3){
    const visible=[...this.entries.values()].filter(f=>f.point.distanceToSquared(player)<65*65).sort((a,b)=>a.point.distanceToSquared(player)-b.point.distanceToSquared(player)).slice(0,this.capacity);
    let flame=0,smoke=0;
    for(const [i,f]of visible.entries()){
      const fade=Math.min(1,f.life/2);
      for(let layer=0;layer<3;layer++){
        const pulse=.86+Math.sin(time*13+i*2.1+layer)*.14;
        this.transform.quaternion.copy(camera.quaternion);this.transform.position.copy(f.point);this.transform.position.y+=.5+layer*.44;this.transform.position.x+=Math.sin(i*2.4+layer)*.33;this.transform.scale.set((1.1-layer*.14)*pulse*fade,(2-layer*.2)*pulse*fade,1);this.transform.updateMatrix();this.flame.setMatrixAt(flame++,this.transform.matrix);
      }
      for(let layer=0;layer<2;layer++){const age=(time*.45+i*.17+layer*.5)%1;this.transform.position.copy(f.point).add(new T.Vector3(Math.sin(i+time*.3)*age*.5,1.1+age*3,0));this.transform.scale.setScalar((1.2+age*2)*fade);this.transform.updateMatrix();this.smoke.setMatrixAt(smoke++,this.transform.matrix);}
    }
    this.flame.count=flame;this.smoke.count=smoke;this.flame.instanceMatrix.needsUpdate=this.smoke.instanceMatrix.needsUpdate=true;
  }
  get snapshot(){return{active:this.entries.size,buildings:[...this.entries.values()].filter(f=>!f.vehicle).length,vehicles:[...this.entries.values()].filter(f=>f.vehicle).length};}
  dispose(){this.flame.dispose();this.smoke.dispose();(this.flame.material as T.Material).dispose();(this.smoke.material as T.Material).dispose();this.geometry.dispose();this.root.clear();this.entries.clear();}
}
