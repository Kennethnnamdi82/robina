import * as T from 'three';
import type { Solid3D } from './world3d';
import { METRES, point3 } from './world3d';
import { VENUES } from './Operations';
import type { WorldState } from '../world/WorldState';
import type { RaidAssets } from './RaidAssets';
import { CityEnvironment } from './CityEnvironment';
import type { QualityId } from '../core/presentation';
import type { POV } from './CameraRig';

export class WorldArt {
  city?: CityEnvironment;
  private wallBatch: T.InstancedMesh;
  private staticCubes: T.Mesh[] = [];
  private platformMeshes: T.Mesh[] = [];
  readonly root = new T.Group(); readonly surfaces: T.Mesh[] = [];
  readonly geometry = new Set<T.BufferGeometry>(); readonly materials = new Set<T.Material>();
  readonly devices = new Map<string,T.Group>(); private doors = new Map<string,T.Mesh>();
  private box = new T.BoxGeometry(1,1,1); private matrix = new T.Matrix4(); private dummy = new T.Object3D();
  private cyan: T.MeshStandardMaterial; private amber: T.MeshStandardMaterial;
  private ground: T.InstancedMesh; private coverMeshes = new Map<string,T.Mesh>();
  constructor(readonly state: WorldState,readonly solids: Solid3D[],readonly venue = 0,readonly seed = 0) {
    this.geometry.add(this.box);
    const material = (color: number,emissive = 0) => { const m = new T.MeshStandardMaterial({ color,roughness: .72,metalness: .35,emissive,emissiveIntensity: .85 }); this.materials.add(m); return m; };
    const floor = material(0x586b7a),wall = material(0x4c687e),cover = material(0x74879a),dark = material(0x344a60);
    // World-scaled seams/vents keep the existing physical wall modules readable
    // at low camera angles without adding textures or per-panel draw calls.
    wall.customProgramCacheKey = () => 'rivals-lit-wall-panels-1';
    wall.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPanelPosition; varying vec3 vPanelFace;').replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 panelPosition = vec4(transformed,1.);
        #ifdef USE_INSTANCING
        panelPosition = instanceMatrix * panelPosition;
        #endif
        vPanelPosition = (modelMatrix * panelPosition).xyz; vPanelFace = abs(normal);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vPanelPosition; varying vec3 vPanelFace;').replace('#include <color_fragment>',`#include <color_fragment>
        vec2 wallUV = vPanelFace.z > .5 ? vPanelPosition.xy : vPanelPosition.zy;
        if (vPanelFace.y > .5) wallUV = vPanelPosition.xz;
        vec2 cell = fract(wallUV / vec2(1.6,1.7)),edge = min(cell,1. - cell);
        float joint = 1. - smoothstep(.005,.018,min(edge.x,edge.y));
        float vent = step(.73,cell.y) * step(cell.y,.88) * step(.18,cell.x) * step(cell.x,.82) * step(.5,fract(wallUV.y * 24.));
        float panelGlow = (1. - smoothstep(.006,.014,abs(cell.y - .19))) * step(.16,cell.x) * step(cell.x,.84);
        diffuseColor.rgb *= 1. - joint * .66 - vent * .34;
        diffuseColor.rgb += vec3(.04,.09,.12) * panelGlow;`).replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(.06,.45,.55) * panelGlow;');
    };
    this.cyan = material(0x28494a,0x083a40);this.cyan.emissiveIntensity=.22; this.amber = material(VENUES[venue].accent,0x60431c);
    const tiles = this.state.level.width * this.state.level.height,ground = new T.InstancedMesh(this.box,floor,tiles);
    for (let y = 0,index = 0; y < this.state.level.height; y++) for (let x = 0; x < this.state.level.width; x++,index++) {
      this.dummy.position.set((x + .5) * 1.6,-.12,(y + .5) * 1.6); this.dummy.scale.set(1.57,.22,1.57); this.dummy.updateMatrix(); ground.setMatrixAt(index,this.dummy.matrix);
      ground.setColorAt(index,new T.Color((x + y) % 3 ? 0x9fb2c2 : 0x6d879d));
    }
    ground.receiveShadow = true; this.root.add(ground); this.surfaces.push(ground);
    this.ground = ground;
    const walls = solids.filter(s => s.kind === 'wall'),batch = new T.InstancedMesh(this.box,wall,walls.length);
    walls.forEach((s,index) => { const size = s.box.getSize(new T.Vector3()); this.dummy.position.copy(s.box.getCenter(new T.Vector3())); this.dummy.scale.copy(size); this.dummy.updateMatrix(); batch.setMatrixAt(index,this.dummy.matrix); });
    batch.castShadow = batch.receiveShadow = true; this.root.add(batch); this.surfaces.push(batch);
    this.wallBatch = batch;
    for (const s of solids.filter(s => s.kind !== 'wall')) {
      const mesh = new T.Mesh(this.box,s.kind === 'door' ? dark : cover); mesh.position.copy(s.box.getCenter(new T.Vector3())); mesh.scale.copy(s.box.getSize(new T.Vector3())); mesh.castShadow = mesh.receiveShadow = true;
      mesh.visible = s.enabled; this.root.add(mesh); this.surfaces.push(mesh); if (s.kind === 'door') this.doors.set(s.id,mesh);
      if (s.kind === 'cover') this.coverMeshes.set(s.id,mesh);
      if (s.kind === 'platform') this.platformMeshes.push(mesh);
    }
    // Modular light strips and door frames use shared geometry/materials, without point lights.
    for (const object of this.state.level.objects) {
      const root = new T.Group(); root.position.copy(point3(object.x,object.y)); this.devices.set(object.id,root); this.root.add(root);
      if (object.kind === 'door') { this.cube(root.position.x,3.05,root.position.z,(object.width ?? 64) * METRES,.07,.09,this.amber); continue; }
      const color = object.kind === 'vault' ? this.amber : this.cyan;
      const plate = new T.Mesh(this.box,color); plate.scale.set(object.kind === 'extraction' ? 2.2 : .7,.06,object.kind === 'extraction' ? 2.2 : .6); plate.position.y = .06; root.add(plate);
      if (object.kind === 'terminal' || object.kind === 'switch') {
        const housing=new T.Mesh(this.box,dark);housing.scale.set(.64,1.24,.43);housing.position.set(0,.67,0);housing.castShadow=housing.receiveShadow=true;root.add(housing);
        const screen = new T.Mesh(this.box,color); screen.scale.set(.43,.26,.025); screen.position.set(0,1.14,.225);screen.rotation.x=-.12;root.add(screen);
      } else if (object.kind === 'collectible') {
        const geometry = new T.BoxGeometry(.40,.19,.30); this.geometry.add(geometry); const core = new T.Mesh(geometry,dark);core.name='recovery-hard-case'; core.position.y = .18;core.castShadow=true; root.add(core);
      } else if (object.kind === 'vault') {
        const geometry = venue === 0 ? new T.TorusGeometry(1.12,.13,8,32) : venue === 1 ? new T.TorusGeometry(.98,.2,6,6) : new T.TorusGeometry(1.05,.13,4,4); this.geometry.add(geometry); const ring = new T.Mesh(geometry,this.amber); ring.position.y = 1.6; root.add(ring);
        for (const side of [-1,1]) this.cube(root.position.x + side * 1.22,1.6,root.position.z,.15,3.2,.3,cover);
      }
    }
  }
  attachAssets(assets: RaidAssets) {
    this.city = new CityEnvironment(assets.city,this.solids,assets.textures.get('city-grass')!,this.venue,this.seed);
    this.root.add(this.city.root); this.wallBatch.visible = false;
    this.ground.visible = false; this.platformMeshes.forEach(mesh => { mesh.visible = false; });
    // The supplied SciFi props now fit every unchanged cover footprint.
    this.coverMeshes.forEach(mesh => { mesh.visible = false; });
    const groups = new Map<T.Material,T.Mesh[]>();
    for (const mesh of this.staticCubes) { const material = mesh.material as T.Material; if (!groups.has(material)) groups.set(material,[]); groups.get(material)!.push(mesh); }
    for (const [material,meshes] of groups) { const batch = new T.InstancedMesh(this.box,material,meshes.length); meshes.forEach((mesh,i) => { mesh.updateMatrix(); batch.setMatrixAt(i,mesh.matrix); mesh.removeFromParent(); }); batch.computeBoundingSphere(); this.root.add(batch); }
    this.staticCubes = [];
  }
  setQuality(quality: QualityId) { this.city?.setQuality(quality); }
  updateEnvironment(time: number,pov: POV,reduced: boolean,player:T.Vector3,shots:number,actors:readonly {x:number;z:number}[],camera?:T.Camera) { this.city?.update(time,pov,reduced,player,shots,actors,camera); }
  private cube(x: number,y: number,z: number,w: number,h: number,d: number,material: T.Material) {
    const mesh = new T.Mesh(this.box,material); mesh.position.set(x,y,z); mesh.scale.set(w,h,d); this.root.add(mesh); this.staticCubes.push(mesh); return mesh;
  }
  sync(time: number) {
    for (const [id,mesh] of this.doors) mesh.visible = this.solids.find(s => s.id === id)?.enabled ?? false;
    for (const [id,root] of this.devices) {
      const object = this.state.level.objects.find(o => o.id === id)!;
      root.position.set(object.x*METRES,0,object.y*METRES);
      if (object.kind === 'collectible') { root.visible = !this.state.active.has(id); }
    }
  }
  dispose() { this.city?.dispose(); this.root.traverse(node => { if (node instanceof T.InstancedMesh) node.dispose(); }); this.geometry.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.root.clear(); this.devices.clear(); this.doors.clear(); }
}
