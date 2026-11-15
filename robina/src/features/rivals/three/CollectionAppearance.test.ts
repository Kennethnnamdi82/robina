import {describe,it,expect} from 'vitest';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Vector3} from 'three';
import {WeaponFinish} from './CollectionAppearance';
import {CollectionEffects} from './CollectionEffects';
describe('purchased cosmetic presentation',()=>{
  it('isolates material changes, does not accumulate tint and restores originals on revocation',()=>{
    const original=new MeshStandardMaterial({color:'#445566'}),a=new Mesh(new BoxGeometry(),original),b=new Mesh(new BoxGeometry(),original),root=new Group();root.add(a);
    const finish=new WeaponFinish();finish.apply(root,'protocol');const first=(a.material as MeshStandardMaterial).color.clone();expect(a.material).not.toBe(original);expect(b.material).toBe(original);
    finish.apply(root,'protocol');expect((a.material as MeshStandardMaterial).color.equals(first)).toBe(true);finish.apply(root,'diamond');finish.apply(root,'protocol');expect((a.material as MeshStandardMaterial).color.equals(first)).toBe(true);
    finish.apply(root,null);expect(a.material).toBe(original);finish.dispose();original.dispose();a.geometry.dispose();b.geometry.dispose();
  });
  it('keeps every effect finite and bounded without adding collision or damage',()=>{
    const effects=new CollectionEffects();
    for(const id of ['trail','entrance','thunder','neon-celebrate','dissolve','extraction','explosion',null])for(let frame=0;frame<180;frame++){
      effects.step(1/60,new Vector3(frame*.03,0,0),id,frame>60,true);effects.root.traverse(n=>{expect(n.position.toArray().every(Number.isFinite)).toBe(true);expect(n.scale.toArray().every(Number.isFinite)).toBe(true);});
    }
    expect(effects.root.children.length).toBeLessThanOrEqual(43);effects.dispose();
  });
});
