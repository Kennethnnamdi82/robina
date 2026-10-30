export interface NeonProp {
  id: string; frame: string; x: number; y: number; size: number;
  solid?: { width: number; height: number }; light?: number; scanner?: boolean;
  inspect?: { name: string; description: string; toggle: boolean };
}

export const NEON_PROPS: NeonProp[] = [
  { id: 'insertion-uplink', frame: 'hologram', x: 288, y: 416, size: 110, light: 0x8f65ff, inspect: { name: 'Insertion uplink', description: 'Toggle the local holographic beacon.', toggle: true } },
  { id: 'cover-a', frame: 'crate', x: 480, y: 288, size: 91, solid: { width: 46, height: 40 } },
  { id: 'cover-b', frame: 'equipment-case', x: 480, y: 352, size: 90, solid: { width: 46, height: 40 }, light: 0xbc63db },
  { id: 'auxiliary-console', frame: 'console', x: 160, y: 640, size: 124, solid: { width: 46, height: 40 }, light: 0x33cbef, inspect: { name: 'Auxiliary console', description: 'Switch the local diagnostic uplink on or off.', toggle: true } },
  { id: 'sector-console', frame: 'console', x: 1056, y: 672, size: 124, solid: { width: 46, height: 40 }, light: 0x33cbef },
  { id: 'reactor', frame: 'reactor', x: 1440, y: 1056, size: 178, solid: { width: 78, height: 52 }, light: 0x36caff, inspect: { name: 'Auxiliary reactor', description: 'Power stable. Core access remains sealed.', toggle: false } },
  { id: 'vault', frame: 'vault-door', x: 1536, y: 192, size: 235, solid: { width: 140, height: 44 }, light: 0xffb34a, inspect: { name: 'Central vault', description: 'Access sealed. Vault missions arrive in a later phase.', toggle: false } },
  { id: 'optics-a', frame: 'camera', x: 568, y: 176, size: 105, scanner: true, light: 0xff704f },
  { id: 'optics-b', frame: 'camera', x: 1152, y: 832, size: 105, scanner: true, light: 0xff704f },
  { id: 'cooling-a', frame: 'vent', x: 944, y: 1120, size: 145, solid: { width: 70, height: 42 } },
  { id: 'cooling-b', frame: 'vent', x: 1568, y: 704, size: 145, solid: { width: 70, height: 42 } },
  { id: 'storage-a', frame: 'lockers', x: 1248, y: 736, size: 115, solid: { width: 46, height: 40 } },
  { id: 'storage-b', frame: 'crate', x: 1312, y: 736, size: 94, solid: { width: 46, height: 40 } },
  { id: 'pipes-a', frame: 'pipes', x: 1568, y: 1220, size: 105 },
  { id: 'cables-a', frame: 'cable-reel', x: 420, y: 1160, size: 90 },
  ...[160, 608, 1184, 1632].map((x, i) => ({ id: `light-north-${i}`, frame: 'light-column', x, y: 112, size: 110, light: 0x39b7ff })),
  ...[160, 608, 1184, 1632].map((x, i) => ({ id: `light-south-${i}`, frame: 'light-column', x, y: 1296, size: 110, light: 0xa06aff })),
];

/** Theme definitions are data, so future districts can reuse the renderer without new systems. */
export const DISTRICT_THEMES = {
  neon: { ambient: 0x17152f, cyan: 0x3bd2ff, amber: 0xffb65b },
  phantom: { ambient: 0x18112d, cyan: 0x9a74ff, amber: 0x52e5db },
  reactor: { ambient: 0x201611, cyan: 0x4fe2bd, amber: 0xff7849 },
} as const;
