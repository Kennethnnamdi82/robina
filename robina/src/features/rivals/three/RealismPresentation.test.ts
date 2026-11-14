import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {applyRealismSurface,finishShowcaseMaterial,worldSurface,type SurfaceMaps} from './RealismMaterials';
import {CameraRig} from './CameraRig';
import {facadeAtHeight} from './ShowcaseArchitecture';

const maps=():SurfaceMaps=>({color:new T.Texture(),normal:new T.Texture(),roughness:new T.Texture()});
describe('realism material and camera contracts',()=>{
 it('assembles real storeys within the required height instead of crushing the whole building',()=>{
  const source=new T.Group(),material=new T.MeshStandardMaterial(),mesh=new T.Mesh(new T.BoxGeometry(10,20,10),material);mesh.position.y=10;mesh.updateMatrix();mesh.geometry.applyMatrix4(mesh.matrix);mesh.position.set(0,0,0);source.add(mesh);
  for(const height of [5,9,24,43]){const model=facadeAtHeight(source,height),bounds=new T.Box3().setFromObject(model);expect(bounds.min.y).toBeCloseTo(0);expect(bounds.max.y).toBeCloseTo(height);expect(model.children.length).toBe(1);for(const child of model.children){const geometry=(child as T.Mesh).geometry;expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);geometry.dispose();}}
  expect(mesh.geometry.boundingBox!.max.y).toBe(20);
 });
 it('supplies normals for the flat-shaded GLBs in the actual showcase pack',()=>{
  const source=new T.Group(),geometry=new T.BoxGeometry(10,20,10);geometry.translate(0,10,0);geometry.deleteAttribute('normal');source.add(new T.Mesh(geometry,new T.MeshStandardMaterial()));
  const result=facadeAtHeight(source,12);result.traverse(n=>{if(n instanceof T.Mesh){expect(n.geometry.getAttribute('normal').count).toBe(n.geometry.getAttribute('position').count);n.geometry.dispose();}});
 });
 it('keeps metre-scaled surface copies independently disposable and never darkens albedo twice',()=>{
  const source=maps(),owned=new Set<T.Texture>(),material=new T.MeshStandardMaterial({color:0x333333});applyRealismSurface(material,source,62.5,owned,.3);
  expect(material.color.getHex()).toBe(0xffffff);expect(material.map).not.toBe(source.color);expect(material.map!.repeat.x).toBe(62.5);expect(source.color.repeat.x).toBe(1);expect(owned.size).toBe(3);expect(material.bumpMap).toBeNull();expect(material.normalScale.x).toBe(.3);
 });
 it('retains separate masonry, glass and metal responses',()=>{
  const surface=maps(),library=new Map([['brick' as const,surface]]),brick=new T.MeshStandardMaterial(),glass=new T.MeshStandardMaterial(),metal=new T.MeshStandardMaterial();brick.name='brick';glass.name='glass_tint';metal.name='steel';
  for(const m of [brick,glass,metal])finishShowcaseMaterial(m,library);expect(brick.map).toBe(surface.color);expect(brick.normalMap).toBe(surface.normal);expect(glass.roughness).toBeLessThan(.2);expect(metal.metalness).toBeGreaterThan(.7);
 });
 it('projects material UVs in world metres rather than stretching each wall cube',()=>{
  const material=new T.MeshStandardMaterial();worldSurface(material,maps(),2.5);const shader={vertexShader:'#include <uv_vertex>',fragmentShader:'',uniforms:{}};material.onBeforeCompile(shader as never,{} as T.WebGLRenderer);expect(shader.vertexShader).toContain('instanceMatrix*surfacePosition');expect(shader.vertexShader).toContain('vMapUv=surfaceUv/2.500');
 });
 it('uses closer shoulder framing while retaining all four existing views and safe ground clearance',()=>{
  const rig=new CameraRig();rig.resize(1280,800);rig.setPOV('third');rig.update(new T.Vector3(8,0,8),[],0,true);expect(rig.camera.position.distanceTo(new T.Vector3(8,1.05,8))).toBeLessThan(3.5);expect(rig.perspective.fov).toBe(57);
  for(const pov of ['first','third','side','tactical'] as const){rig.setPOV(pov);rig.update(new T.Vector3(8,0,8),[],1/60,true);expect(rig.camera.position.toArray().every(Number.isFinite)).toBe(true);expect(rig.camera.position.y).toBeGreaterThan(.4);}
 });
});
