import { BoxGeometry, CircleGeometry,CylinderGeometry, DoubleSide,Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry, Vector3, type Object3D } from 'three';
import type { WeaponMetadata } from './WeaponRig';

/** A physical, open lens: the world remains visible through the sight, rather
 * than being replaced by a HUD circle. The reticle shares the calibrated bore. */
export class ReflexOptic {
  readonly root = new Group();
  readonly sight: number[];
  private geometries = [new TorusGeometry(.034,.0035,10,48),new BoxGeometry(.037,.025,.041),new CylinderGeometry(.0007,.0007,.001,12),new CylinderGeometry(.034,.034,.035,40,1,true),new CylinderGeometry(.012,.012,.021,20),new CircleGeometry(.030,48)];
  private housing = new MeshStandardMaterial({color:0x4d5559,roughness:.5,metalness:.28,side:DoubleSide});
  private emitter = new MeshBasicMaterial({color:0xff4034,toneMapped:false});
  private lens=new MeshBasicMaterial({color:0x8cc9df,transparent:true,opacity:.025,depthWrite:false,side:DoubleSide});
  constructor(model: Object3D, metadata: WeaponMetadata) {
    const base = new Vector3().fromArray(metadata.sockets.sight);
    this.root.name = 'rivals-reflex-optic';
    this.root.position.copy(base);this.root.position.y += .037;
    this.sight = this.root.position.toArray();
    const ring = new Mesh(this.geometries[0],this.housing);
    const front=ring.clone();front.position.z=-.035;
    const tube=new Mesh(this.geometries[3],this.housing);tube.rotation.x=Math.PI/2;tube.position.z=-.0175;
    const battery=new Mesh(this.geometries[4],this.housing);battery.rotation.z=Math.PI/2;battery.position.set(.043,0,-.017);
    const glass=new Mesh(this.geometries[5],this.lens);glass.position.z=-.015;
    const mount = new Mesh(this.geometries[1],this.housing); mount.position.y=-.041;
    const dot = new Mesh(this.geometries[2],this.emitter);dot.name='reflex-reticle';dot.rotation.x=Math.PI/2;dot.position.z=.008;
    this.root.add(ring,front,tube,battery,glass,mount,dot);
    // Keep transient optic resources out of the persistent finish cache.
    this.root.traverse(node=>{node.userData.rivalsNoFinish=true;});model.add(this.root);
  }
  dispose(){this.root.removeFromParent();this.geometries.forEach(g=>g.dispose());this.housing.dispose();this.emitter.dispose();this.lens.dispose();}
}
