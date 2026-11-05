import { EQUIPMENT, type EquipmentId } from '../three/Loadout';

export const CATEGORIES = [
  ['featured', 'Featured'], ['weapons', 'Guns & weapons'], ['grenades', 'Grenades'],
  ['health', 'Health & recovery'], ['characters', 'Character skins'], ['cosmetics', 'Weapon cosmetics'],
  ['effects', 'Emotes & effects'], ['bundles', 'Premium bundles'], ['season', 'Season pass'],
  ['founder', 'Founder pack'], ['inventory', 'My inventory'], ['history', 'Purchase history'],
] as const;
export type Category = typeof CATEGORIES[number][0];
export type ModelAsset = 'rifle' | 'ak47' | 'smg' | 'pistol' | 'operative' | 'health';
export interface Product {
  id: string; name: string; category: Category; price: number; subtitle: string; description: string;
  accent: string; art: 'weapon' | 'character' | 'grenade' | 'medical' | 'effect' | 'bundle' | 'season' | 'founder';
  model?: ModelAsset; reference?: EquipmentId; quantity?: number; includes?: string[];
  proposed?: { magazine: number; ammo: string }; compatibility?: string; finish?: string;
}
const product = (id: string, name: string, category: Category, price: number, subtitle: string, description: string, art: Product['art'], accent = '#c8b58a', extra: Partial<Product> = {}): Product => ({ id, name, category, price, subtitle, description, art, accent, ...extra });
export const CATALOG: readonly Product[] = [
  product('mp5', 'MP5', 'weapons', 3, 'SUBMACHINE GUN', 'A compact close-quarters concept. Existing SMG shown as a reference, not a finished MP5.', 'weapon', '#95c8bb', { model: 'smg', reference: 'smg', proposed: { magazine: 30, ammo: '9mm' } }),
  product('ak47', 'AK-47', 'weapons', 5, 'ASSAULT RIFLE', 'The classic assault silhouette. Inspect the supplied AK-47 asset. The existing gameplay rifle configuration is a separate reference, not a new AK-47 balance.', 'weapon', '#c8b58a', { model: 'ak47', reference: 'rifle', proposed: { magazine: 30, ammo: '7.62mm' } }),
  product('m4a1', 'M4A1', 'weapons', 7, 'ASSAULT RIFLE', 'A modular tactical rifle concept. A dedicated model and gameplay configuration are not yet available.', 'weapon', '#a9b8b9', { proposed: { magazine: 30, ammo: '5.56mm' } }),
  product('scar', 'SCAR-H', 'weapons', 10, 'BATTLE RIFLE', 'A heavy-caliber concept for deliberate engagements. Model and combat tuning are not implemented.', 'weapon', '#c8aa7f', { proposed: { magazine: 20, ammo: '7.62mm NATO' } }),
  product('m249', 'M249', 'weapons', 15, 'LIGHT MACHINE GUN', 'A sustained-fire support concept. No performance advantages are promised or granted.', 'weapon', '#a5ae90', { proposed: { magazine: 100, ammo: '5.56mm' } }),
  product('elite', 'ELITE TACTICAL RIFLE', 'weapons', 20, 'SPECIALIST PLATFORM', 'An advanced weapon presentation awaiting its own model, configuration and balancing.', 'weapon', '#b6aad0', { proposed: { magazine: 40, ammo: '5.56mm' } }),
  ...([[10, 3, 'TACTICAL'], [20, 5, 'COMBAT'], [100, 10, 'ULTIMATE']] as const).map(([quantity, price, name]) => product('grenades-' + quantity, name + ' GRENADE PACK', 'grenades', price, quantity + ' GRENADES', 'Refill presentation only. Does not allocate grenades, change carrying capacity or refill a running mission.', 'grenade', '#c6b995', { quantity })),
  product('revive', 'INSTANT RECOVERY', 'health', 2, 'RESTORE 100 HP · PROPOSED', 'Intended to bypass a two-hour recovery period after verified payment. This preview cannot restore health or bypass a lock.', 'medical', '#c89990'),
  product('first-aid', 'FIRST-AID KIT', 'health', 0, 'EXISTING FIELD PICKUP · NOT FOR SALE', 'Medical pickups already restore health during missions. Find and collect them in the city using the existing controls.', 'medical', '#96b5a5', { model: 'health' }),
  ...([
    ['urban', 'URBAN SOLDIER', 2.99, 'Modern tactical protection.', '#b8ae91'],
    ['neon', 'NEON ASSASSIN', 3.99, 'Black equipment. Electric green signature.', '#a5d788'],
    ['shadow', 'SHADOW RAIDER', 4.99, 'Matte-black stealth equipment.', '#9aadb5'],
    ['cyber', 'CYBER PHANTOM', 5.99, 'A cyan-accented future-armor concept.', '#7ccee0'],
    ['crimson', 'CRIMSON ROGUE', 6.99, 'Red-and-black tactical combat styling.', '#d18680'],
    ['golden', 'GOLDEN HEIST SOLDIER', 7.99, 'Restrained gold on field-ready equipment.', '#d4b36a'],
    ['midnight', 'MIDNIGHT OPERATOR', 9.99, 'Black-and-blue special operations styling.', '#809fcf'],
    ['commander', 'LEGENDARY PHANTOM COMMANDER', 14.99, 'A futuristic commander armor concept.', '#b5a0d3'],
  ] as const).map(([id, name, price, description, accent]) => product(id, name, 'characters', price, 'OUTFIT CONCEPT · COSMETIC ONLY', description + ' Base operative shown; the proposed costume is not implemented.', 'character', accent, { model: 'operative' })),
  ...([
    ['desert', 'DESERT CAMO', 2, '#c4ae7d'], ['pulse', 'NEON PULSE', 2.49, '#9dcf91'],
    ['steel', 'SHADOW STEEL', 2.99, '#8e9ba7'], ['fire', 'CRIMSON FIRE', 3.49, '#d17f70'],
    ['frost', 'CYBER FROST', 3.99, '#95d5e5'], ['protocol', 'GOLD PROTOCOL', 4.99, '#d8b86c'],
    ['diamond', 'DIAMOND TACTICAL', 7.99, '#c7d1e5'],
  ] as const).map(([id, name, price, accent]) => product(id, name, 'cosmetics', price, 'WEAPON FINISH CONCEPT', 'Inspect the original supplied rifle and a studio color study. No finished skin, combat stat change or in-game equipment change.', 'weapon', accent, { model: 'rifle', finish: accent, compatibility: 'Rifle reference only; final compatibility unconfirmed.' })),
  ...([
    ['salute', 'VICTORY SALUTE', 2], ['celebration', 'TACTICAL CELEBRATION', 2], ['dance', 'SOLDIER DANCE', 2],
    ['taunt', 'CHAMPION TAUNT', 2.49], ['pose', 'LEGENDARY VICTORY POSE', 3.99],
  ] as const).map(([id, name, price]) => product(id, name, 'effects', price, 'EMOTE CONCEPT', 'Expression concept. A matching character animation has not been integrated; the motion study is not an in-game emote.', 'effect', '#b7c9b4')),
  ...([
    ['trail', 'NEON MOVEMENT TRAIL', 2], ['thunder', 'VICTORY THUNDER', 2.49], ['entrance', 'PHANTOM ENTRANCE', 2.99],
    ['neon-celebrate', 'NEON CELEBRATION', 2.99], ['dissolve', 'SHADOW DISSOLVE', 3.49],
    ['extraction', 'GOLDEN EXTRACTION', 3.99], ['explosion', 'LEGENDARY VICTORY EXPLOSION', 5.99],
  ] as const).map(([id, name, price]) => product(id, name, 'effects', price, 'VISUAL EFFECT CONCEPT', 'A restrained studio motion study, not a finished gameplay effect. No combat visibility, damage or event bindings are changed.', 'effect', id === 'extraction' ? '#d8b86c' : '#91c5cc')),
  product('starter', 'STARTER SOLDIER PACK', 'bundles', 5.99, 'THREE-PIECE COLLECTION', 'A grounded first identity for the city.', 'bundle', '#b8ae91', { model: 'operative', includes: ['urban', 'desert', 'salute'] }),
  product('raider', 'TACTICAL RAIDER BUNDLE', 'bundles', 9.99, 'THREE-PIECE COLLECTION', 'A quieter signature. A sharper exit.', 'bundle', '#9aadb5', { model: 'operative', includes: ['shadow', 'steel', 'celebration'] }),
  product('warrior', 'CYBER WARRIOR BUNDLE', 'bundles', 14.99, 'FOUR-PIECE COLLECTION', 'Cold light. Clean lines. An unmistakable identity.', 'bundle', '#7ccee0', { model: 'operative', includes: ['cyber', 'frost', 'trail', 'neon-celebrate'] }),
  product('legend', 'LEGENDARY COMMANDER PACK', 'bundles', 19.99, 'FOUR-PIECE COLLECTION', 'Command the presentation. Not the balance.', 'bundle', '#d8b86c', { model: 'operative', includes: ['commander', 'protocol', 'pose', 'explosion'] }),
  product('pass', 'PREMIUM SEASON PASS', 'season', 6.99, 'PER SEASON · NO ACTIVE SEASON', 'A presentation of free and premium reward tracks. No active season, reward schedule or progression service is connected.', 'season', '#99b9c1'),
  product('founder', 'FOUNDER SUPPORTER PACK', 'founder', 9.99, 'A SIGNATURE FROM THE START', 'Proposed costume, profile badge, title, profile border and victory animation. No scarcity, sales count or rewards are claimed.', 'founder', '#d8b86c', { model: 'operative' }),
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
  const w = EQUIPMENT[id];
  return [ ['Damage', String(w.damage)], ['Fire rate', Math.round(60 / w.interval) + ' RPM'],
    ['Spread', (w.spread * 180 / Math.PI).toFixed(2) + '°'], ['Effective range', (w.range * .025).toFixed(1) + ' m'],
    ['Magazine', String(w.magazine)], ['Reload', w.reloadSeconds.toFixed(2) + ' s'] ];
}
