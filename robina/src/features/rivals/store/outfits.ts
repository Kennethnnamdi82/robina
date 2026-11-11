export const OUTFITS = {
  urban: { source: 'Military_Male_03.glb', label: 'ACU camouflage · helmet · plate carrier', body: '#c4c9b3', gear: '#63705a' },
  neon: { source: 'Military_Male_03.glb', label: 'Graphite field suit · night optics · lime insignia', body: '#263733', gear: '#27362d' },
  shadow: { source: 'Military_Male_03.glb', label: 'Ballistic helmet · curved assault visor · reinforced carrier · breacher mask', body: '#42494b', gear: '#333b3d' },
  cyber: { source: 'Military_Male_03.glb', label: 'Sealed visor · reinforced armor · cyan insignia', body: '#47616b', gear: '#2d4654' },
  crimson: { source: 'Military_Male_03.glb', label: 'Crimson combat fatigues · black carrier · tactical mask', body: '#783d46', gear: '#2b2c30' },
  golden: { source: 'Military_Male_03.glb', label: 'Desert camo · bronze hardware · command insignia', body: '#c7b58d', gear: '#8b744b' },
  midnight: { source: 'Military_Male_03.glb', label: 'Quad-lens night optics · segmented navy armor · radio pack · wrist terminal · armored gauntlets', body: '#344658', gear: '#26343e' },
  commander: { source: 'Military_Male_03.glb', label: 'Sealed command helmet · layered silver ceramic armor · split command mantle · command backpack · reinforced leg armor', body: '#343b42', gear: '#525e67' },
  founder: { source: 'Military_Male_03.glb', label: 'Founder field uniform · white-gold insignia · dark carrier', body: '#8b9995', gear: '#252f35' },
} as const;
export type OutfitId = keyof typeof OUTFITS;
export const isOutfit = (id: string): id is OutfitId => id in OUTFITS;

export const OUTFIT_EDITIONS:Record<OutfitId,{tier:string;role:string;signature:string}>={
  urban:{tier:'FIELD',role:'FIELD REGULAR',signature:'Camouflage fatigues / issued carrier'},
  neon:{tier:'RECON',role:'RECON SPECIALIST',signature:'Lightweight harness / twin optics'},
  shadow:{tier:'ASSAULT',role:'BREACHER',signature:'Smoked visor / reinforced assault carrier'},
  cyber:{tier:'SPECIALIST',role:'TECHNICAL OPERATOR',signature:'Composite torso / instrumented forearms'},
  crimson:{tier:'ASSAULT',role:'URBAN RAIDER',signature:'Crimson fatigues / ballistic face guard'},
  golden:{tier:'VETERAN',role:'DESERT SPECIALIST',signature:'Sand field suit / reinforced desert rig'},
  midnight:{tier:'ELITE',role:'NIGHT OPERATIONS',signature:'Quad optics / segmented armor / comms pack'},
  commander:{tier:'SIGNATURE',role:'PHANTOM COMMAND',signature:'Sealed helmet / ceramic armor / split mantle'},
  founder:{tier:'FOUNDER',role:'FOUNDING OPERATIVE',signature:'Pale field suit / numbered command insignia'},
};
