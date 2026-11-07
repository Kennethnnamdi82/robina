import * as T from 'three';
import type { CityAssets, CityModel, CityDetail } from './CityAssets';
import type { Solid3D } from './world3d';
import type { QualityId } from '../core/presentation';
import type { POV } from './CameraRig';
import { cityPlan, cityRandom, STREET_CENTRES, trafficPhase,waterfrontRails,BRIDGE_SPAN, type CityPoint, type CityWeather } from './LivingCityPlan';
import { CityTrafficArt } from './CityTrafficArt';
import { CityCrowd } from './CityCrowd';
import { CityTrees } from './CityTrees';
import { CityGrounding } from './CityGrounding';
import {CityRoadDetail} from './CityRoadDetail';

type Placement={x:number;z:number;y?:number;yaw?:number;width?:number;height?:number;depth?:number;scale?:number};
/** The outdoor district shares its building plan with operation navigation.
 * Static meshes never move, scale or regenerate when the camera changes. */
export class CityEnvironment {
  readonly root=new T.Group();readonly plan;readonly traffic:CityTrafficArt;readonly crowd:CityCrowd;
  private geometries=new Set<T.BufferGeometry>();private materials=new Set<T.Material>();private textures=new Set<T.Texture>();
  private box=new T.BoxGeometry(1,1,1);private dummy=new T.Object3D();private boxes=new Map<T.Material,Placement[]>();private detail=new T.Group();
  private grass?:T.InstancedMesh;private wind={value:0};private quality:QualityId='low';private lastTime=0;private shots=0;
  private signalLenses:{axis:'x'|'z';color:'red'|'amber'|'green';material:T.MeshStandardMaterial}[]=[];
  private lamps:T.MeshStandardMaterial[]=[];private windowMaterials:T.MeshStandardMaterial[]=[];
  private architecture:T.InstancedMesh[]=[];private architectureShadows:T.InstancedMesh;
  private trees:CityTrees;
  private grounding:CityGrounding;private roadDetail:CityRoadDetail;
  private nightLights:T.PointLight[]=[];
  private night={value:0};
  private pedestrianObstacles:Solid3D[]=[];private nightClock=1;private architectureFingerprint='';
  private lampPositions=STREET_CENTRES.flatMap(x=>STREET_CENTRES.map(z=>({x:x-5.4,z:z-6.1})));
  lighting:CityWeather='golden';
  constructor(readonly assets:CityAssets,readonly solids:Solid3D[],grassAlpha:T.Texture,readonly venue=0,readonly seed=0) {
    this.plan=cityPlan(venue,seed);this.root.name=this.plan.label;this.root.add(this.detail);this.geometries.add(this.box);
    this.grounding=new CityGrounding(this.plan.buildings);this.root.add(this.grounding.root);
    const concrete=this.material(0xa6a293),curb=this.material(0xb9b2a0),asphalt=this.material(0x55534f),paint=this.material(0xd5cfae),yellow=this.material(0xd2a454),soil=this.material(0x4c5b3a),metal=this.material(0x39474b,.55);
    this.surface(asphalt,assets.texture('premium-asphalt'),62.5);asphalt.color.set(0xf0f0ed);asphalt.roughness=.94;asphalt.bumpMap=asphalt.map;asphalt.bumpScale=.009;
    this.roadDetail=new CityRoadDetail(seed);this.root.add(this.roadDetail.root);
    // A continuous asphalt sheet prevents road seams and overlapping tile strips.
    this.cube({x:44,z:44,y:-.28,width:250,height:.26,depth:250},asphalt);
    concrete.map=this.pavingTexture();concrete.color.set(0x918d83);concrete.bumpMap=concrete.map;concrete.bumpScale=.012;paint.color.set(0xbeb9aa);
    for(let row=-2;row<6;row++)for(let col=-2;col<6;col++) {
      const x=20+col*24,z=20+row*24;
      this.cube({x,z,y:-.015,width:14.8,height:.08,depth:14.8},curb);
      this.cube({x,z,y:.02,width:14.3,height:.03,depth:14.3},concrete);
    }
    this.roadPaint(paint,yellow);
    // One permanent mesh per building. Distance/POV never replaces a facade
    // with a different silhouette; curation keeps these models inexpensive.
    for(const model of ['residence','commerce','headquarters'] as const)this.batch(model,this.plan.buildings.filter(b=>b.model===model).map(b=>({...b,y:.045})),this.root);
    // Medium/Low shadows use inset building massing, not every window rim.
    // Colour/depth writes are off in the main pass; shadow depth still writes.
    const shadowMaterial=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false});this.materials.add(shadowMaterial);
    this.architectureShadows=new T.InstancedMesh(this.box,shadowMaterial,this.plan.buildings.length);this.architectureShadows.name='Building shadow massing';
    this.plan.buildings.forEach((b,i)=>{this.dummy.position.set(b.x,b.height/2-.08,b.z);this.dummy.rotation.set(0,b.yaw,0);this.dummy.scale.set(Math.max(1,b.width-.8),b.height-.25,Math.max(1,b.depth-.8));this.dummy.updateMatrix();this.architectureShadows.setMatrixAt(i,this.dummy.matrix);});
    this.architectureShadows.computeBoundingSphere();this.architectureShadows.castShadow=true;this.root.add(this.architectureShadows);
    const skyline:Placement[]=[];
    for(let i=-2;i<=5;i++)for(const side of [0,1]){skyline.push({x:20+i*24,z:side?-52:140,width:15,depth:12,height:24+((i+2)%3)*3,yaw:Math.PI});skyline.push({x:side?-52:180,z:20+i*24,width:15,depth:12,height:24+((i+2)%3)*3});}
    this.batch('headquarters',skyline,this.root,false,true);
    const random=cityRandom(seed),trees:Placement[]=[],tallTrees:Placement[]=[],planters:Placement[]=[],lamps:Placement[]=[],bins:Placement[]=[],hydrants:Placement[]=[];
    for(let row=-1;row<4;row++)for(let col=-1;col<4;col++) {
      const x=20+col*24,z=20+row*24;
      for(const dx of [-6.5,6.5])for(const dz of [-3.5,3.5]) {
        const p={x:x+dx,z:z+dz,height:5.3+random()*1.9,width:3.5,depth:3.5};if(this.solids.some(s=>s.kind==='cover'&&Math.hypot((s.box.min.x+s.box.max.x)/2-p.x,(s.box.min.z+s.box.max.z)/2-p.z)<1.6))continue;(random()>.55?tallTrees:trees).push(p);planters.push({x:p.x,z:p.z,width:1.3,depth:1.3,height:.24});
      }
      lamps.push({x:x-6.7,z:z-6.7,height:5.2,width:1.0,depth:1.0,yaw:Math.PI/2});bins.push({x:x+6.5,z:z+5.2,height:.8,width:.5,depth:.5});hydrants.push({x:x-5.8,z:z+6.6,height:.7,width:.35,depth:.35});
    }
    this.trees=new CityTrees([...trees,...tallTrees],assets.texture('city-oak')!);this.root.add(this.trees.root);this.batch('planter',planters,this.root);this.batch('streetLamp',lamps,this.root,true);this.batch('bin',bins,this.detail,true);this.batch('hydrant',hydrants,this.detail,true);
    this.grassPatches(grassAlpha,soil);this.streetFurniture(metal);this.trafficSignals(metal);this.missionProps();this.shopfronts();
    // The old exit barricades are gone: all four east avenues cross the canal
    // into a walkable/drivable waterfront with real hotel and bar facades
    this.waterfront(concrete,metal,asphalt,yellow);
    this.pedestrianObstacles=solids.filter(s=>!s.id.startsWith('city-traffic'));this.traffic=new CityTrafficArt(assets,seed);this.crowd=new CityCrowd(seed,assets.humanoid!);this.root.add(this.traffic.root,this.crowd.root);solids.push(...this.traffic.colliders);
    for(let i=0;i<3;i++){const light=new T.PointLight(0xffc184,180,22,2);this.nightLights.push(light);this.root.add(light);}
    this.flushBoxes();this.setLighting('golden');
  }
  private material(color:number,metalness=.04){const m=new T.MeshStandardMaterial({color,roughness:.82,metalness});this.materials.add(m);return m;}
  private waterfront(concrete:T.Material,metal:T.Material,asphalt:T.Material,yellow:T.Material){
    const water=this.material(0x294d55,.5);water.roughness=.2;
    this.cube({x:106,z:48,y:-.018,width:12,height:.012,depth:93},water);
    for(const z of STREET_CENTRES){
      this.cube({x:106,z,y:-.005,width:BRIDGE_SPAN.to-BRIDGE_SPAN.from,height:.018,depth:11.6},concrete);
      this.cube({x:106,z,y:.014,width:16,height:.006,depth:9.2},asphalt);
      for(let x=99;x<114;x+=3)for(const side of [-1,1])this.cube({x,z:z+side*.14,y:.021,width:1.7,height:.006,depth:.075},yellow);
      for(const side of [-1,1]){
        this.cube({x:106,z:z+side*5.65,y:.88,width:16,height:.09,depth:.13},metal);
        this.cube({x:106,z:z+side*5.65,y:.12,width:16,height:.1,depth:.18},concrete);
        for(let x=98;x<=114;x+=2)this.cube({x,z:z+side*5.65,width:.08,height:.98,depth:.08},metal);
      }
      this.sign('MERIDIAN QUAY / HOTEL & BAR',116,3,z-6.2,0,5,.48,'#20393e','#f2dfaf');
    }
    for(const rail of waterfrontRails()){
      this.cube({...rail,y:.86,height:.12},metal);
      for(let z=rail.z-rail.depth/2;z<=rail.z+rail.depth/2;z+=2)this.cube({x:rail.x,z,width:.1,height:.98,depth:.1},metal);
    }
    this.sign('HOTEL MERIDIAN',120.35,3.1,20,-Math.PI/2,8,.8,'#172f3a','#f6d99d');
    this.sign('THE AMBER ROOM / BAR',120.35,2.3,44,-Math.PI/2,8,.7,'#312326','#ffd5a2');
    this.cube({x:119,z:20,y:3.2,width:3,height:.18,depth:9},metal);
    this.cube({x:118.8,z:44,y:.04,width:2.4,height:.04,depth:10},concrete);
  }
  private cube(p:Placement,material:T.Material){if(!this.boxes.has(material))this.boxes.set(material,[]);this.boxes.get(material)!.push(p);}
  private flushBoxes(){for(const [material,placements]of this.boxes){const mesh=new T.InstancedMesh(this.box,material,placements.length);placements.forEach((p,i)=>{this.dummy.position.set(p.x,(p.y??0)+(p.height??1)/2,p.z);this.dummy.rotation.set(0,p.yaw??0,0);this.dummy.scale.set(p.width??1,p.height??1,p.depth??1);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);});mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;this.root.add(mesh);}this.boxes.clear();}
  private surface(material:T.MeshStandardMaterial,source:T.Texture|undefined,repeat:number){if(!source)return;const t=source.clone();t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.needsUpdate=true;this.textures.add(t);material.map=t;}
  private surfaceNormal(material:T.MeshStandardMaterial,source:T.Texture|undefined,repeat:number){if(!source)return;const t=source.clone();t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.needsUpdate=true;this.textures.add(t);material.normalMap=t;material.normalScale.set(.45,.45);}
  private pavingTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!;c.fillStyle='#b9b5aa';c.fillRect(0,0,512,512);const r=cityRandom(41);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const shade=158+Math.floor(r()*25);c.fillStyle=`rgb(${shade+10},${shade+7},${shade})`;c.fillRect(x*64+1,y*64+1,62,62);}const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(5,5);this.textures.add(t);return t;}
  private asphaltTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!,pixels=c.createImageData(512,512),random=cityRandom(849);for(let i=0;i<pixels.data.length;i+=4){const shade=81+random()*25;pixels.data[i]=shade;pixels.data[i+1]=shade+1;pixels.data[i+2]=shade+2;pixels.data[i+3]=255;}c.putImageData(pixels,0,0);for(let i=0;i<9;i++){let x=random()*512,y=random()*512;c.beginPath();c.moveTo(x,y);for(let j=0;j<8;j++){x+=(random()-.45)*35;y+=random()*24;c.lineTo(x,y);}c.strokeStyle='rgba(35,37,36,.6)';c.lineWidth=.7;c.stroke();}const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(48,48);t.anisotropy=2;this.textures.add(t);return t;}
  private batch(id:CityModel|CityDetail,placements:Placement[],parent:T.Group,detail=false,skyline=false){
    if(!placements.length)return;
    const detailedArchitecture=!skyline&&!detail&&['residence','commerce','headquarters'].includes(id);
    if(detailedArchitecture&&placements.length>1){for(const placement of placements)this.batch(id,[placement],parent);return;}
    const prototype=(detail?this.assets.details.get(id as CityDetail):(skyline?this.assets.skyline:this.assets.models).get(id as CityModel))!;prototype.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(prototype),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),offset=new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z),transform=new T.Matrix4();
    prototype.traverse(node=>{if(!(node instanceof T.Mesh))return;const mesh=new T.InstancedMesh(node.geometry,node.material,placements.length);if(['residence','commerce','headquarters'].includes(id))this.architecture.push(mesh);
      placements.forEach((p,i)=>{this.dummy.position.set(p.x,p.y??.045,p.z);this.dummy.rotation.set(0,p.yaw??0,0);this.dummy.scale.set(p.width?p.width/size.x:p.scale??1,p.height?p.height/size.y:p.scale??1,p.depth?p.depth/size.z:p.scale??1);this.dummy.updateMatrix();transform.copy(this.dummy.matrix).multiply(offset).multiply(node.matrixWorld);mesh.setMatrixAt(i,transform);});mesh.computeBoundingSphere();mesh.userData.citySkyline=skyline;mesh.castShadow=['residence','commerce','headquarters'].includes(id)?this.quality==='high'&&!skyline:true;mesh.receiveShadow=true;parent.add(mesh);
      for(const m of Array.isArray(node.material)?node.material:[node.material])if(m instanceof T.MeshStandardMaterial&&/FakeInterior/.test(m.name)&&!this.windowMaterials.includes(m))this.windowMaterials.push(m);
    });
  }
  private roadPaint(white:T.Material,yellow:T.Material){
    for(const centre of STREET_CENTRES)for(let p=-60;p<155;p+=4.4)if(!STREET_CENTRES.some(c=>Math.abs(p-c)<7.5))for(const side of [-1,1]){
      this.cube({x:p,z:centre+side*.16,y:-.018,width:2.4,height:.012,depth:.075},yellow);this.cube({x:centre+side*.16,z:p,y:-.018,width:.075,height:.012,depth:2.4},yellow);
    }
    for(const x of STREET_CENTRES)for(const z of STREET_CENTRES)for(const sign of [-1,1]) {
      for(let i=-4;i<=4;i++) {
        this.cube({x:x+i*.86,z:z+sign*5.8,y:-.012,width:.43,height:.014,depth:1.6},white);
        this.cube({x:x+sign*5.8,z:z+i*.86,y:-.012,width:1.6,height:.014,depth:.43},white);
      }
      this.cube({x:x+sign*7.1,z:z-sign*2.3,y:-.012,width:.18,height:.014,depth:3.9},white);
      this.cube({x:x+sign*2.3,z:z+sign*7.1,y:-.012,width:3.9,height:.014,depth:.18},white);
    }
  }
  private grassPatches(alpha:T.Texture,soil:T.Material){
    const patches=[{x:20,z:20,width:7,depth:7},{x:44,z:20,width:6,depth:8},{x:20,z:44,width:8,depth:7}];
    for(const p of patches)this.cube({...p,y:.04,height:.015},soil);
    const blade=new T.PlaneGeometry(.36,.38);blade.translate(0,.19,0);this.geometries.add(blade);const m=this.material(0x718052);m.alphaMap=alpha;m.alphaTest=.4;m.side=T.DoubleSide;
    this.grass=new T.InstancedMesh(blade,m,540);const random=cityRandom(this.seed);for(let i=0;i<540;i++){const p=patches[i%patches.length];this.dummy.position.set(p.x+(random()-.5)*p.width,.06,p.z+(random()-.5)*p.depth);this.dummy.rotation.set(0,random()*Math.PI,0);this.dummy.scale.setScalar(.5+random()*.6);this.dummy.updateMatrix();this.grass.setMatrixAt(i,this.dummy.matrix);}this.grass.computeBoundingSphere();this.root.add(this.grass);
    m.customProgramCacheKey=()=>'living-city-grass';m.onBeforeCompile=shader=>{shader.uniforms.uCityWind=this.wind;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uCityWind;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(uCityWind*1.7+instanceMatrix[3].x*.6+instanceMatrix[3].z)*position.y*.12;');};
  }
  private streetFurniture(metal:T.Material){
    this.batch('busStop',[{x:18,z:2,height:2.8,width:4.8,depth:1.5,yaw:Math.PI},{x:62,z:38,height:2.8,width:4.8,depth:1.5}],this.root,true);
    this.batch('newsstand',[{x:2,z:20,height:2.4,width:2.3,depth:1.8},{x:50,z:46,height:2.4,width:2.3,depth:1.8}],this.detail,true);
    this.batch('dumpster',[{x:61,z:49,height:1.4,width:1.9,depth:1.2},{x:73,z:21,height:1.4,width:1.9,depth:1.2}],this.detail,true);
    const wood=this.material(0x705446);
    for(const x of [16,24,40,48])for(const z of [14.5,25.5]) {
      this.cube({x,z,y:.48,width:2.1,height:.13,depth:.5},wood);this.cube({x,z:z+.22,y:.61,width:2.1,height:.48,depth:.09},wood);
      for(const side of [-1,1])this.cube({x:x+side*.8,z,y:.05,width:.08,height:.46,depth:.45},metal);
    }
    const lens=this.material(0xffe5b7);lens.emissive.set(0xffcd83);this.lamps.push(lens);
    for(const x of STREET_CENTRES)for(const z of STREET_CENTRES) {
      this.cube({x:x-6.1,z:z-6.1,width:.11,height:5.4,depth:.11},metal);this.cube({x:x-5.4,z:z-6.1,y:5.25,width:1.5,height:.1,depth:.22},metal);this.cube({x:x-5.4,z:z-6.1,y:5.22,width:1.35,height:.025,depth:.18},lens);
      this.sign(`${String.fromCharCode(65+STREET_CENTRES.indexOf(x))} / ${STREET_CENTRES.indexOf(z)+1} AVENUE`,x-6.1,3.1,z-6.1,0,2.0,.36,'#234c4d','#e2e9d8');
    }
    this.batch('cone',Array.from({length:5},(_,i)=>({x:87+i*.75,z:63,height:.65,width:.35,depth:.35})),this.detail,true);
    this.batch('ac',this.plan.buildings.filter(b=>b.model==='commerce').map(b=>({x:b.x+2,z:b.z,y:b.height,height:1,width:1.8,depth:1.2})),this.detail);
  }
  private trafficSignals(metal:T.Material){
    const housing=this.material(0x222c2e);
    for(const axis of ['x','z'] as const)for(const color of ['red','amber','green'] as const){const material=this.material(color==='red'?0xe83f30:color==='amber'?0xf2bb39:0x56d59a);material.emissive.copy(material.color);this.signalLenses.push({axis,color,material});}
    for(const x of STREET_CENTRES)for(const z of STREET_CENTRES)for(const axis of ['x','z'] as const)for(const side of [-1,1]){
      const px=x+(axis==='x'?side*5.4:side*5.65),pz=z+(axis==='z'?side*5.4:-side*5.65),yaw=axis==='x'?side*Math.PI/2:side>0?0:Math.PI;
      this.cube({x:px,z:pz,width:.10,height:3.7,depth:.10},metal);this.cube({x:px,z:pz,y:2.72,width:.37,height:.99,depth:.28,yaw},housing);
      for(let i=0;i<3;i++){const color=(['red','amber','green'] as const)[i],material=this.signalLenses.find(l=>l.axis===axis&&l.color===color)!.material;
        this.cube({x:px+Math.sin(yaw)*.151,z:pz+Math.cos(yaw)*.151,y:3.39-i*.28,width:.23,height:.2,depth:.035,yaw},material);
      }
    }
  }
  private missionProps(){
    const placements=new Map<CityModel,Placement[]>();
    for(const solid of this.solids.filter(s=>(s.kind==='cover'||s.kind==='platform')&&!s.id.startsWith('mission-')&&!s.id.startsWith('task-')&&!s.id.startsWith('waterfront-rail-'))){
      const s=solid.box.getSize(new T.Vector3()),c=solid.box.getCenter(new T.Vector3());
      const id:CityModel=solid.kind==='platform'?'platform':solid.id.includes('console')||solid.id.startsWith('relay')?'computer':solid.id.startsWith('cooling')?'vent':solid.id==='reactor'?'barrel':'crate';
      if(!placements.has(id))placements.set(id,[]);placements.get(id)!.push({x:c.x,z:c.z,width:s.x,depth:s.z,height:s.y});
    }
    for(const [id,p]of placements)this.batch(id,p,this.root);
    this.sign('HELIX RESERVE / PRIVATE BANKING',38.4,3.8,2.6,0,7.0,.85,'#253837','#e8c08b');
    this.sign(this.plan.label,20,3.8,1.6,0,6.5,.8,'#253837','#e8c08b');
    this.sign('RIVERSIDE SQUARE',20,1.6,26,Math.PI,3,.45,'#31483e','#e5d5ae');
  }
  private shopfronts(){const names=this.plan.district==='industrial'?['EMBER FREIGHT','NORTH DOCK / 24H','MOTOR WORKS']:this.plan.district==='residential'?['CORNER MARKET','THE GREEN ROOM','RIVERSIDE COFFEE']:['CAFE AMBER','HELIX EXCHANGE','HOTEL MERIDIAN'];
    for(const [i,b]of this.plan.buildings.entries()){
      const nx=Math.sin(b.yaw),nz=Math.cos(b.yaw);this.sign(names[i%names.length],b.x+nx*(b.width/2+.035),2.85,b.z+nz*(b.depth/2+.035),b.yaw,3.8,.34,i%2?'#443b32':'#264441','#ddc8a7');
    }
  }
  private sign(text:string,x:number,y:number,z:number,yaw:number,w:number,h:number,background:string,color:string){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const c=canvas.getContext('2d')!;c.fillStyle=background;c.fillRect(0,0,512,64);c.fillStyle=color;c.fillRect(8,7,3,50);c.textAlign='center';c.textBaseline='middle';c.font='600 25px sans-serif';c.fillText(text,263,34,470);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;this.textures.add(texture);const material=new T.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.32,roughness:.7});this.materials.add(material);const geometry=new T.PlaneGeometry(w,h);this.geometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.rotation.y=yaw;this.root.add(mesh);
  }
  setQuality(quality:QualityId){this.quality=quality;this.trees.setQuality(quality);const mobile=navigator.maxTouchPoints>0;this.architectureShadows.visible=quality!=='high'||mobile;for(const mesh of this.architecture)mesh.castShadow=quality==='high'&&!mobile&&!mesh.userData.citySkyline;this.assets.setQuality(quality);this.crowd.setQuality(quality);this.detail.visible=quality!=='low';this.traffic.active=quality==='low'?18:quality==='balanced'?24:28;this.crowd.active=quality==='low'?24:quality==='balanced'?36:48;if(this.grass)this.grass.count=quality==='low'?135:quality==='balanced'?324:540;}
  setLighting(lighting:CityWeather){this.lighting=lighting;const night=lighting==='night';this.night.value=night?1:0;this.nightLights.forEach(l=>l.visible=night);this.lamps.forEach(m=>m.emissiveIntensity=night?3.2:.65);this.windowMaterials.forEach(m=>m.emissiveIntensity=night?.8:.15);}
  threat(point:CityPoint){this.crowd.threat(point,this.lastTime);}
  update(time:number,_pov:POV,reduced:boolean,player=new T.Vector3(7.2,0,7.2),shots=0,actors:readonly CityPoint[]=[],camera?:T.Camera,alpha=1){
    let delta=Math.min(.2,Math.max(0,time-this.lastTime));this.nightClock+=delta;this.lastTime=time;this.wind.value=reduced?0:time;
    if(shots!==this.shots){this.threat(player);this.shots=shots;}
    const obstacles:CityPoint[]=[player,...actors,...this.solids.filter(s=>s.enabled&&s.kind==='cover'&&!s.id.startsWith('city-traffic')).map(s=>({x:(s.box.min.x+s.box.max.x)/2,z:(s.box.min.z+s.box.max.z)/2}))];
    const pedestrianObstacles=this.pedestrianObstacles;
    while(delta>0){const dt=Math.min(delta,1/30);this.traffic.simulation.step(dt,[...obstacles,...this.crowd.people.slice(0,this.crowd.active)],this.traffic.active);this.crowd.step(dt,this.traffic.simulation.time,this.traffic.simulation.cars.slice(0,this.traffic.active),player,pedestrianObstacles);delta-=dt;}
    const signal=trafficPhase(this.traffic.simulation.time);this.signalLenses.forEach(l=>{const active=signal[l.axis]===l.color;l.material.emissiveIntensity=active?2.2:.025;l.material.color.setScalar(active?1:.13).multiply(new T.Color(l.color==='red'?0xe83f30:l.color==='amber'?0xf2bb39:0x56d59a));});
    this.traffic.draw(player,this.lighting==='night',camera,alpha);this.crowd.draw(time,camera);this.trees.update(this.wind.value);this.grounding.update(this.traffic.simulation.cars.slice(0,this.traffic.active),this.crowd.people.slice(0,this.crowd.active));
    if(this.lighting==='night'&&this.nightClock>.35){this.nightClock=0;this.lampPositions.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));this.nightLights.forEach((l,i)=>l.position.set(this.lampPositions[i].x,4.8,this.lampPositions[i].z));}
  }
  private architectureHash(){if(this.architectureFingerprint)return this.architectureFingerprint;let hash=2166136261;for(const mesh of this.architecture){for(const value of mesh.instanceMatrix.array){hash=Math.imul(hash^Math.round(value*10000),16777619);}hash=Math.imul(hash^mesh.geometry.getAttribute('position').count,16777619);}return this.architectureFingerprint=(hash>>>0).toString(16);}
  get stats(){return{architecture:'photo-textured-fixed-meshes',architectureHash:this.architectureHash(),models:this.assets.models.size,detailModels:this.assets.details.size,grass:this.grass?.count??0,windTime:this.wind.value,quality:this.quality,district:this.plan.district,seed:this.seed,outdoor:true,buildings:this.plan.buildings.length,signature:this.plan.signature,lighting:this.lighting,traffic:{active:this.traffic.active,...this.traffic.simulation.stats},civilians:this.crowd.stats};}
  dispose(){this.traffic.dispose();this.crowd.dispose();this.trees.dispose();this.grounding.dispose();this.roadDetail.dispose();this.root.traverse(node=>{if(node instanceof T.InstancedMesh)node.dispose();});this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.root.clear();}
}
