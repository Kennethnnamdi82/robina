import type { ModelAsset } from './catalog';
export const COLLECTION_MODELS = ['urban','neon','shadow','cyber','crimson','golden','midnight','commander','founder','mp5','m4a1','scar','m249','elite','grenade','desert','pulse','steel','fire','frost','protocol','diamond'] as const;
export const CHARACTER_MODELS = new Set<string>(['operative','urban','neon','shadow','cyber','crimson','golden','midnight','commander','founder']);
export const MODEL_URLS: Record<ModelAsset, string> = {
  rifle:'/assets/rivals/combat3d/weapons/rifle.glb', ak47:'/assets/rugfire/weapons/ak47.glb',
  smg:'/assets/rivals/combat3d/weapons/smg.glb', pistol:'/assets/rivals/combat3d/weapons/pistol.glb',
  operative:'/assets/rivals/characters/universal-operative.glb', health:'/assets/rugfire/props/health_kit.glb',
  ...Object.fromEntries(COLLECTION_MODELS.map(id=>[id,'/assets/rivals/store/models/'+id+'.glb'])) as Record<typeof COLLECTION_MODELS[number],string>,
};
export const modelArt = (model: ModelAsset) => '/assets/rivals/store/' + model + (COLLECTION_MODELS.includes(model as typeof COLLECTION_MODELS[number]) ? '.webp' : '.png');
