import * as T from 'three';
import {cityRandom,STREET_CENTRES} from './LivingCityPlan';
/** Surface history, not obstacles: two shared repair/tyre-wear decal draws. */
export class CityRoadDetail {
 readonly root=new T.Group();private geometry=new T.PlaneGeometry(1,1);private textures:T.Texture[]=[];private materials:T.Material[]=[];
 constructor(seed:number){
  const random=cityRandom(seed^0x54bf),dummy=new T.Object3D();
  for(const skid of [false,true]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!,pixels=c.createImageData(128,128);
   for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const u=(x-64)/64,v=(y-64)/64,edge=Math.max(0,1-u*u)*Math.max(0,1-v*v),noise=.55+random()*.45;
    const track=skid?(Math.exp(-(((u-.42-Math.sin(v*2)*.12)/.085)**2))+Math.exp(-(((u+.42-Math.sin(v*2)*.12)/.085)**2))):Math.min(1,edge*2);
    const i=(y*128+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=Math.min(255,track*edge*noise*255);pixels.data[i+3]=255;
   }
   c.putImageData(pixels,0,0);const texture=new T.CanvasTexture(canvas);this.textures.push(texture);
   const material=new T.MeshBasicMaterial({color:skid?0x141818:0x252a29,alphaMap:texture,transparent:true,opacity:skid?.28:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});this.materials.push(material);
   const count=skid?16:32,mesh=new T.InstancedMesh(this.geometry,material,count);
   for(let i=0;i<count;i++){
    const axis=i%2,street=STREET_CENTRES[i%STREET_CENTRES.length],along=15+Math.floor(i/4)%3*24+random()*8,lane=(i%3-1)*2.4;
    dummy.position.set(axis?street+lane:along,-.003,axis?along:street+lane);dummy.rotation.set(-Math.PI/2,0,axis?0:Math.PI/2);dummy.scale.set(skid?1.5:.9+random()*1.5,skid?4+random()*3:1.8+random()*2,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   }
   mesh.computeBoundingSphere();this.root.add(mesh);
  }
 }
 dispose(){this.root.children.forEach(n=>{if(n instanceof T.InstancedMesh)n.dispose();});this.geometry.dispose();this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.root.clear();}
}
