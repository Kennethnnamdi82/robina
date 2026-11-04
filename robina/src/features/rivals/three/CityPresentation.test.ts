import {describe,it,expect,vi} from 'vitest';
import * as T from 'three';
import { cityArchitecture } from './CityArchitecture';
import { securityGaits } from './SecurityLocomotion';
import { CameraRig } from './CameraRig';
import { crowdGeometry } from './CityHumanGeometry';
import { CityAtmosphere } from './CityAtmosphere';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

describe('stable city presentation',()=>{
 it('does not mistake the distant orthographic eye for street-level fog distance',()=>{
  const load=vi.spyOn(T.TextureLoader.prototype,'load').mockReturnValue(new T.Texture()),hdr=vi.spyOn(RGBELoader.prototype,'load').mockReturnValue(new T.DataTexture());
  try{const scene=new T.Scene(),atmosphere=new CityAtmosphere(scene,{} as T.WebGLRenderer,'golden');for(const pov of ['side','tactical'] as const){atmosphere.follow(new T.Vector3(8,0,8),pov);expect((scene.fog as T.FogExp2).density).toBe(0);}atmosphere.follow(new T.Vector3(),'third');expect((scene.fog as T.FogExp2).density).toBe(.0055);atmosphere.set('night');atmosphere.follow(new T.Vector3(),'first');expect((scene.fog as T.FogExp2).density).toBe(.01);atmosphere.dispose();}finally{load.mockRestore();hdr.mockRestore();}
 });
 it('reduces crowd geometry while preserving normalized skin weights and the immutable source',()=>{
  const source=new T.SphereGeometry(.3,48,32),count=source.getAttribute('position').count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
  for(let i=0;i<count;i++){indices[i*4+1]=1;weights[i*4]=.7;weights[i*4+1]=.3;}source.setAttribute('skinIndex',new T.BufferAttribute(indices,4));source.setAttribute('skinWeight',new T.BufferAttribute(weights,4));
  const before=Array.from(source.getAttribute('position').array),result=crowdGeometry(source,new T.Vector3(1,1,1));expect(result.index!.count).toBeLessThan(source.index!.count);expect(Array.from(source.getAttribute('position').array)).toEqual(before);
  const skin=result.getAttribute('skinWeight');for(let i=0;i<skin.count;i++)expect(skin.getX(i)+skin.getY(i)+skin.getZ(i)+skin.getW(i)).toBeCloseTo(1,5);
 });
 it('builds complete closed photographic architecture with valid atlas UVs',()=>{
  const atlas=new T.Texture(),models=cityArchitecture(atlas);expect(atlas.flipY).toBe(false);expect(models.size).toBe(3);
  for(const root of models.values()){
   const size=new T.Box3().setFromObject(root).getSize(new T.Vector3());expect(size.x).toBeGreaterThan(11);expect(size.z).toBeGreaterThan(11);expect(size.y).toBeGreaterThan(18);
   expect(root.children.length).toBeLessThanOrEqual(5);
   root.traverse(n=>{if(n instanceof T.Mesh){const uv=n.geometry.getAttribute('uv');expect(Array.from(uv.array as ArrayLike<number>).every(v=>Number.isFinite(v)&&v>=0&&v<=1)).toBe(true);}});
  }
 });
 it('keeps the side near plane outside the whole district while passing foreground cover',()=>{
  const rig=new CameraRig();rig.setPOV('side');rig.resize(1100,700);
  const solid={id:'foreground',kind:'wall' as const,enabled:true,box:new T.Box3(new T.Vector3(10,0,14),new T.Vector3(25,22,25))};
  for(let x=2;x<90;x+=.5){const player=new T.Vector3(x,0,10);rig.update(player,[solid],1/60,true);expect(rig.camera.position.z-player.z).toBeCloseTo(120);expect(rig.camera.position.y).toBeCloseTo(49.4);expect(rig.camera.position.z).toBeGreaterThan(96);expect(rig.orthographic.right).toBeCloseTo(8.8);}
 });
 it('retargets bending knees without changing source rigs or horizontal root position',()=>{
  const human=new T.Group(),target=new T.Group(),pelvis=new T.Bone(),hip=new T.Group();pelvis.name='pelvis';pelvis.position.y=1;human.add(pelvis);hip.name='Pelvis';hip.position.y=1.2;target.add(hip);
  for(const side of ['l','r']){const thigh=new T.Bone(),calf=new T.Bone(),leg=new T.Group(),knee=new T.Group();thigh.name='thigh_'+side;calf.name='calf_'+side;calf.position.y=-.45;pelvis.add(thigh);thigh.add(calf);leg.name='Leg_'+side.toUpperCase();knee.name='Knee_'+side.toUpperCase();knee.position.y=-.55;hip.add(leg);leg.add(knee);}
  const bend=(a:number)=>new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),a).toArray();
  const animations=['Idle_Loop','Walk_Loop','Jog_Fwd_Loop'].map((name,i)=>new T.AnimationClip(name,1,[new T.QuaternionKeyframeTrack('calf_l.quaternion',[0,.5,1],[...bend(0),...bend(.2+i*.4),...bend(0)]),new T.QuaternionKeyframeTrack('calf_r.quaternion',[0,.5,1],[...bend(.2+i*.4),...bend(0),...bend(.2+i*.4)])]));
  const before=JSON.stringify([human.toJSON(),target.toJSON()]),clips=securityGaits({scene:human,animations},target);expect(clips.map(c=>c.name)).toEqual(['Human_Idle','Human_Walk','Human_Run']);expect(JSON.stringify([human.toJSON(),target.toJSON()])).toBe(before);
  const rig=target.clone(true),mixer=new T.AnimationMixer(rig);mixer.clipAction(clips[2]).play();mixer.setTime(.5);expect(rig.getObjectByName('Knee_L')!.quaternion.angleTo(new T.Quaternion())).toBeGreaterThan(.9);
  const positions=clips[2].tracks.find(t=>t.name==='Pelvis.position')!;for(let i=0;i<positions.values.length;i+=3){expect(positions.values[i]).toBe(0);expect(positions.values[i+2]).toBe(0);}expect(clips.every(c=>c.tracks.every(t=>Array.from(t.values).every(Number.isFinite)))).toBe(true);
 });
});
