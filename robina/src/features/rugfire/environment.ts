import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MissionAssets, ModelId } from './assets';
import type { District } from './world';

export class DistrictArt {
  readonly root = new T.Group();
  private wind = { value: 0 };
  readonly supplies: { mesh: T.Object3D; taken: boolean; kind: 'health' | 'ammo'; baseY: number }[] = [];
  constructor(assets: MissionAssets, district: District) {
    this.root.name = 'supplied-district-art';
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    const place = (id: ModelId, x: number, z: number, width: number, height: number, depth: number) => {
      const { root } = assets.instance(id), bounds = new T.Box3().setFromObject(root), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
      const transform = new T.Group(); transform.add(root);
      root.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
      transform.scale.set(width / size.x, height / size.y, depth / size.z); transform.position.set(x, 0, z); transform.updateMatrixWorld(true);
      root.traverse(o => {
        if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
        const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (!batches.has(o.material)) batches.set(o.material, []);
        batches.get(o.material)!.push(geometry);
      });
    };
    for (const [x, z, width] of [[-2.5, 2, 2.8], [3.8, -6, 2.4], [-3.8, -15, 2.6], [1, -21, 2.3], [-2.7, -31, 2.5], [3, -43, 2.6], [-4.5, -61, 3], [4.5, -65, 3], [0, -72, 2.2]]) place('barricade', x, z, width, 1.28, .65);
    for (const [x, z] of [[-4.7, -5], [4.6, -19], [-4.6, -44]]) place('car', x, z, 1.8, 1.41, 3.9);
    for (const [x, z] of [[-7, -15], [6.8, -29], [-6.5, -55], [7, -71]]) place('crate', x, z, 1.1, 1.62, 1.1);
    // Façades occupy the existing building collision footprints.
    for (const side of [-1, 1]) for (const [z, id] of [[8, 'market'], [-16, 'bank'], [-28, 'hq']] as [number, ModelId][]) place(id, side * 10.5, z, 6, id === 'market' ? 5 : 8, 9);
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries);
      if (geometry) { const mesh = new T.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh); }
      geometries.forEach(g => g.dispose());
    }
    const ground = assets.textures.get('leafy-ground')!;
    ground.wrapS = ground.wrapT = T.RepeatWrapping; ground.repeat.set(1.5, 25);
    const soil = new T.MeshStandardMaterial({ map: ground, roughness: .96, color: 0x9aab8c });
    for (const side of [-1, 1]) {
      const strip = new T.Mesh(new T.PlaneGeometry(1.45, 94), soil); strip.rotation.x = -Math.PI / 2;
      strip.position.set(side * 6.65, .135, -33); strip.receiveShadow = true; this.root.add(strip);
    }
    const material = new T.MeshStandardMaterial({ map: assets.textures.get('grass-color'), alphaMap: assets.textures.get('grass-alpha'), alphaTest: .42, side: T.DoubleSide, roughness: 1, color: 0xbac6a2 });
    material.onBeforeCompile = shader => {
      shader.uniforms.uWind = this.wind;
      shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * .45;
        transformed.x += sin(uWind * 1.4 + phase) * pow(position.y / .7, 2.0) * .13;
        transformed.z += cos(uWind * .9 + phase) * pow(position.y / .7, 2.0) * .06;`);
    };
    material.customProgramCacheKey = () => 'rugfire-wind-v1';
    const blade = new T.PlaneGeometry(.85, .7, 1, 3); blade.translate(0, .35, 0);
    // Sample one upright tuft from the supplied atlas, not the entire UV sheet.
    const uv = blade.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, .58 + uv.getX(i) * .21, .135 + uv.getY(i) * .105);
    const grass = new T.InstancedMesh(blade, material, 960); grass.name = 'wind-grass'; grass.receiveShadow = true;
    const dummy = new T.Object3D(); let seed = 717;
    const random = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
    for (let i = 0; i < 960; i++) {
      const side = i % 2 ? 1 : -1;
      dummy.position.set(side * (6.02 + random() * 1.2), .13, 13 - random() * 93);
      dummy.rotation.y = random() * Math.PI; dummy.scale.setScalar(.55 + random() * .7); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
      grass.setColorAt(i, new T.Color().setHSL(.21 + random() * .05, .18, .56 + random() * .25));
    }
    grass.computeBoundingSphere(); this.root.add(grass);
    for (const [kind, x, z] of [['ammo', 2.3, 7], ['health', -4.3, -12], ['ammo', 4, -34], ['health', 2.2, -57]] as ['ammo' | 'health', number, number][]) {
      const { root } = assets.instance(kind); root.position.set(x, .18, z); this.root.add(root);
      this.supplies.push({ mesh: root, taken: false, kind, baseY: .18 });
      const ring = new T.Mesh(new T.RingGeometry(.35, .4, 24), new T.MeshBasicMaterial({ color: kind === 'health' ? 0x91c5a2 : 0xd4b778, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -.15; root.add(ring);
    }
    district.root.add(this.root);
  }
  update(time: number) {
    this.wind.value = time;
    for (const supply of this.supplies) if (!supply.taken) { supply.mesh.position.y = supply.baseY + Math.sin(time * 1.8) * .035; }
  }
}
