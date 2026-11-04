import * as T from 'three';
import { createPulseCharge } from './EquipmentArt';
import type { RaidAssets } from './RaidAssets';
import { disposeObject } from '../../rugfire/assets';
import type { FieldItems, Pickup } from './FieldItems';

export class FieldArt {
  readonly root = new T.Group();
  private drops = new Map<string,{ root: T.Group; ring: T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>; item: T.Object3D }>();
  private bomb = createPulseCharge(); private bombs: T.Group[];
  readonly held = this.bomb.clone(true); readonly viewHeld = this.bomb.clone(true);
  private ring = new T.TorusGeometry(.28,.012,4,20); private materials = new Set<T.Material>();
  constructor(private assets: RaidAssets,private field: FieldItems) { this.held.visible = false; this.viewHeld.visible = false; this.bombs = field.bombs.map(() => { const b = this.bomb.clone(true); b.visible = false; this.root.add(b); return b; }); }
  sync(time: number,nearby?: Pickup,holding = false,firstPerson = false) {
    this.held.visible = holding && !firstPerson; this.viewHeld.visible = holding && firstPerson;
    for (const p of this.field.pickups) {
      let art = this.drops.get(p.id);
      if (!art) {
        const root = new T.Group(),color = p.supply.kind === 'health' ? 0x77efb2 : p.supply.kind === 'bomb' ? 0x6ee3ef : 0xffce80;
        const material = new T.MeshBasicMaterial({ color,transparent: true,opacity: .5,depthWrite: false }); this.materials.add(material);
        const ring = new T.Mesh(this.ring,material); ring.rotation.x = -Math.PI / 2; ring.position.y = .04; root.add(ring);
        const item = p.supply.kind === 'health' ? this.assets.instance('health').root : p.supply.kind === 'weapon' ? this.assets.equipment(p.supply.weapon) : this.bomb.clone(true);
        if (p.supply.kind === 'health') { const box = new T.Box3().setFromObject(item),size = box.getSize(new T.Vector3()); item.scale.multiplyScalar(.45 / Math.max(size.x,size.y,size.z)); const centre = box.getCenter(new T.Vector3()).multiplyScalar(item.scale.x); item.position.sub(centre); }
        const mount = new T.Group(); mount.add(item); mount.position.y = .32; if (p.supply.kind === 'weapon') mount.rotation.set(0,Math.PI / 3,Math.PI / 2);
        root.add(mount); root.position.copy(p.position); this.root.add(root); art = { root,ring,item: mount }; this.drops.set(p.id,art);
      }
      art.root.visible = !p.consumed; if (p.consumed) continue;
      const selected = nearby?.id === p.id; art.ring.material.opacity = selected ? .95 : .35; art.ring.scale.setScalar(selected ? 1.18 : 1); art.item.position.y = .32 + Math.sin(time * 2 + p.position.x) * .025;
    }
    this.field.bombs.forEach((bomb,i) => { const mesh = this.bombs[i]; mesh.visible = bomb.active; if (bomb.active) { mesh.position.copy(bomb.position); mesh.rotation.set(time * 6,time * 4,0); } });
  }
  dispose() { this.held.removeFromParent(); this.viewHeld.removeFromParent(); disposeObject(this.bomb); this.ring.dispose(); this.materials.forEach(m => m.dispose()); this.root.clear(); this.drops.clear(); }
}
