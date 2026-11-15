import {getProduct} from './catalog.js';
export const emotes=new Set(['salute','celebration','dance','taunt','pose']);
export const selectionFields={weapon:'equippedWeapon',outfit:'equippedOutfit',finish:'equippedFinish',emote:'equippedEmote',trail:'equippedTrail',entrance:'equippedEntrance',effect:'equippedEffect',identity:'equippedIdentity'};
export function selectionSlot(sku){
  const p=getProduct(sku);
  return p?.kind==='weapon'?'weapon':['character','founder'].includes(p?.kind)?'outfit':p?.kind==='finish'?'finish':p?.kind==='effect'?(emotes.has(sku)?'emote':sku==='trail'?'trail':sku==='entrance'?'entrance':'effect'):null;
}
// Included IDs are immutable terms captured when the order was created.
export const entitlementIds=order=>[...new Set([order.sku,...(['bundle','founder'].includes(order.kind)?order.includes:[])])];
export function appearance(account){
  const owned=new Set(account.ownedIds);
  return Object.fromEntries(Object.entries(selectionFields).filter(([slot])=>slot!=='weapon').map(([slot,field])=>[slot,owned.has(account[field])?account[field]:null]));
}
