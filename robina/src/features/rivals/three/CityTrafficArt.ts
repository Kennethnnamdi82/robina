import * as T from 'three';
import type { CityAssets } from './CityAssets';
import { CitySimulation, carActive, type CityCar, type VehicleKind } from './CitySimulation';
import { addParkedVehicles } from './VehicleController';
import type { Solid3D } from './world3d';
import { vehicleFinish } from './VehicleFinish';
interface VehicleBatch { mesh:T.InstancedMesh; local:T.Matrix4; cars:CityCar[];length:number;wheel?:{center:T.Vector3;radius:number};paint:boolean }
export class CityTrafficArt {
  readonly root=new T.Group();readonly simulation:CitySimulation;
  readonly colliders:Solid3D[]=[];active=28;
  private batches:VehicleBatch[]=[];private dummy=new T.Object3D();private matrix=new T.Matrix4();
  private materials=new Map<T.Material,T.MeshStandardMaterial>();
  private dimensions=new Map<VehicleKind,{width:number;height:number}>();
  private view=new T.Matrix4();private frustum=new T.Frustum();private sphere=new T.Sphere();private spin=new T.Matrix4();private shift=new T.Matrix4();private wheelRotation=new T.Matrix4();
  private colors=[0x7393a7,0xa62b25,0xe2e2d8,0x1c3653,0x276a58,0xc09b69].map(c=>new T.Color(c));private taxiColor=new T.Color(0xf1be32);private policeColor=new T.Color(0x243444);
  private lampGeometry=new T.PlaneGeometry(.35,.16);private lightMaterial=new T.MeshBasicMaterial({color:0xffecc7,toneMapped:false});private brakeMaterial=new T.MeshBasicMaterial({color:0xff3020,toneMapped:false});
  private headlights:T.InstancedMesh;private brakes:T.InstancedMesh;
  private doorGeometry=new T.BoxGeometry(.065,.85,1.12);private doorMaterial=new T.MeshStandardMaterial({color:0x47535c,metalness:.5,roughness:.4});private doors:T.InstancedMesh;
  private beaconGeometry=new T.BoxGeometry(.38,.16,.25);private beaconMaterial=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});private beacons:T.InstancedMesh;
  constructor(assets:CityAssets,seed:number) {
    this.root.name='Living road traffic';this.simulation=new CitySimulation(seed);
    addParkedVehicles(this.simulation.cars);
    this.beacons=new T.InstancedMesh(this.beaconGeometry,this.beaconMaterial,12);this.beacons.frustumCulled=false;this.root.add(this.beacons);
    const groups=new Map<T.Group,CityCar[]>();for(const car of this.simulation.cars){const source=assets.details.get(car.kind)!;if(!groups.has(source))groups.set(source,[]);groups.get(source)!.push(car);}
    for(const [source,cars]of groups) {
      const prototype=source.clone(true);
      let bounds=new T.Box3().setFromObject(prototype),size=bounds.getSize(new T.Vector3());
      if(size.x>size.z){prototype.rotation.y=Math.PI/2;prototype.updateMatrixWorld(true);bounds.setFromObject(prototype);size=bounds.getSize(size);}
      const center=bounds.getCenter(new T.Vector3()),scale=cars[0].length/size.z;
      for(const car of cars)this.dimensions.set(car.kind,{width:size.x*scale*car.length/cars[0].length,height:size.y*scale*car.length/cars[0].length});
      const normalization=new T.Matrix4().makeScale(scale,scale,scale).multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));prototype.updateMatrixWorld(true);
      prototype.traverse(node=>{if(!(node instanceof T.Mesh))return;const paint=(source:T.Material)=>{let m=this.materials.get(source);if(!m){m=vehicleFinish(source as T.MeshStandardMaterial);if(!source.name.startsWith('premium-')){m.roughness=.42;m.metalness=.18;}this.materials.set(source,m);}return m;};const material=Array.isArray(node.material)?node.material.map(paint):paint(node.material);const mesh=new T.InstancedMesh(node.geometry,material,cars.length);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;this.root.add(mesh);let joint:T.Object3D|null=node;while(joint&&!joint.userData.cityWheel)joint=joint.parent;const wheel=joint?{center:joint.getWorldPosition(new T.Vector3()).applyMatrix4(normalization),radius:Math.max(.15,new T.Box3().setFromObject(joint).getSize(new T.Vector3()).y*scale/2)}:undefined;this.batches.push({mesh,cars,length:cars[0].length,local:new T.Matrix4().multiplyMatrices(normalization,node.matrixWorld),wheel,paint:(Array.isArray(material)?material:[material]).some(m=>m.userData.trafficPaint)});});
    }
    for(const car of this.simulation.cars)this.colliders.push({id:'city-traffic-'+car.id,kind:'cover',enabled:true,box:new T.Box3(),oriented:{center:new T.Vector3(),half:new T.Vector3(),yaw:0}});
    this.headlights=new T.InstancedMesh(this.lampGeometry,this.lightMaterial,72);this.brakes=new T.InstancedMesh(this.lampGeometry,this.brakeMaterial,72);this.doors=new T.InstancedMesh(this.doorGeometry,this.doorMaterial,this.simulation.cars.length);this.doors.frustumCulled=false;this.headlights.frustumCulled=this.brakes.frustumCulled=false;this.root.add(this.headlights,this.brakes,this.doors);this.draw(new T.Vector3(8,0,8),false);
  }
  draw(player:T.Vector3,night:boolean,camera?:T.Camera) {
    const visible=(car:CityCar)=>carActive(car,this.active)&&Math.hypot(car.x-player.x,car.z-player.z)<105;
    if(camera){camera.updateMatrixWorld(true);this.view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.view);}
    for(const batch of this.batches){let slot=0;for(const car of batch.cars){if(!visible(car))continue;this.sphere.center.set(car.x,1,car.z);this.sphere.radius=car.length/2+1;if(camera&&!this.frustum.intersectsSphere(this.sphere)&&Math.hypot(car.x-player.x,car.z-player.z)>18)continue;
      this.dummy.position.set(car.x,.015,car.z);this.dummy.rotation.set(0,Math.atan2(car.dx,car.dz),0);const scale=car.length/batch.length;this.dummy.scale.setScalar(scale);this.dummy.updateMatrix();
      if(batch.wheel){const c=batch.wheel.center;this.spin.makeTranslation(c.x,c.y,c.z).multiply(this.wheelRotation.makeRotationX(car.travelled/(batch.wheel.radius*scale))).multiply(this.shift.makeTranslation(-c.x,-c.y,-c.z)).multiply(batch.local);this.matrix.multiplyMatrices(this.dummy.matrix,this.spin);}else this.matrix.multiplyMatrices(this.dummy.matrix,batch.local);
      if(batch.paint)batch.mesh.setColorAt(slot,(car.health??200)<=0?this.policeColor:car.kind==='taxi'?this.taxiColor:car.kind==='police'?this.policeColor:this.colors[car.id%this.colors.length]);batch.mesh.setMatrixAt(slot++,this.matrix);
    }batch.mesh.count=slot;batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;}
    let n=0,doors=0,beacons=0;
    for(const car of this.simulation.cars) {
      const collider=this.colliders[car.id];collider.enabled=visible(car);
      const dimensions=this.dimensions.get(car.kind)!,halfX=Math.abs(car.dx)*car.length/2+Math.abs(car.dz)*dimensions.width/2,halfZ=Math.abs(car.dz)*car.length/2+Math.abs(car.dx)*dimensions.width/2;
      collider.box.min.set(car.x-halfX,0,car.z-halfZ);collider.box.max.set(car.x+halfX,dimensions.height,car.z+halfZ);
      collider.oriented!.center.set(car.x,dimensions.height/2,car.z);collider.oriented!.half.set(dimensions.width/2,dimensions.height/2,car.length/2);collider.oriented!.yaw=Math.atan2(car.dx,car.dz);
      if(visible(car)&&car.kind==='police'&&car.mode==='pursuit')for(const side of [-1,1]){this.dummy.position.set(car.x+car.dz*side*.3,dimensions.height+.1,car.z-car.dx*side*.3);this.dummy.rotation.set(0,Math.atan2(car.dx,car.dz),0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.beacons.setMatrixAt(beacons,this.dummy.matrix);this.beacons.setColorAt(beacons++,new T.Color(side<0?0x469bff:0xff493d).multiplyScalar(Math.floor(this.simulation.time*7+(side>0?1:0))%2?1.8:.15));}
      if(visible(car)&&(car.door??0)>0){const yaw=Math.atan2(car.dx,car.dz),open=(car.door??0)*1.15;this.dummy.position.set(car.x-car.dz*(dimensions.width/2+.28),.9,car.z+car.dx*(dimensions.width/2+.28));this.dummy.rotation.set(0,yaw-open,0);this.dummy.scale.set(1,1,1);this.dummy.updateMatrix();this.doors.setMatrixAt(doors++,this.dummy.matrix);}
      if(!visible(car))continue;
      const yaw=Math.atan2(car.dx,car.dz);
      for(const side of [-1,1]){
        this.dummy.position.set(car.x+car.dx*(car.length/2+.01)+car.dz*side*.57,.59,car.z+car.dz*(car.length/2+.01)-car.dx*side*.57);this.dummy.rotation.set(0,yaw,0);this.dummy.scale.set(night?1.2:.75,night?1.15:.75,1);this.dummy.updateMatrix();this.headlights.setMatrixAt(n,this.dummy.matrix);
        this.dummy.position.set(car.x-car.dx*(car.length/2+.012)+car.dz*side*.57,.6,car.z-car.dz*(car.length/2+.012)-car.dx*side*.57);this.dummy.rotation.y=yaw+Math.PI;this.dummy.scale.set(car.stopped?1.25:.8,car.stopped?1.2:.75,1);this.dummy.updateMatrix();this.brakes.setMatrixAt(n++,this.dummy.matrix);
      }
    }
    this.beacons.count=beacons;this.beacons.instanceMatrix.needsUpdate=true;if(this.beacons.instanceColor)this.beacons.instanceColor.needsUpdate=true;this.doors.count=doors;this.doors.instanceMatrix.needsUpdate=true;this.headlights.count=this.brakes.count=n;this.headlights.instanceMatrix.needsUpdate=this.brakes.instanceMatrix.needsUpdate=true;
  }
  dispose(){this.batches.forEach(b=>b.mesh.dispose());this.materials.forEach(m=>m.dispose());this.materials.clear();this.beacons.dispose();this.beaconGeometry.dispose();this.beaconMaterial.dispose();this.doors.dispose();this.doorGeometry.dispose();this.doorMaterial.dispose();this.headlights.dispose();this.brakes.dispose();this.lampGeometry.dispose();this.lightMaterial.dispose();this.brakeMaterial.dispose();this.root.clear();}
}
