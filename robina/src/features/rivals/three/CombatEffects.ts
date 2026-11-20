import * as T from 'three';
import type { Bullet3D } from './Projectile3D';
import type { Solid3D } from './world3d';
import { traceSolids } from './physics3d';
import {CinematicImpacts,EXPLOSION_VISUALS} from './CinematicImpacts';
import {groundDecal} from './GroundDecal';
interface Particle { sprite: T.Sprite; age: number; life: number; size: number; growth: number; rise: number }
interface Trail {
  mesh: T.Mesh<T.CylinderGeometry, T.ShaderMaterial>;
  life: number;
  serial: number;
  position: T.Vector3;
  direction: T.Vector3;
  length: number;
  operative: boolean;
  dirty: boolean;
}
const yAxis = new T.Vector3(0, 1, 0);

/** Bounded presentation pools, fed by real weapon/projectile events. Textures
 * remain asset-owner resources; this class owns only geometry/materials. */
export class CombatEffects {
  readonly root = new T.Group(); readonly capacity = 40;
  private particles: Particle[] = []; private trails: Trail[] = []; private geometry = new T.CylinderGeometry(1, 1, 1, 4);
  private delta = new T.Vector3(); flashes = 0; impacts = 0; blasts = 0; traceCount = 0;
  private budget = 40; private trailBudget = 48;
  private trailBySerial = new Map<number, Trail>();
  readonly cinematic=new CinematicImpacts();
  private scorchGeometry=new T.CircleGeometry(1,32);private scorches:{mesh:T.Mesh<T.CircleGeometry,T.ShaderMaterial>;life:number}[]=[];private scorchCursor=0;
  setQuality(quality: 'low' | 'balanced' | 'high') { this.budget = quality === 'low' ? 16 : quality === 'balanced' ? 28 : 40; this.trailBudget = quality === 'low' ? 24 : 48; }
  constructor(private textures: { flash: T.Texture; smoke: T.Texture; blast: T.Texture }) {
    this.root.add(this.cinematic.root);
    for(let i=0;i<12;i++){const mesh=new T.Mesh(this.scorchGeometry,groundDecal(0x171310,i*1.7));mesh.rotation.x=-Math.PI/2;mesh.visible=false;this.root.add(mesh);this.scorches.push({mesh,life:0});}
    for (let i = 0; i < this.capacity; i++) { const sprite = new T.Sprite(new T.SpriteMaterial({ map:textures.smoke, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })); sprite.visible = false; this.root.add(sprite); this.particles.push({ sprite, age: 1, life: 0, size: 0, growth: 0, rise: 0 }); }
    for (let i = 0; i < 48; i++) {
      const material = new T.ShaderMaterial({ uniforms: { tint: { value: new T.Color(0xffe3a0) },alpha: { value: 1 } },transparent: true,depthWrite: false,blending: T.AdditiveBlending,
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'varying vec2 vUv;uniform vec3 tint;uniform float alpha;void main(){float tail=smoothstep(0.,.65,vUv.y);float cap=1.-smoothstep(.94,1.,vUv.y);gl_FragColor=vec4(tint,tail*cap*alpha);}' });
      const mesh = new T.Mesh(this.geometry,material); mesh.visible = false; this.root.add(mesh);
      this.trails.push({ mesh,life: 0,serial: 0,position:new T.Vector3(),direction:new T.Vector3(),length:0,operative:false,dirty:false });
    }
  }
  age(dt: number) {
    this.cinematic.update(dt);
    for(const s of this.scorches){s.life=Math.max(0,s.life-dt);s.mesh.visible=s.life>0;s.mesh.material.uniforms.fade.value=Math.min(.55,s.life/5*.55);}
    for (const p of this.particles) { p.age += dt; const alive = p.age < p.life; p.sprite.visible = alive; if (alive) { const gather=p.sprite.material.map===this.textures.smoke&&p.life>2?T.MathUtils.smoothstep(p.age,0,.6):1;p.sprite.material.opacity = Math.min(1, (1 - p.age / p.life) * 1.8)*gather; p.sprite.scale.setScalar(p.size + p.age * p.growth); p.sprite.position.y += p.rise * dt; } }
    for (const t of this.trails) {
      if (t.life <= 0) continue;
      t.life = Math.max(0, t.life - dt);
      t.mesh.visible = t.life > 0;
      t.mesh.material.uniforms.alpha.value = Math.min(1,t.life / .03);
      if (!t.life) { this.trailBySerial.delete(t.serial); t.dirty = false; }
    }
  }
  private particle(point: T.Vector3, texture: T.Texture, size: number, life: number, color: number, growth = 0, rise = 0) {
    let p=this.particles[0];
    for(let i=0;i<this.budget;i++){const candidate=this.particles[i];if(candidate.age>=candidate.life){p=candidate;break;}if(candidate.age/candidate.life>p.age/p.life)p=candidate;}
    Object.assign(p, { age: 0, life, size, growth, rise }); p.sprite.visible = true; p.sprite.position.copy(point); p.sprite.scale.setScalar(size); p.sprite.material.map = texture; p.sprite.material.blending = texture === this.textures.smoke ? T.NormalBlending : T.AdditiveBlending; p.sprite.material.color.setHex(color); p.sprite.material.opacity = 1; p.sprite.material.rotation = (this.flashes + this.impacts + this.blasts) * 2.4;
  }
  muzzle(point: T.Vector3, security = false) { this.flashes++; this.particle(point, this.textures.smoke, .08, .18, security ? 0x987455 : 0x73808a, .3, .35); }
  burn(point:T.Vector3){this.particle(point,this.textures.blast,.8,.45,0xff8e32,1.4,1.7);this.delta.copy(point);this.delta.y+=.7;this.particle(this.delta,this.textures.smoke,.9,1.1,0x44443f,1.2,1.4);}
  impact(point: T.Vector3, body: boolean,direction=new T.Vector3(0,0,-1),solids:readonly Solid3D[] = []) {
    this.impacts++;
    if(body){this.cinematic.blood(point,direction);this.delta.set(0,-1,0);const floor=traceSolids(point,this.delta,solids,Math.max(.1,point.y));if(floor>=point.y-.04)this.cinematic.stain(this.delta.copy(point).setY(.035));}
    else{this.particle(point,this.textures.flash,.15,.09,0xffc98a);this.particle(point,this.textures.smoke,.12,.32,0x777b7d,.5,.2);}
  }
  blast(point: T.Vector3, radius: number,solids:readonly Solid3D[] = []) {
    // Damage radius remains the server's BOMB/vehicle rule. Presentation has
    // its own metre-scale radius and bounded lifetimes.
    this.cinematic.blast(point);
    const scorch=this.scorches[this.scorchCursor++%this.scorches.length];scorch.mesh.position.copy(point).setY(.055);scorch.mesh.scale.setScalar(radius*.4);scorch.life=EXPLOSION_VISUALS.scorchLife;scorch.mesh.material.uniforms.fade.value=.55;scorch.mesh.visible=true;
    for(const solid of solids)if(solid.enabled&&solid.kind==='cover'){solid.box.clampPoint(point,this.delta);if(this.delta.distanceTo(point)<radius*.7)this.impact(this.delta,false);}
    this.blasts++; this.particle(point,this.textures.flash,2.6,.13,0xfff0ce,20);
    this.particle(point,this.textures.blast,4,.75,0xff9d35,12,1.2);
    // A brief fireball, radial flame tongues and then darker rising smoke.
    // The same damage radius feeds the effect; pool size remains bounded.
    for(let i=0;i<6;i++){const a=i*Math.PI/3,direction=new T.Vector3(Math.cos(a),0,Math.sin(a)),reach=Math.max(0,traceSolids(point,direction,solids,radius*.32)-.05);this.delta.copy(point).addScaledVector(direction,reach);this.delta.y+=.5+(i%2)*.5;this.particle(this.delta,this.textures.blast,1.4,.48+(i%3)*.12,0xff7727,4,1.5);}
    for (let i = 0; i < 6; i++) { const angle=i*Math.PI/3;this.delta.set(Math.cos(angle),0,Math.sin(angle));const reach=Math.max(0,traceSolids(point,this.delta,solids,EXPLOSION_VISUALS.radius*.3)-.05);this.delta.multiplyScalar(reach).add(point);this.delta.y+=1.1+i%2*.6;this.particle(this.delta,this.textures.smoke,3.2,EXPLOSION_VISUALS.smokeLife+i%2*.3,0x403e3a,1.4,1.2); }
  }
  trace(bullet: Bullet3D) {
    const length = Math.min(.65,bullet.speed * .018,bullet.position.distanceTo(bullet.origin)); if (length < .001) return;
    let t = this.trailBySerial.get(bullet.serial);
    if (!t) {
      t = this.trails.find((slot,i) => i < this.trailBudget && slot.life <= 0) ?? this.trails[this.traceCount % this.trailBudget];
      this.trailBySerial.delete(t.serial);
      t.serial = bullet.serial;
      this.trailBySerial.set(t.serial,t);
    }
    this.traceCount++;
    t.life = .045; t.length = length; t.dirty = true; t.operative = bullet.team === 'operative';
    t.position.copy(bullet.position); t.direction.copy(bullet.direction);
  }
  drawTraces() {
    // Catch-up ticks replace the sampled endpoint. Only the final sample needs
    // a mesh transform, even when the projectile advances many times between draws.
    for (const t of this.trails) {
      if (!t.dirty) continue;
      t.dirty = false;
      t.mesh.visible = true;
      t.mesh.position.copy(t.position).addScaledVector(t.direction,-t.length / 2);
      t.mesh.quaternion.setFromUnitVectors(yAxis,t.direction);
      t.mesh.scale.set(.009,t.length,.009);
      t.mesh.material.uniforms.tint.value.setHex(t.operative ? 0xffe8b5 : 0xffba7a);
      t.mesh.material.uniforms.alpha.value = .9;
    }
  }
  snapshot() { return { particles: this.particles.filter(p => p.age < p.life).length, trails: this.trails.filter(t => t.life > 0).length, capacity: this.capacity, flashes: this.flashes, impacts: this.impacts, blasts: this.blasts, traces: this.traceCount,cinematic:this.cinematic.snapshot }; }
  dispose() { this.cinematic.dispose();this.scorchGeometry.dispose();this.scorches.forEach(s=>s.mesh.material.dispose());this.geometry.dispose(); this.particles.forEach(p => p.sprite.material.dispose()); this.trails.forEach(t => t.mesh.material.dispose()); this.root.clear(); }
}

/** All flash geometry lives under the actual current muzzle socket, so recoil,
 * running and camera changes cannot leave an orphaned flash beside the gun. */
export class MuzzleFlash {
  readonly root = new T.Group(); private life = 0; private fresh = false;
  private plume: T.Mesh<T.ConeGeometry,T.MeshBasicMaterial>; private core: T.Sprite;
  constructor(socket: T.Object3D,texture: T.Texture) {
    this.plume = new T.Mesh(new T.ConeGeometry(.055,.24,7,1,true),new T.MeshBasicMaterial({ color: 0xffbe58,transparent: true,opacity: .75,depthWrite: false,blending: T.AdditiveBlending,toneMapped: false,side: T.DoubleSide }));
    this.plume.rotation.x = -Math.PI / 2; this.plume.position.z = -.1;
    this.core = new T.Sprite(new T.SpriteMaterial({ map: texture,color: 0xfff0cb,transparent: true,depthWrite: false,blending: T.AdditiveBlending,toneMapped: false })); this.core.scale.setScalar(.19); this.core.position.z = -.025;
    this.root.name = 'live-muzzle-flash'; this.root.add(this.plume,this.core); this.root.visible = false; socket.add(this.root);
  }
  fire() { this.life = .055; this.fresh = true; this.root.visible = true; }
  update(dt: number) { if (!this.fresh) this.life = Math.max(0,this.life - dt); this.fresh = false; this.root.visible = this.life > 0; this.plume.material.opacity = .8 * Math.min(1,this.life / .025); }
  dispose() { this.root.removeFromParent(); this.plume.geometry.dispose(); this.plume.material.dispose(); this.core.material.dispose(); }
}
