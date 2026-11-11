import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {CATALOG} from './catalog';
import {COLLECTION_MODELS,MODEL_URLS,modelArt} from './modelAssets';
import {OUTFIT_EDITIONS} from './outfits';

describe('complete photographed collection assets',()=>{
  it('ships every character, firearm, grenade and finish model with matching art',()=>{
    for(const p of CATALOG){if(!p.model)continue;expect(existsSync('public'+MODEL_URLS[p.model]),p.id).toBe(true);expect(existsSync('public'+modelArt(p.model)),p.id).toBe(true);}
  });
  it('verifies all prepared GLBs and eight genuinely different uniform exports',()=>{
    const manifest=JSON.parse(readFileSync('public/assets/rivals/store/collection-manifest.json','utf8'));
    expect(manifest.files.map((f:{id:string})=>f.id).sort()).toEqual([...COLLECTION_MODELS].sort());
    const uniforms=new Set<string>();
    for(const entry of manifest.files){const bytes=readFileSync('public/assets/rivals/store/models/'+entry.id+'.glb');expect(bytes.toString('utf8',0,4)).toBe('glTF');expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);if(CATALOG.some(p=>p.category==='characters'&&p.model===entry.id))uniforms.add(entry.sha256);}
    expect(uniforms.size).toBe(8);
  });
  it('makes the $4.99, $9.99 and $14.99 soldiers different geometric editions, not recolors',()=>{
    const inspect=(id:'shadow'|'midnight'|'commander')=>{
      const bytes=readFileSync('public/assets/rivals/store/models/'+id+'.glb');
      const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
      const edition=gltf.nodes.find((n:{extras?:{rivalsEdition?:unknown}})=>n.extras?.rivalsEdition)?.extras.rivalsEdition;
      expect(edition.tier).toBe(OUTFIT_EDITIONS[id].tier);
      expect(bytes.byteLength).toBeLessThan(5*1024*1024);
      return{parts:edition.assemblies as string[],meshes:gltf.meshes.length as number};
    };
    const assault=inspect('shadow'),night=inspect('midnight'),command=inspect('commander');
    expect(['shadow','midnight','commander'].map(id=>CATALOG.find(p=>p.id===id)!.price)).toEqual([4.99,9.99,14.99]);
    expect(assault.parts).toContain('shadow / curved assault visor');
    expect(night.parts.filter(n=>n.endsWith(' / coated objective lens'))).toHaveLength(4);
    expect(night.parts).toContain('midnight / radio backpack');
    expect(command.parts).toContain('commander / sealed command helmet');
    expect(command.parts).toContain('commander / split command mantle');
    expect(command.parts).toContain('commander / segmented shin guard');
    expect(night.meshes).toBeGreaterThan(assault.meshes);expect(command.meshes).toBeGreaterThan(night.meshes);
  });
});
