import * as T from 'three';
import type {Solid3D} from './world3d';
import type {CityCar} from './CitySimulation';
interface Fire {point:T.Vector3;life:number;vehicle:boolean;ground:boolean}
/** Persistent, bounded fire: three instanced draws, no per-fire lights, meshes or
 * timers. Solid geometry stays intact; ignitions never alter navigation. */
export class WorldFires {
  readonly root=new T.Group();readonly capacity=12;
  private entries=new Map<string,Fire>();private geometry=new T.PlaneGeometry(1,1);
  private flame:T.InstancedMesh;private smoke:T.InstancedMesh;private embers:T.InstancedMesh;private transform=new T.Object3D();private serial=0;private budget=10;
  private clock={value:0};
  constructor(textures:{blast:T.Texture;smoke:T.Texture}){
    const vertexShader='varying vec2 vUv;varying float vSeed;void main(){vUv=uv;vSeed=instanceMatrix[3].x*.73+instanceMatrix[3].z*.91;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}';
    const noise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}`;
    const material=(kind:number)=>new T.ShaderMaterial({uniforms:{uTime:this.clock,uKind:{value:kind},uSmoke:{value:textures.smoke}},vertexShader,fragmentShader:`varying vec2 vUv;varying float vSeed;uniform float uTime;uniform float uKind;uniform sampler2D uSmoke;${noise}
      void main(){vec2 uv=vUv;float n=noise(vec2(uv.x*5.+vSeed,uv.y*5.-uTime*2.2));
        if(uKind<.5){float sway=sin(uv.y*7.-uTime*6.+vSeed)*.09*uv.y+(n-.5)*.18;float width=mix(.48,.025,uv.y);float shape=1.-smoothstep(width-.1,width,abs(uv.x-.5+sway));float alpha=shape*smoothstep(0.,.08,uv.y)*(1.-smoothstep(.7,1.,uv.y))*(.35+n*.65);vec3 color=mix(vec3(1.,.34,.025),vec3(.7,.035,.002),smoothstep(.1,.85,uv.y));color=mix(color,vec3(1.,.78,.25),(1.-smoothstep(0.,.12,abs(uv.x-.5)))*(1.-uv.y)*.25);gl_FragColor=vec4(color,alpha*.58);}
        else if(uKind<1.5){float radial=1.-smoothstep(.16,.5,length(uv-.5));float alpha=texture2D(uSmoke,uv).a*radial*(.4+n*.6)*.44;gl_FragColor=vec4(mix(vec3(.13,.14,.15),vec3(.32,.3,.27),uv.y),alpha);}
        else{float alpha=1.-smoothstep(.12,.5,length(uv-.5));gl_FragColor=vec4(1.,.46,.08,alpha);}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,transparent:true,depthWrite:false,toneMapped:kind===1,blending:kind===1?T.NormalBlending:T.AdditiveBlending});
    this.flame=new T.InstancedMesh(this.geometry,material(0),36);this.smoke=new T.InstancedMesh(this.geometry,material(1),48);this.embers=new T.InstancedMesh(this.geometry,material(2),72);
    for(const mesh of [this.flame,this.smoke,this.embers]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;this.root.add(mesh);}this.root.name='Persistent explosion fires';
  }
  setQuality(quality:'low'|'balanced'|'high'){this.budget=quality==='low'?6:quality==='balanced'?10:12;}
  private ignite(id:string,point:T.Vector3,life:number,vehicle=false,ground=false){
    const previous=this.entries.get(id);if(previous){previous.point.copy(point);previous.life=Math.max(previous.life,life);return;}
    if(this.entries.size>=16){const oldest=[...this.entries].sort((a,b)=>a[1].life-b[1].life)[0];this.entries.delete(oldest[0]);}
    this.entries.set(id,{point:point.clone(),life,vehicle,ground});
  }
  blast(point:T.Vector3,radius:number,solids:readonly Solid3D[]){
    // A grenade has a short-lived ground fire/longer smoke aftermath even if
    // it hits open asphalt. This is separate from sustained surface ignition.
    this.ignite('blast-'+this.serial++,new T.Vector3(point.x,Math.max(.12,point.y),point.z),12,false,true);
    const candidates=solids.filter(s=>s.enabled&&(s.kind==='wall'||s.kind==='cover')&&!s.id.startsWith('city-traffic-')).map(s=>({solid:s,point:s.box.clampPoint(point,new T.Vector3())})).filter(c=>c.point.distanceTo(point)<radius*.8).sort((a,b)=>a.point.distanceToSquared(point)-b.point.distanceToSquared(point)).slice(0,4);
    for(const candidate of candidates){const outward=new T.Vector3().subVectors(point,candidate.point);if(outward.lengthSq()>.001)candidate.point.addScaledVector(outward.normalize(),.12);candidate.point.y=Math.max(.15,candidate.point.y);this.ignite(candidate.solid.id,candidate.point,26);}
  }
  step(dt:number,cars:readonly CityCar[]){
    for(const [id,f]of this.entries){f.life-=dt;if(f.life<=0)this.entries.delete(id);}
    for(const car of cars)if((car.fire??0)>0)this.ignite('car-'+car.id,new T.Vector3(car.x+car.dx*car.length*.25,.65,car.z+car.dz*car.length*.25),car.fire!,true);
  }
  draw(camera:T.Camera,time:number,player:T.Vector3){
    this.clock.value=time;const visible=[...this.entries.values()].filter(f=>f.point.distanceToSquared(player)<55*55).sort((a,b)=>a.point.distanceToSquared(player)-b.point.distanceToSquared(player)).slice(0,this.budget);
    let flame=0,smoke=0,embers=0;
    for(const [i,f]of visible.entries()){
      const fade=Math.min(1,f.life/2),fireFade=f.ground?Math.max(0,Math.min(1,(f.life-8)/2)):fade;
      for(let layer=0;layer<3;layer++){
        const pulse=.86+Math.sin(time*13+i*2.1+layer)*.14;
        this.transform.quaternion.copy(camera.quaternion);this.transform.position.copy(f.point);this.transform.position.y+=.7+layer*.34;this.transform.position.x+=Math.sin(i*2.4+layer)*.26;this.transform.scale.set((1.2-layer*.15)*pulse*fireFade,(2.3-layer*.2)*pulse*fireFade,1);this.transform.updateMatrix();this.flame.setMatrixAt(flame++,this.transform.matrix);
      }
      for(let layer=0;layer<4;layer++){const age=(time*.24+i*.17+layer*.25)%1;this.transform.position.copy(f.point);this.transform.position.x+=age*1.5+Math.sin(i+time*.35)*age*.35;this.transform.position.y+=.8+age*5.5;this.transform.position.z+=age*.45;this.transform.scale.setScalar((1.1+age*3.5)*fade*Math.min(1,age*10,(1-age)*8));this.transform.updateMatrix();this.smoke.setMatrixAt(smoke++,this.transform.matrix);}
      for(let layer=0;layer<6;layer++){const age=(time*.55+i*.13+layer/6)%1;this.transform.position.copy(f.point);this.transform.position.x+=Math.sin(layer*2.4+i)*age*.85;this.transform.position.z+=Math.cos(layer*2.4+i)*age*.7;this.transform.position.y+=age*3.8;this.transform.scale.set(.025*(1-age)*fireFade,.065*(1-age)*fireFade,1);this.transform.updateMatrix();this.embers.setMatrixAt(embers++,this.transform.matrix);}
    }
    this.flame.count=flame;this.smoke.count=smoke;this.embers.count=embers;this.flame.instanceMatrix.needsUpdate=this.smoke.instanceMatrix.needsUpdate=this.embers.instanceMatrix.needsUpdate=true;
  }
  get snapshot(){return{active:this.entries.size,buildings:[...this.entries.values()].filter(f=>!f.vehicle&&!f.ground).length,vehicles:[...this.entries.values()].filter(f=>f.vehicle).length,aftermath:[...this.entries.values()].filter(f=>f.ground).length};}
  dispose(){for(const mesh of [this.flame,this.smoke,this.embers]){mesh.dispose();(mesh.material as T.Material).dispose();}this.geometry.dispose();this.root.clear();this.entries.clear();}
}
