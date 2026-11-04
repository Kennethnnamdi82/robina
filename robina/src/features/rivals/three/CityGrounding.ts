import * as T from 'three';
/** Small shared contact decals keep low-quality mode grounded without screen-
 * space postprocessing. These never participate in movement collision. */
export class CityGrounding {
 readonly root=new T.Group();private geometry=new T.PlaneGeometry(1,1);private texture:T.CanvasTexture;private material:T.MeshBasicMaterial;
 private buildings:T.InstancedMesh;private cars:T.InstancedMesh;private people:T.InstancedMesh;private dummy=new T.Object3D();
 constructor(buildings:readonly {x:number;z:number;width:number;depth:number}[]){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d')!,pixels=c.createImageData(64,64);
  for(let z=0;z<64;z++)for(let x=0;x<64;x++){const i=(z*64+x)*4,d=Math.max(Math.abs(x-31.5),Math.abs(z-31.5))/31.5;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=18;pixels.data[i+3]=Math.round((1-T.MathUtils.smoothstep(d,.45,1))*150);}
  c.putImageData(pixels,0,0);this.texture=new T.CanvasTexture(canvas);this.material=new T.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,opacity:.63,polygonOffset:true,polygonOffsetFactor:-2});
  this.buildings=new T.InstancedMesh(this.geometry,this.material,buildings.length);this.cars=new T.InstancedMesh(this.geometry,this.material,28);this.people=new T.InstancedMesh(this.geometry,this.material,48);
  this.root.add(this.buildings,this.cars,this.people);for(const mesh of [this.buildings,this.cars,this.people])mesh.frustumCulled=false;
  buildings.forEach((b,i)=>this.place(this.buildings,i,b.x,b.z,b.width+3,b.depth+3,0,.069));
 }
 private place(mesh:T.InstancedMesh,i:number,x:number,z:number,w:number,d:number,yaw:number,y=.067){this.dummy.position.set(x,y,z);this.dummy.rotation.set(-Math.PI/2,0,yaw);this.dummy.scale.set(w,d,1);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);}
 update(cars:readonly {x:number;z:number;dx:number;dz:number;length:number}[],people:readonly {x:number;z:number}[]){
  this.cars.count=cars.length;cars.forEach((p,i)=>this.place(this.cars,i,p.x,p.z,2.1,p.length,Math.atan2(p.dx,p.dz),.006));this.people.count=people.length;people.forEach((p,i)=>this.place(this.people,i,p.x,p.z,.68,.63,0));this.cars.instanceMatrix.needsUpdate=this.people.instanceMatrix.needsUpdate=true;
 }
 dispose(){for(const mesh of [this.buildings,this.cars,this.people])mesh.dispose();this.geometry.dispose();this.texture.dispose();this.material.dispose();this.root.clear();}
}
