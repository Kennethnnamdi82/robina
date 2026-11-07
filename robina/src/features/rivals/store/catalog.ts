import { EQUIPMENT, collectionWeaponDefinition, type EquipmentDefinition, type EquipmentId } from '../three/Loadout';
import { OUTFITS, type OutfitId } from './outfits';

export const CATEGORIES = [
  ['featured', 'Featured'], ['weapons', 'Guns & weapons'], ['grenades', 'Grenades'],
  ['health', 'Health & recovery'], ['characters', 'Character skins'], ['cosmetics', 'Weapon cosmetics'],
  ['effects', 'Emotes & effects'], ['bundles', 'Premium bundles'], ['season', 'Season pass'],
  ['founder', 'Founder pack'], ['inventory', 'My inventory'], ['history', 'Purchase history'],
] as const;
export type Category = typeof CATEGORIES[number][0];
export type ModelAsset = 'rifle' | 'ak47' | 'smg' | 'pistol' | 'operative' | 'health' | 'mp5' | 'm4a1' | 'scar' | 'm249' | 'elite' | 'grenade' | OutfitId | 'desert' | 'pulse' | 'steel' | 'fire' | 'frost' | 'protocol' | 'diamond';
export interface Product {
  id: string; name: string; category: Category; price: number; subtitle: string; description: string;
  accent: string; art: 'weapon' | 'character' | 'grenade' | 'medical' | 'effect' | 'bundle' | 'season' | 'founder';
  model?: ModelAsset; reference?: EquipmentId; quantity?: number; includes?: string[];
  proposed?: { magazine: number; ammo: string }; compatibility?: string; finish?: string;
}
const product = (id: string, name: string, category: Category, price: number, subtitle: string, description: string, art: Product['art'], accent = '#c8b58a', extra: Partial<Product> = {}): Product => ({ id, name, category, price, subtitle, description, art, accent, ...extra });
export const CATALOG: readonly Product[] = [
  product('mp5', 'MP5', 'weapons', 3, 'CLOSE-QUARTERS / SMG', 'Compact receiver, curved magazine and a purposeful close-quarters silhouette — inspect the supplied MP5 model from every angle', 'weapon', '#95c8bb', { model: 'mp5', reference: 'smg', proposed: { magazine: 30, ammo: '9mm' } }),
  product('ak47', 'AK-47', 'weapons', 5, 'CLASSIC / ASSAULT RIFLE', 'Wood furniture, a steel receiver and the unmistakable curved magazine of the supplied AK-47', 'weapon', '#c8b58a', { model: 'ak47', reference: 'rifle', proposed: { magazine: 30, ammo: '7.62mm' } }),
  product('m4a1', 'M4A1', 'weapons', 7, 'MODULAR / ASSAULT RIFLE', 'A textured M4A1 from the supplied armory — adjustable stock, tactical handguard and a field-worn receiver', 'weapon', '#a9b8b9', { model: 'm4a1', reference: 'rifle', proposed: { magazine: 30, ammo: '5.56mm' } }),
  product('scar', 'SCAR-H', 'weapons', 10, 'HEAVY / BATTLE RIFLE', 'A desert battle-rifle presentation built from the supplied assault platform — a distinct heavy receiver and tactical furniture', 'weapon', '#c8aa7f', { model: 'scar', reference: 'rifle', proposed: { magazine: 20, ammo: '7.62mm NATO' } }),
  product('m249', 'M249', 'weapons', 15, 'SUPPORT / HEAVY PLATFORM', 'The armory’s heavy support presentation — a supplied support-rifle silhouette with dark field hardware', 'weapon', '#a5ae90', { model: 'm249', reference: 'rifle', proposed: { magazine: 100, ammo: '5.56mm' } }),
  product('elite', 'ELITE TACTICAL RIFLE', 'weapons', 20, 'SIGNATURE / SPECIALIST', 'A specialist silhouette with machined steel furniture — a statement piece in the collection', 'weapon', '#b6aad0', { model: 'elite', reference: 'rifle', proposed: { magazine: 40, ammo: '5.56mm' } }),
  ...([[10, 3, 'TACTICAL'], [20, 5, 'COMBAT'], [100, 10, 'ULTIMATE']] as const).map(([quantity, price, name]) => product('grenades-' + quantity, name + ' GRENADE PACK', 'grenades', price, quantity + ' GRENADES', 'Inspect the textured fragmentation grenade — package quantities do not alter your current mission stock', 'grenade', '#c6b995', { model:'grenade', quantity })),
  product('revive', 'INSTANT RECOVERY', 'health', 2, 'RECOVERY / SERVICE', 'Review the recovery selection — paid recovery never changes health without verified confirmation', 'medical', '#c89990', {model:'health'}),
  product('first-aid', 'FIRST-AID KIT', 'health', 0, 'FIELD MEDICINE / PICKUP', 'Collect medical supplies in the city to restore health using the existing field controls', 'medical', '#96b5a5', { model: 'health' }),
  ...([["urban","URBAN SOLDIER",2.99,"#b8ae91"],["neon","NEON ASSASSIN",3.99,"#a5d788"],["shadow","SHADOW RAIDER",4.99,"#9aadb5"],["cyber","CYBER PHANTOM",5.99,"#7ccee0"],["crimson","CRIMSON ROGUE",6.99,"#d18680"],["golden","GOLDEN HEIST SOLDIER",7.99,"#d4b36a"],["midnight","MIDNIGHT OPERATOR",9.99,"#809fcf"],["commander","LEGENDARY PHANTOM COMMANDER",14.99,"#b5a0d3"]] as const).map(([id,name,price,accent]) => product(id,name,'characters',price,id==='commander'?'LEGENDARY / COMMAND ARMOR':'SIGNATURE / FIELD OUTFIT',OUTFITS[id].label + ' — inspect the complete uniform, not a color swatch on the base player','character',accent,{model:id})),
  ...([
    ['desert', 'DESERT CAMO', 2, '#c4ae7d'], ['pulse', 'NEON PULSE', 2.49, '#9dcf91'],
    ['steel', 'SHADOW STEEL', 2.99, '#8e9ba7'], ['fire', 'CRIMSON FIRE', 3.49, '#d17f70'],
    ['frost', 'CYBER FROST', 3.99, '#95d5e5'], ['protocol', 'GOLD PROTOCOL', 4.99, '#d8b86c'],
    ['diamond', 'DIAMOND TACTICAL', 7.99, '#c7d1e5'],
  ] as const).map(([id, name, price, accent]) => product(id, name, 'cosmetics', price, 'ARMORY / WEAPON FINISH', 'A dedicated studio finish on the supplied rifle — inspect the same finish shown in its photograph', 'weapon', accent, { model: id, finish: accent, compatibility: 'Rifle collection · cosmetic finish · unchanged field statistics' })),
  ...([['salute','VICTORY SALUTE',2],['celebration','TACTICAL CELEBRATION',2],['dance','SOLDIER DANCE',2],['taunt','CHAMPION TAUNT',2.49],['pose','LEGENDARY VICTORY POSE',3.99]] as const).map(([id,name,price]) => product(id,name,'effects',price,'EXPRESSION / MOTION STUDY','An expression study for the collection — preview the presentation without changing your mission animations','effect','#b7c9b4')),
  ...([['trail','NEON MOVEMENT TRAIL',2],['thunder','VICTORY THUNDER',2.49],['entrance','PHANTOM ENTRANCE',2.99],['neon-celebrate','NEON CELEBRATION',2.99],['dissolve','SHADOW DISSOLVE',3.49],['extraction','GOLDEN EXTRACTION',3.99],['explosion','LEGENDARY VICTORY EXPLOSION',5.99]] as const).map(([id,name,price]) => product(id,name,'effects',price,'SIGNATURE / EFFECT STUDY','Light, motion and a personal signature — this collection study does not alter combat visibility or damage','effect',id==='extraction'?'#d8b86c':'#91c5cc')),
  product('starter','STARTER SOLDIER PACK','bundles',5.99,'FIELD / THREE-PIECE COLLECTION','An actual camouflage uniform, desert weapon finish and victory expression','bundle','#b8ae91',{model:'urban',includes:['urban','desert','salute']}),
  product('raider','TACTICAL RAIDER BUNDLE','bundles',9.99,'STEALTH / THREE-PIECE COLLECTION','Ballistic headgear, black response armor and a shadow-steel weapon finish','bundle','#9aadb5',{model:'shadow',includes:['shadow','steel','celebration']}),
  product('warrior','CYBER WARRIOR BUNDLE','bundles',14.99,'EXOSUIT / FOUR-PIECE COLLECTION','A sealed cyan-trimmed suit, frost weapon finish and a luminous signature','bundle','#7ccee0',{model:'cyber',includes:['cyber','frost','trail','neon-celebrate']}),
  product('legend','LEGENDARY COMMANDER PACK','bundles',19.99,'COMMAND / FOUR-PIECE COLLECTION','Command armor, gold hardware and a signature victory presentation','bundle','#d8b86c',{model:'commander',includes:['commander','protocol','pose','explosion']}),
  product('pass','PREMIUM SEASON PASS','season',6.99,'SEASON COLLECTION / REWARD SHOWCASE','Explore curated free and premium reward tracks — season activation and claims are separate from this showcase','season','#99b9c1',{model:'golden'}),
  product('founder','FOUNDER SUPPORTER PACK','founder',9.99,'FOUNDER / SIGNATURE COLLECTION','A dedicated field uniform with a dark carrier, founder insignia and a matching profile identity','founder','#d8b86c',{model:'founder'}),
];
export const money = (value: number) => '$' + value.toFixed(2);
export const findProduct = (id: string) => CATALOG.find(p => p.id === id);
// Read-only integration boundary. No default entitlements, payment requests,
// local purchase ledger or health/recovery authority are created here.
export interface StoreAccount {
  ownedIds: readonly string[]; equippedIds: readonly string[]; grenadeBalance: number | null;
  equipment: readonly { id: EquipmentId; ammo: number; reserve: number }[];
  purchases: readonly { id: string; product: string; price: number; date: string; status: 'pending' | 'verified' | 'failed' | 'cancelled' }[];
}
export function referenceStats(id: EquipmentId) {
  return equipmentStats(EQUIPMENT[id]);
}
export function collectionStats(id:string){
  const definition=collectionWeaponDefinition(id);return definition?equipmentStats(definition):[];
}
function equipmentStats(w:Readonly<EquipmentDefinition>){
  return [ ['Damage', String(w.damage)], ['Fire rate', Math.round(60 / w.interval) + ' RPM'],
    ['Spread', (w.spread * 180 / Math.PI).toFixed(2) + '°'], ['Effective range', (w.range * .025).toFixed(1) + ' m'],
    ['Magazine', String(w.magazine)], ['Reload', w.reloadSeconds.toFixed(2) + ' s'] ];
}
