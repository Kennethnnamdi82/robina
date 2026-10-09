import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Collider } from './physics';
export type District = { root: T.Group; colliders: Collider[]; terminal: T.Vector3; extraction: T.Vector3; beacon: T.Mesh; textures: T.Texture[]; lights: T.PointLight[] };
export function createDistrict(): District {
  const root = new T.Group(), colliders: Collider[] = [], textures: T.Texture[] = [], lights: T.PointLight[] = [];
  const batches = new Map<string, { material: T.MeshStandardMaterial; geometries: T.BufferGeometry[] }>();
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number, solid = false, glow = false) => {
    const key = color + '/' + glow;
    if (!batches.has(key)) batches.set(key, { material: new T.MeshStandardMaterial({ color, roughness: glow ? .35 : .78, metalness: .15, emissive: glow ? color : 0, emissiveIntensity: glow ? 1.4 : 0 }), geometries: [] });
    const geo = new T.BoxGeometry(w, h, d); geo.translate(x, y, z); batches.get(key)!.geometries.push(geo);
    if (solid) colliders.push({ box: new T.Box3(new T.Vector3(x - w / 2, y - h / 2, z - d / 2), new T.Vector3(x + w / 2, y + h / 2, z + d / 2)), camera: true });
  };
  const sign = (x: number, y: number, z: number, title: string, subtitle: string, color: string, width = 5, angle = 0) => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 384;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#101719'; ctx.fillRect(0, 0, 1024, 384);
    ctx.fillStyle = color; ctx.fillRect(38, 38, 6, 308);
    ctx.font = 'bold 86px Arial'; ctx.fillText(title, 70, 165); ctx.fillStyle = '#adada5';
    ctx.font = '25px monospace'; ctx.fillText(subtitle, 74, 235);
    ctx.strokeStyle = '#353c3d'; ctx.strokeRect(20, 20, 984, 344);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; textures.push(texture);
    const mesh = new T.Mesh(new T.BoxGeometry(width, width * .375, .12), new T.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: .7, roughness: .5 }));
    mesh.position.set(x, y, z); mesh.rotation.y = angle; root.add(mesh);
  };
  const asphalt = document.createElement('canvas'); asphalt.width = asphalt.height = 256;
  const ctx = asphalt.getContext('2d')!; ctx.fillStyle = '#303735'; ctx.fillRect(0, 0, 256, 256);
  let seed = 917;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 18000; i++) { const value = 35 + random() * 35; ctx.fillStyle = 'rgb(' + value + ',' + (value + 3) + ',' + (value + 4) + ')'; ctx.fillRect(random() * 256, random() * 256, 1, 1); }
  const roadTexture = new T.CanvasTexture(asphalt); roadTexture.wrapS = roadTexture.wrapT = T.RepeatWrapping; roadTexture.repeat.set(7, 36); textures.push(roadTexture);
  const road = new T.Mesh(new T.PlaneGeometry(26, 112), new T.MeshStandardMaterial({ map: roadTexture, roughness: .76, metalness: .08 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, -.02, -34); road.receiveShadow = true; root.add(road);
  for (const side of [-1, 1]) {
    box(side * 8.3, .05, -32, 5.4, .12, 100, 0x414748);
    box(side * 5.7, .07, -32, .16, .15, 100, 0x696c64);
    for (let z = 12; z > -82; z -= 4) box(side * 8.3, .12, z, 5.3, .012, .03, 0x2b3436);
    for (let index = 0; index < 8; index++) {
      const z = 8 - index * 12, height = 8 + random() * 13, x = side * (10.5 + (index % 3 === 1 ? 1 : 0));
      if (index === 4 || index === 5) continue; // Facility courtyard and sniper platform.
      box(x, height / 2, z, 6, height, 9, index % 2 ? 0x323c41 : 0x3d4240, true);
      box(x, height + .2, z, 6.4, .4, 9.3, 0x171f24);
      box(x, .3, z, 6.2, .6, 9.2, 0x252e32);
      for (let floor = 2; floor < height - 1; floor += 2.2) {
        for (let j = -1; j <= 1; j++) {
          box(x + j * 1.7, floor, z + 4.52, .75, 1.15, .035, random() > .6 ? 0x98835a : 0x1c2c33, false, random() > .7);
          box(x - side * 3.02, floor, z + j * 2.7, .025, 1.05, 1.2, random() > .65 ? 0x8e7954 : 0x1b2b32, false, random() > .8);
        }
      }
      // Shop glazing, awnings, drain pipes and rooftop plant.
      box(x - side * 3.06, 1.2, z, .06, 1.8, 6.5, 0x19272b);
      box(x - side * 3.4, 2.45, z, .9, .18, 7, 0x55594b);
      box(x - side * 3.05, height / 2, z + 3.9, .13, height, .13, 0x616862);
      box(x, height + .75, z - 2, 2, 1.1, 1.6, 0x606663);
    }
  }
  // Dense distant skyline, bounded playable corridor.
  for (let i = 0; i < 24; i++) {
    const x = (random() - .5) * 150, height = 15 + random() * 35;
    box(x, height / 2, -106 - random() * 30, 5 + random() * 5, height, 8, 0x263039);
    for (let j = 0; j < 7; j++) box(x, 3 + j * 4, -101, .8, .3, .04, 0x96866b, false, true);
  }
  box(-12.5, 2, -32, 1, 4, 100, 0x273236, true); box(12.5, 2, -32, 1, 4, 100, 0x273236, true);
  box(0, 2, -83, 25, 4, 1, 0x2a3439, true); box(0, 2, 17, 25, 4, 1, 0x2a3439, true);
  for (let z = 12; z > -81; z -= 7) { box(-.2, .004, z, .09, .014, 3.2, 0xa18b60); box(.2, .004, z, .09, .014, 3.2, 0xa18b60); }
  for (let x = -4.5; x < 5; x += 1) box(x, .005, 6, .5, .016, 2.3, 0x96978a);
  const covers = [[-2.5, 2, 2.8], [3.8, -6, 2.4], [-3.8, -15, 2.6], [1, -21, 2.3], [-2.7, -31, 2.5], [3, -43, 2.6], [-4.5, -61, 3], [4.5, -65, 3], [0, -72, 2.2]];
  for (const [x, z, width] of covers) {
    colliders.push({ box: new T.Box3(new T.Vector3(x - width / 2, 0, z - .325), new T.Vector3(x + width / 2, 1.28, z + .325)), camera: true });
  }
  const car = (x: number, z: number, color: number) => {
    box(x, .55, z, 1.8, .65, 3.9, color, true);
    box(x, 1.04, z + .2, 1.6, .55, 1.9, 0x212c32, true);
    box(x, 1.36, z + .2, 1.6, .1, 1.9, color);
    for (const side of [-1, 1]) for (const offset of [-1.2, 1.2]) box(x + side * .85, .32, z + offset, .24, .5, .65, 0x12191d);
    box(x, .62, z - 1.98, 1.5, .12, .04, 0xd7cbae, false, true);
    box(x, .6, z + 1.98, 1.4, .12, .04, 0x992d25, false, true);
  };
  for (const [x, z] of [[-4.7, -5], [4.6, -19], [-4.6, -44]]) colliders.push({ box: new T.Box3(new T.Vector3(x - .9, 0, z - 1.95), new T.Vector3(x + .9, 1.41, z + 1.95)), camera: true });
  for (const [x, z] of [[-7, -15], [6.8, -29], [-6.5, -55], [7, -71]]) {
    colliders.push({ box: new T.Box3(new T.Vector3(x - .55, 0, z - .55), new T.Vector3(x + .55, 1.62, z + .55)), camera: true });
  }
  for (let z = 7; z > -76; z -= 15) for (const side of [-1, 1]) {
    const x = side * 5.9;
    box(x, 2.6, z, .09, 5.2, .09, 0x333f44);
    box(x - side * .5, 5.18, z, 1.05, .08, .08, 0x3b4549);
    box(x - side * .9, 5.1, z, .38, .04, .3, 0xffc687, false, true);
    const light = new T.PointLight(0xffc48c, 13, 13, 2); light.position.set(x - side * .9, 4.9, z); root.add(light); light.visible = lights.length < 4; lights.push(light);
    // No shadows on local practical lights; one sun supplies shadowing.
  }
  sign(-7.2, 5.3, -12, '$MOONPUG', 'THE NEXT BIG THING. / LAUNCH 20:00', '#c9bb8a', 6, .2);
  sign(7.3, 4.1, -28, 'TRUST THE HYPE', 'GUARANTEED RETURNS* / *NOT GUARANTEED', '#bd7064', 5, -.25);
  sign(-7.5, 2.9, -3, 'EXCHANGE / 04', 'MEME CITY · FINANCIAL DISTRICT', '#b7b8a9', 4, .4);
  sign(0, 7, -57, 'LIQUIDITY / CORE', 'RESTRICTED ACCESS · AUTHORIZED PERSONNEL', '#c5985d', 9);
  sign(-8.1, 2.3, -26, 'BUY THE DIP', 'MARKET STREET / OPEN 24 HOURS', '#a0b5a5', 3, .2);
  // Overhead utility cables.
  for (const z of [-8, -32, -58]) {
    const points = [new T.Vector3(-10, 7, z), new T.Vector3(0, 5.8, z), new T.Vector3(10, 7, z)];
    const curve = new T.CatmullRomCurve3(points);
    const line = new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(18)), new T.LineBasicMaterial({ color: 0x181f23 })); root.add(line);
  }
  // Whale's accessible sightline atop an industrial platform.
  box(8, 1.6, -39, 4, 3.2, 5, 0x424c50, true);
  box(8, 3.25, -39, 4.2, .3, 5.2, 0x63716d, true);
  box(9.6, 4.1, -39, .14, 1.4, 5, 0x242e31);
  // Facility courtyard: shipping containers and cooling plant.
  for (const side of [-1, 1]) {
    box(side * 8.4, 1.5, -51, 4.3, 3, 8, side < 0 ? 0x495954 : 0x585446, true);
    for (let z = -54; z < -47; z += .6) box(side * 6.22, 1.5, z, .08, 2.8, .05, 0x70746c);
    box(side * 9, 2.5, -68, 4, 5, 9, 0x303a40, true);
    box(side * 9, 5.2, -68, 3, .4, 8, 0x6a6a5a);
  }
  box(0, 6.25, -57, 19, .45, .6, 0x343f42);
  box(-8.5, 3, -57, .6, 6, .6, 0x525a56, true); box(8.5, 3, -57, .6, 6, .6, 0x525a56, true);
  box(-7.2, .9, -55.7, 1.3, 1.8, .9, 0x242e31, true);
  sign(-7.2, 1.8, -55.1, 'DRAIN ACTIVE', 'E / ISOLATE CORE', '#c76658', 1.6);
  const beacon = new T.Mesh(new T.RingGeometry(1.5, 1.65, 48), new T.MeshBasicMaterial({ color: 0xa7c4aa, transparent: true, opacity: .7, side: T.DoubleSide }));
  beacon.rotation.x = -Math.PI / 2; beacon.position.set(0, .04, -78); root.add(beacon); beacon.visible = false;
  // Small debris and reflective damp patches.
  for (let i = 0; i < 70; i++) box((random() - .5) * 10, .025, 12 - random() * 92, .07 + random() * .25, .025, .15, i % 2 ? 0x858678 : 0x373d3a);
  for (const batch of batches.values()) {
    const merged = mergeGeometries(batch.geometries)!; batch.geometries.forEach(g => g.dispose());
    const mesh = new T.Mesh(merged, batch.material); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  }
  return { root, colliders, terminal: new T.Vector3(-7.2, 0, -55), extraction: new T.Vector3(0, 0, -78), beacon, textures, lights };
}
