/** Local recon configuration, not a claim of a server-backed mission/reward system. */
export const RECON_MISSION = {
  id: 'neon-recon',
  name: 'THE LAUNCH',
  subtitle: 'The Launch / Breach protocol',
  description: 'Infiltrate Neon District. Fight or evade AEGIS patrols, breach security and bring the vault relays online. Defeat the three-phase Vault Guardian, recover the Vault Core and extract south.',
  difficulty: 'Training',
  objective: 'Activate the insertion uplink',
  objectiveTarget: 1,
  rewards: null,
  weapon: 'Pulse carbine / 12-round magazine / unlimited training reserve',
  extraction: 'South extraction / training core required',
} as const;
