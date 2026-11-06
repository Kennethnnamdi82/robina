export const OUTFITS = {
  urban: { source: 'Military_Male_03.glb', label: 'ACU camouflage · helmet · plate carrier', body: '#c4c9b3', gear: '#63705a' },
  neon: { source: 'Military_Male_03.glb', label: 'Graphite field suit · night optics · lime insignia', body: '#263733', gear: '#27362d' },
  shadow: { source: 'Military_Male_03.glb', label: 'Ballistic helmet · smoked visor · black assault armor', body: '#353a3b', gear: '#242a2c' },
  cyber: { source: 'Military_Male_03.glb', label: 'Sealed visor · reinforced armor · cyan insignia', body: '#47616b', gear: '#2d4654' },
  crimson: { source: 'Military_Male_03.glb', label: 'Crimson combat fatigues · black carrier · tactical mask', body: '#783d46', gear: '#2b2c30' },
  golden: { source: 'Military_Male_03.glb', label: 'Desert camo · bronze hardware · command insignia', body: '#c7b58d', gear: '#8b744b' },
  midnight: { source: 'Military_Male_03.glb', label: 'Navy response armor · blue lenses · night optics', body: '#344c6a', gear: '#27333d' },
  commander: { source: 'Military_Male_03.glb', label: 'Command armor · reinforced shoulders · gold insignia', body: '#44464d', gear: '#34363d' },
  founder: { source: 'Military_Male_03.glb', label: 'Founder field uniform · white-gold insignia · dark carrier', body: '#8b9995', gear: '#252f35' },
} as const;
export type OutfitId = keyof typeof OUTFITS;
export const isOutfit = (id: string): id is OutfitId => id in OUTFITS;
