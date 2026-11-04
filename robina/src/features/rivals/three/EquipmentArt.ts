import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** Original geometry for missing small equipment only; supplied guns/medkits
 * keep their actual authored meshes. All dimensions use the existing sockets. */
export function createFieldKnife() {
  const root = new T.Group(); root.name = 'VEX-field-knife';
  const steel = new T.MeshStandardMaterial({ color: 0x8cabb5,metalness: .8,roughness: .28 }),grip = new T.MeshStandardMaterial({ color: 0x172d37,metalness: .15,roughness: .8 });
  const shape = new T.Shape(); shape.moveTo(-.028,-.06); shape.lineTo(.028,-.06); shape.lineTo(.024,-.21); shape.lineTo(0,-.32); shape.lineTo(-.025,-.22); shape.closePath();
  const blade = new T.Mesh(new T.ExtrudeGeometry(shape,{ depth: .007,bevelEnabled: true,bevelSize: .003,bevelThickness: .002,bevelSegments: 1,steps: 1 }),steel); blade.rotation.x = Math.PI / 2; blade.position.y = .003; root.add(blade);
  const handle = new T.Mesh(new T.CylinderGeometry(.019,.023,.13,8),grip); handle.rotation.x = Math.PI / 2; handle.position.z = .03; root.add(handle);
  const guard = new T.Mesh(new T.BoxGeometry(.09,.012,.014),steel); guard.position.z = -.04; root.add(guard);
  for (let i = 0; i < 5; i++) { const ring = new T.Mesh(new T.TorusGeometry(.022,.002,4,8),steel); ring.position.z = -.015 + i * .019; root.add(ring); }
  // Shape Y maps onto local Z: blade extends forward along equipment -Z.
  root.userData.rivalsWeapon = { id: 'knife',length: .42,forward: '-Z',recoil: 0,sockets: { grip: [0,0,0],muzzle: [0,0,-.32],support: null,eject: [0,0,0],sight: [0,.02,-.1] } };
  for (const [name,point] of [['muzzle',[0,0,-.32]],['sight',[0,.02,-.1]]] as const) { const node = new T.Object3D(); node.name = 'weapon-' + name; node.position.fromArray(point); root.add(node); }
  return root;
}

/** Original in-game fragmentation-grenade mesh; no proprietary game assets. */
export function createPulseCharge() {
  const root = new T.Group(); root.name = 'RIVALS-fragmentation-grenade';
  const paint = new T.MeshStandardMaterial({ color: 0x687347,metalness: .38,roughness: .72 });
  const grooves = new T.MeshStandardMaterial({ color: 0x273025,metalness: .3,roughness: .85 });
  const steel = new T.MeshStandardMaterial({ color: 0x99a3a6,metalness: .88,roughness: .3 });
  const brass = new T.MeshStandardMaterial({ color: 0x9f8750,metalness: .7,roughness: .5 });
  const points = [[0,-.112],[.05,-.108],[.078,-.08],[.09,-.04],[.092,0],[.083,.045],[.06,.09],[.034,.112],[.034,.13]].map(([r,y]) => new T.Vector2(r,y));
  root.add(new T.Mesh(new T.LatheGeometry(points,24),paint));
  // Merge the raised longitudinal seams and inset bands into one bounded draw.
  const cuts: T.BufferGeometry[] = [];
  for (const [y,r] of [[-.075,.081],[-.035,.091],[.008,.091],[.05,.081],[.088,.061]]) { const g = new T.TorusGeometry(r,.0028,4,24); g.rotateX(Math.PI / 2); g.translate(0,y,0); cuts.push(g); }
  for (let i = 0; i < 8; i++) { const theta = i * Math.PI / 4; const curve = new T.CatmullRomCurve3(points.slice(1,-1).map(p => new T.Vector3(Math.cos(theta) * (p.x + .001),p.y,Math.sin(theta) * (p.x + .001)))); cuts.push(new T.TubeGeometry(curve,10,.0022,4,false)); }
  const merged = mergeGeometries(cuts); cuts.forEach(g => g.dispose()); if (merged) root.add(new T.Mesh(merged,grooves));
  const housing = new T.Mesh(new T.CylinderGeometry(.027,.034,.055,12),steel); housing.position.y = .148; root.add(housing);
  const collar = new T.Mesh(new T.TorusGeometry(.035,.006,5,16),brass); collar.rotation.x = Math.PI / 2; collar.position.y = .124; root.add(collar);
  const spoon = new T.Shape(); spoon.moveTo(-.043,.181); spoon.lineTo(.04,.181); spoon.lineTo(.094,.098); spoon.lineTo(.103,-.056); spoon.lineTo(.09,-.06); spoon.lineTo(.08,.09); spoon.lineTo(.03,.165); spoon.lineTo(-.043,.165); spoon.closePath();
  const lever = new T.Mesh(new T.ExtrudeGeometry(spoon,{ depth: .017,bevelEnabled: true,bevelSize: .002,bevelThickness: .002,bevelSegments: 1,steps: 1 }),steel); lever.position.z = -.009; root.add(lever);
  const pin = new T.Mesh(new T.TorusGeometry(.023,.003,5,16),steel); pin.position.set(-.059,.146,0); root.add(pin);
  const axle = new T.Mesh(new T.CylinderGeometry(.005,.005,.085,8),steel); axle.rotation.z = Math.PI / 2; axle.position.set(-.018,.147,0); root.add(axle);
  return root;
}
