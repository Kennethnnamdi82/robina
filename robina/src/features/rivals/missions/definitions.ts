import type { HeistMissionDefinition, MissionMode } from './types';

/** Beginner insertion has no deadline. Only the explicitly selected challenge has one. */
export function launchMission(mode: MissionMode = 'standard'): HeistMissionDefinition {
  return {
    id: 'the-launch', version: 1, name: 'THE LAUNCH', difficulty: mode === 'timed' ? 'Timed challenge' : 'Standard / no deadline',
    description: 'Breach AEGIS security in Neon District. Silence the Vault Guardian, recover its core and escape south.',
    prerequisites: [], spawn: { x: 288, y: 288 }, replayable: true,
    timer: { seconds: mode === 'timed' ? 480 : null, warnings: [60, 30, 10] },
    failures: ['player-down', 'timer', 'objective-timer'],
    rewards: { practiceXP: 100, optionalXP: 25, economic: false },
    boss: { id: 'vault-guardian', prerequisites: ['survival', 'phase-link', 'relay-a', 'relay-b'], unlock: 'guardian-defeated' },
    success: ['extract'],
    objectives: [
      { id: 'infiltrate', title: 'Enter the restricted compound', stage: '01 / INFILTRATION', prerequisites: [], event: 'compound-entered', marker: { x: 800, y: 576 } },
      { id: 'breach', title: 'Hack the sector access terminal', stage: '02 / SECURITY BREACH', prerequisites: ['infiltrate'], event: 'sector-console', marker: { x: 1056, y: 672 } },
      { id: 'phase-link', title: 'Synchronize WEST → EAST while OPEN', stage: '02 / SECURITY BREACH', prerequisites: ['breach'], event: 'timed-access', marker: { x: 864, y: 960 } },
      { id: 'survival', title: 'Fight or evade patrols; enter the vault sector', stage: '03 / SURVIVAL', prerequisites: ['breach'], event: 'vault-sector-entered', marker: { x: 1088, y: 400 } },
      { id: 'relay-a', title: 'Bring vault relay A online', stage: '04 / VAULT CORE', prerequisites: ['survival'], event: 'relay-a', marker: { x: 1248, y: 320 } },
      { id: 'relay-b', title: 'Bring vault relay B online', stage: '04 / VAULT CORE', prerequisites: ['survival'], event: 'relay-b', marker: { x: 1568, y: 384 } },
      { id: 'guardian', title: 'Defeat the Vault Guardian', stage: '04 / GUARDIAN LOCKDOWN', prerequisites: ['survival', 'phase-link', 'relay-a', 'relay-b'], event: 'guardian-defeated', marker: { x: 1456, y: 272 } },
      { id: 'vault', title: 'Open the central vault', stage: '04 / VAULT CORE', prerequisites: ['guardian'], event: 'vault', marker: { x: 1536, y: 192 } },
      { id: 'core', title: 'Recover the Vault Core', stage: '04 / VAULT CORE', prerequisites: ['vault'], event: 'training-core', marker: { x: 1536, y: 320 } },
      { id: 'extract', title: 'Reach south extraction and interact', stage: '05 / EXTRACTION', prerequisites: ['core', 'guardian'], event: 'extraction', marker: { x: 288, y: 1152 } },
      { id: 'recon', title: 'Optional: activate the insertion uplink', stage: 'OPTIONAL / RECON', prerequisites: [], event: 'insertion-uplink', optional: true, marker: { x: 288, y: 416 } },
    ],
  };
}
