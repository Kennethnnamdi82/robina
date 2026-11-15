// Prices are exact USD cents. This catalog, not the browser, determines orders.
export const CATALOG_VERSION = 2;
const item = (id, name, cents, kind, extra = {}) => Object.freeze({ id, name, cents, currency: 'USD', kind, enabled: true, ...extra });
export const paymentCatalog = Object.freeze([
  ...[['mp5','MP5',300],['ak47','AK-47',500],['m4a1','M4A1',700],['scar','SCAR-H',1000],['m249','M249',1500],['elite','ELITE TACTICAL RIFLE',2000]].map(([id,name,cents]) => item(id,name,cents,'weapon')),
  ...[[10,300],[20,500],[100,1000]].map(([quantity,cents]) => item(`grenades-${quantity}`,`${quantity} GRENADE PACK`,cents,'grenades',{quantity})),
  item('revive','INSTANT RECOVERY',200,'recovery'),
  ...[['urban','URBAN SOLDIER',299],['neon','NEON ASSASSIN',399],['shadow','SHADOW RAIDER',499],['cyber','CYBER PHANTOM',599],['crimson','CRIMSON ROGUE',699],['golden','GOLDEN HEIST SOLDIER',799],['midnight','MIDNIGHT OPERATOR',999],['commander','LEGENDARY PHANTOM COMMANDER',1499]].map(([id,name,cents])=>item(id,name,cents,'character')),
  ...[['desert','DESERT CAMO',200],['pulse','NEON PULSE',249],['steel','SHADOW STEEL',299],['fire','CRIMSON FIRE',349],['frost','CYBER FROST',399],['protocol','GOLD PROTOCOL',499],['diamond','DIAMOND TACTICAL',799]].map(([id,name,cents])=>item(id,name,cents,'finish')),
  ...[['salute','VICTORY SALUTE',200],['celebration','TACTICAL CELEBRATION',200],['dance','SOLDIER DANCE',200],['taunt','CHAMPION TAUNT',249],['pose','LEGENDARY VICTORY POSE',399],['trail','NEON MOVEMENT TRAIL',200],['thunder','VICTORY THUNDER',249],['entrance','PHANTOM ENTRANCE',299],['neon-celebrate','NEON CELEBRATION',299],['dissolve','SHADOW DISSOLVE',349],['extraction','GOLDEN EXTRACTION',399],['explosion','LEGENDARY VICTORY EXPLOSION',599]].map(([id,name,cents])=>item(id,name,cents,'effect')),
  ...[['starter','STARTER SOLDIER PACK',599,['urban','desert','salute']],['raider','TACTICAL RAIDER BUNDLE',999,['shadow','steel','celebration']],['warrior','CYBER WARRIOR BUNDLE',1499,['cyber','frost','trail','neon-celebrate']],['legend','LEGENDARY COMMANDER PACK',1999,['commander','protocol','pose','explosion']]].map(([id,name,cents,includes])=>item(id,name,cents,'bundle',{includes})),
  item('pass','PREMIUM SEASON PASS',699,'season',{enabled:false,reason:'No active, claimable season has been configured.'}),
  item('founder','FOUNDER SUPPORTER PACK',999,'founder',{includes:['pose','extraction']}),
]);
export const getProduct = id => paymentCatalog.find(p=>p.id===id);
export const usd = cents => `${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`;
export function exactDecimal(value) {
  if(typeof value!=='string'||!/^\d{1,12}(\.\d{1,8})?$/.test(value)) return null;
  const [whole,fraction='']=value.split('.');return BigInt(whole)*100000000n+BigInt(fraction.padEnd(8,'0'));
}
