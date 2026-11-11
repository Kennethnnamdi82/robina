import * as T from 'three';
import type { WeaponMetadata } from './WeaponRig';
import {batchPresentation} from './batchPresentation';

/** Explicit five-digit tactical gloves. Individual fingers curve around the
 * supplied grip, the index articulates against the trigger, and the support
 * hand follows the weapon's real foregrip socket. Sizes are metres. */
export class OperativeHands {
  readonly root=new T.Group();readonly right=new T.Group();readonly left=new T.Group();
  readonly fingerCount=10;readonly index=new T.Group();
  private leftHome=new T.Vector3();private geometries=new Set<T.BufferGeometry>();private materials:T.Material[]=[];
  private elapsed=0;private trigger=0;
  constructor(readonly metadata:WeaponMetadata){
    this.root.name='Articulated operative hands / ten fingers';this.right.name='Right hand / trigger grip';this.left.name='Left hand / support grip';this.root.add(this.right,this.left);
    const glove=this.material(0x303331,.01,.88),palm=this.material(0x202423,.01,.98),panel=this.material(0x555c50,.05,.72),stitch=this.material(0x858577,0,.95),sleeve=this.material(0x343b34,0,.95),cuff=this.material(0x151a18,.02,.8);
    const capsule=this.own(new T.CapsuleGeometry(1,1,5,9)),sphere=this.own(new T.SphereGeometry(1,10,7));
    const rounded=(parent:T.Group,position:T.Vector3,scale:T.Vector3,material:T.Material)=>{const mesh=new T.Mesh(capsule,material);mesh.position.copy(position);mesh.scale.copy(scale);mesh.frustumCulled=false;parent.add(mesh);return mesh;};
    const arm=(parent:T.Group,from:T.Vector3,to:T.Vector3)=>{const direction=new T.Vector3().subVectors(to,from),length=direction.length();const mesh=new T.Mesh(this.own(new T.CylinderGeometry(.047,.061,length,12)),sleeve);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());mesh.frustumCulled=false;parent.add(mesh);const band=new T.Mesh(this.own(new T.CylinderGeometry(.049,.049,.037,12)),cuff);band.position.copy(from);band.quaternion.copy(mesh.quaternion);parent.add(band);};
    const finger=(parent:T.Group,name:string,points:T.Vector3[],radius:number,trigger=false)=>{
      const group=trigger?this.index:new T.Group();group.name=name;group.position.copy(points[0]);parent.add(group);
      const curve=new T.CatmullRomCurve3(points.map(point=>point.clone().sub(points[0]))),tube=new T.Mesh(this.own(new T.TubeGeometry(curve,14,radius,8,false)),glove);tube.frustumCulled=false;group.add(tube);
      for(const progress of [.18,.48,.73]){const point=curve.getPoint(progress),pad=new T.Mesh(sphere,panel);pad.position.copy(point).add(new T.Vector3(.003,.003,0));pad.scale.set(radius*.92,radius*.82,radius*1.07);group.add(pad);}
      // A shallow seam on the back separates the digits at close camera range.
      const seam=new T.Mesh(this.own(new T.TubeGeometry(curve,12,.00075,4,false)),stitch);seam.position.x=radius*.9;group.add(seam);
    };
    rounded(this.right,new T.Vector3(.043,.008,.028),new T.Vector3(.022,.033,.022),glove);
    rounded(this.right,new T.Vector3(.058,.015,.024),new T.Vector3(.009,.025,.019),panel);
    arm(this.right,new T.Vector3(.047,-.048,.052),new T.Vector3(.19,-.25,.335));
    finger(this.right,'Right index / articulated trigger finger',[new T.Vector3(.047,.059,.02),new T.Vector3(.05,.064,-.025),new T.Vector3(.027,.065,-.067),new T.Vector3(-.004,.057,-.074)],.0092,true);
    for(const [i,name]of ['middle','ring','little'].entries()){
      const y=.03-i*.025,radius=i===2?.008:.010;
      finger(this.right,'Right '+name,[new T.Vector3(.047,y,.025),new T.Vector3(.049,y,-.012),new T.Vector3(.028,y,-.036),new T.Vector3(-.018,y,-.036),new T.Vector3(-.031,y,-.008)],radius);
    }
    finger(this.right,'Right opposing thumb',[new T.Vector3(.044,.04,.045),new T.Vector3(.025,.07,.04),new T.Vector3(-.009,.068,.025),new T.Vector3(-.027,.054,.008)],.012);
    rounded(this.right,new T.Vector3(.025,.002,.037),new T.Vector3(.016,.027,.015),palm);
    const support=metadata.sockets.support;
    if(support){
      this.leftHome.set(support[0]-.033,support[1]-.039,support[2]+.015);this.left.position.copy(this.leftHome);
      rounded(this.left,new T.Vector3(-.013,-.015,0),new T.Vector3(.024,.018,.032),glove);
      rounded(this.left,new T.Vector3(-.027,-.015,0),new T.Vector3(.009,.019,.028),panel);
      for(const [i,name]of ['index','middle','ring','little'].entries()){
        const z=-.042+i*.025;
        finger(this.left,'Left '+name,[new T.Vector3(-.01,-.012,z),new T.Vector3(.022,-.025,z),new T.Vector3(.058,-.006,z),new T.Vector3(.067,.023,z),new T.Vector3(.049,.042,z)],i===3?.008:.01);
      }
      finger(this.left,'Left opposing thumb',[new T.Vector3(-.02,.01,.04),new T.Vector3(-.012,.055,.027),new T.Vector3(.02,.065,.006),new T.Vector3(.042,.052,-.009)],.012);
      arm(this.left,new T.Vector3(-.028,-.025,.07),new T.Vector3(-.32,-.24,.43));
    }else{
      this.leftHome.set(-.065,-.035,.06);this.left.position.copy(this.leftHome);
      rounded(this.left,new T.Vector3(),new T.Vector3(.023,.03,.022),glove);
      for(const [i,name]of ['index','middle','ring','little'].entries()){const y=.026-i*.023;finger(this.left,'Left '+name,[new T.Vector3(-.008,y,.015),new T.Vector3(.035,y,-.018),new T.Vector3(.075,y,-.018),new T.Vector3(.087,y,.015)],i===3?.008:.01);}
      finger(this.left,'Left opposing thumb',[new T.Vector3(0,.035,.025),new T.Vector3(.027,.063,.008),new T.Vector3(.055,.059,-.022)],.011);
      arm(this.left,new T.Vector3(-.015,-.045,.05),new T.Vector3(-.30,-.22,.36));
    }
    // Three independently animated assemblies, rather than a draw per knuckle.
    batchPresentation(this.right,geometry=>this.own(geometry),node=>node===this.index);
    batchPresentation(this.left,geometry=>this.own(geometry));
    batchPresentation(this.index,geometry=>this.own(geometry));
    this.left.visible=metadata.id!=='knife';
    this.root.traverse(node=>{node.frustumCulled=false;});
  }
  private own<G extends T.BufferGeometry>(geometry:G){this.geometries.add(geometry);return geometry;}
  private material(color:number,metalness:number,roughness:number){const material=new T.MeshStandardMaterial({color,metalness,roughness});this.materials.push(material);return material;}
  fire(){this.trigger=1;}
  update(dt:number,reload:number,reloadDuration:number){
    this.elapsed+=dt;this.trigger=Math.max(0,this.trigger-dt*12);
    this.index.rotation.set(0,-this.trigger*.09,-this.trigger*.13);
    this.left.position.copy(this.leftHome);this.left.rotation.set(0,0,0);
    if(reload>0){const phase=T.MathUtils.clamp(1-reload/Math.max(.01,reloadDuration),0,1),release=Math.sin(phase*Math.PI);this.left.position.x-=release*.065;this.left.position.y-=release*.11;this.left.position.z+=release*.15;this.left.rotation.x=-release*.45;this.left.rotation.z=release*.28;}
    this.right.rotation.z=Math.sin(this.elapsed*1.4)*.003;
  }
  get meshCount(){let count=0;this.root.traverse(node=>{if(node instanceof T.Mesh)count++;});return count;}
  dispose(){this.geometries.forEach(geometry=>geometry.dispose());this.materials.forEach(material=>material.dispose());this.root.clear();}
}

/** Pose the real third-person finger bones after the authored animation layer.
 * Fixed reference quaternions prevent procedural grip accumulation. */
export class FingerGrip {
  private joints:{bone:T.Object3D;base:T.Quaternion;side:number;digit:string;joint:number}[]=[];
  private rotation=new T.Quaternion();private axis=new T.Vector3(0,0,1);
  constructor(body:T.Object3D){for(const side of ['l','r'])for(const digit of ['index','middle','thumb'])for(let joint=1;joint<=3;joint++){const bone=body.getObjectByName(`${digit}_0${joint}_${side}`);if(bone)this.joints.push({bone,base:bone.quaternion.clone(),side:side==='r'?1:-1,digit,joint});}}
  pose(firing:boolean,reloading:boolean){for(const part of this.joints){const bend=reloading&&part.side<0?.16:part.digit==='thumb'?.42:part.digit==='index'?(firing?.72:.36):.78;part.bone.quaternion.copy(part.base).multiply(this.rotation.setFromAxisAngle(this.axis,part.side*bend*(part.joint===1?.7:1)));}}
}
