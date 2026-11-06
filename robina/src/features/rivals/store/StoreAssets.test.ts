import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {CATALOG} from './catalog';
import {COLLECTION_MODELS,MODEL_URLS,modelArt} from './modelAssets';

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
});
