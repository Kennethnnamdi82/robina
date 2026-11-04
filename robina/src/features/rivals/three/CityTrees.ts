import * as T from 'three';
export interface StreetTree {x:number;z:number;height?:number}
/** Crossed, tilted foliage cards preserve canopy volume from all four views.
 * A single shared photographic alpha texture replaces solid polygon crowns. */
export class CityTrees {
  readonly root=new T.Group();private geometries:T.BufferGeometry[]=[];private materials:T.Material[]=[];private shadow:T.Texture;
  private wind={value:0};
  constructor(trees:StreetTree[],foliage:T.Texture) {
    this.root.name='Oak avenue / layered foliage';
    const bark=new T.MeshStandardMaterial({color:0x675746,roughness:.96}),leaves=new T.MeshStandardMaterial({map:foliage,alphaTest:.44,side:T.DoubleSide,roughness:.95,color:0xc1c9ac});this.materials.push(bark,leaves);
    const trunkGeometry=new T.CylinderGeometry(.11,.22,3.5,7);trunkGeometry.translate(0,1.75,0);this.geometries.push(trunkGeometry);
    const card=new T.PlaneGeometry(1,1);this.geometries.push(card);const trunks=new T.InstancedMesh(trunkGeometry,bark,trees.length),canopy=new T.InstancedMesh(card,leaves,trees.length*12),dummy=new T.Object3D();
    for(const [index,tree]of trees.entries()) {
      const scale=(tree.height??6)/6;dummy.position.set(tree.x,.22,tree.z);dummy.rotation.set(0,index*.73,0);dummy.scale.set(scale,scale,scale);dummy.updateMatrix();trunks.setMatrixAt(index,dummy.matrix);
      for(let i=0;i<12;i++) {
        const angle=i*2.399;dummy.position.set(tree.x+Math.sin(angle)*.55*scale,(3.5+Math.floor(i/4)*.70)*scale,tree.z+Math.cos(angle)*.55*scale);dummy.rotation.set((i%3-1)*.72,angle,(i%2-.5)*.22);dummy.scale.set(3.2*scale,2.5*scale,1);dummy.updateMatrix();canopy.setMatrixAt(index*12+i,dummy.matrix);
        canopy.setColorAt(index*12+i,new T.Color().setScalar(.85+(i%4)*.05));
      }
    }
    leaves.customProgramCacheKey=()=>'rivals-oak-cards';leaves.onBeforeCompile=shader=>{shader.uniforms.uOakWind=this.wind;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uOakWind;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(uOakWind*1.25+instanceMatrix[3].x*.31+instanceMatrix[3].z*.41)*max(0.,position.y+.5)*.035;');};
    trunks.castShadow=canopy.castShadow=true;trunks.receiveShadow=canopy.receiveShadow=true;trunks.computeBoundingSphere();canopy.computeBoundingSphere();this.root.add(trunks,canopy);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d')!,gradient=c.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(10,17,13,.55)');gradient.addColorStop(.5,'rgba(10,17,13,.3)');gradient.addColorStop(1,'rgba(10,17,13,0)');c.fillStyle=gradient;c.fillRect(0,0,64,64);
    this.shadow=new T.CanvasTexture(canvas);const shadowMaterial=new T.MeshBasicMaterial({map:this.shadow,transparent:true,depthWrite:false,opacity:.62,polygonOffset:true,polygonOffsetFactor:-1});this.materials.push(shadowMaterial);const shadowGeometry=new T.PlaneGeometry(5,5);this.geometries.push(shadowGeometry);const shadows=new T.InstancedMesh(shadowGeometry,shadowMaterial,trees.length);
    trees.forEach((tree,i)=>{dummy.position.set(tree.x+.6,.071,tree.z+.4);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar((tree.height??6)/6);dummy.updateMatrix();shadows.setMatrixAt(i,dummy.matrix);});shadows.computeBoundingSphere();this.root.add(shadows);
  }
  update(time:number){this.wind.value=time;}
  dispose(){this.root.children.forEach(n=>{if(n instanceof T.InstancedMesh)n.dispose();});this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.shadow.dispose();this.root.clear();}
}
