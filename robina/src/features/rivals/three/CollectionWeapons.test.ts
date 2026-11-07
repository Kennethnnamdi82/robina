import {describe,expect,it} from 'vitest';
import {COLLECTION_WEAPONS,EQUIPMENT,Loadout,collectionWeaponDefinition} from './Loadout';
import {CATALOG,collectionStats} from '../store/catalog';

describe('premium armory configuration, not purchase entitlement',()=>{
 it('makes every collection firearm stronger in damage and firepower than every issued firearm',()=>{
  const issued=Object.values(EQUIPMENT).filter(w=>w.kind==='firearm');
  for(const p of CATALOG.filter(p=>p.category==='weapons')){
   const w=collectionWeaponDefinition(p.id)!;expect(w).toBeDefined();
   for(const free of issued){expect(w.damage).toBeGreaterThan(free.damage);expect(w.damage/w.interval).toBeGreaterThan(free.damage/free.interval);expect(w.range).toBeGreaterThan(free.range);}
   expect(w.magazine).toBe(p.proposed!.magazine);expect(collectionStats(p.id)).toContainEqual(['Damage',String(w.damage)]);
  }
 });
 it('does not grant paid ownership, modify defaults or accept unknown/prototype IDs',()=>{
  const l=new Loadout(),before=l.snapshot();
  for(const id of [...Object.keys(COLLECTION_WEAPONS),'__proto__','constructor','unknown'])expect(l.equipCollection(id,[])).toBe(false);
  expect(collectionWeaponDefinition('__proto__')).toBeUndefined();expect(l.snapshot()).toEqual(before);
  expect(EQUIPMENT.rifle.damage).toBe(25);expect(EQUIPMENT.pistol.damage).toBe(34);
 });
 it('uses the actual premium definition for firing, magazines, reload and switching when ownership is supplied',()=>{
  const l=new Loadout();expect(l.equipCollection('elite',['elite'])).toBe(true);
  const w=COLLECTION_WEAPONS.elite;
  expect(l.definition).toBe(w);expect(l.current.controller.definition).toBe(w);
  expect(l.step(.23,true,false,true)).toBe(true);expect(l.current.controller.ammo).toBe(39);
  const primary=l.current;expect(l.switchTo(1,true)).toBe(true);l.step(.23,false,false,true);expect(l.switchTo(0,true)).toBe(true);
  expect(l.current).toBe(primary);expect(l.definition.damage).toBe(64);l.step(.23,false,true,true);expect(l.current.controller.reloadRemaining).toBe(w.reloadSeconds);
  expect(l.snapshot().slots[0]).toMatchObject({collectionId:'elite',name:w.name,capacity:40});
  // A normal street pickup is normal equipment, not a permanent paid upgrade.
  expect(l.collect('rifle',0)).toBe(true);expect(l.definition).toBe(EQUIPMENT.rifle);expect(l.snapshot().slots[0].collectionId).toBeUndefined();
 });
 it('rejects locked/invalid slots without changing an existing controller',()=>{
  const l=new Loadout(),before=l.current;for(const index of [-1,3,NaN,.5])expect(l.equipCollection('mp5',['mp5'],index)).toBe(false);
  l.start('throw',.55);expect(l.equipCollection('mp5',['mp5'])).toBe(false);expect(l.current).toBe(before);
 });
});
