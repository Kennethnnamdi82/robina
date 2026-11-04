import * as T from 'three';
/** Crowd-only vertex clustering. Preserve UV seams and exact bone-index sets;
 * average skin weights inside each tiny cell, never change the player's mesh.
 * A fixed mesh is used at every distance, not a silhouette-swapping LOD. */
export function crowdGeometry(source:T.BufferGeometry,worldScale:T.Vector3){
 const p=source.getAttribute('position');if(p.count<600)return source.clone();
 const uv=source.getAttribute('uv'),normal=source.getAttribute('normal'),bones=source.getAttribute('skinIndex'),weights=source.getAttribute('skinWeight');
 const groups=new Map<string,number>(),vertices:{count:number;p:T.Vector3;n:T.Vector3;uv:T.Vector2;bone:number[];weight:number[]}[]=[],remap:number[]=[];
 const point=new T.Vector3(),n=new T.Vector3();
 for(let i=0;i<p.count;i++){
  point.fromBufferAttribute(p,i);n.fromBufferAttribute(normal,i);const indices=[bones.getX(i),bones.getY(i),bones.getZ(i),bones.getW(i)],w=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
  const key=[Math.round(point.x*worldScale.x/.045),Math.round(point.y*worldScale.y/.045),Math.round(point.z*worldScale.z/.045),Math.round(n.x*2),Math.round(n.y*2),Math.round(n.z*2),Math.floor(uv.getX(i)*16),Math.floor(uv.getY(i)*16),...indices].join(',');
  let index=groups.get(key);if(index===undefined){index=vertices.length;groups.set(key,index);vertices.push({count:0,p:new T.Vector3(),n:new T.Vector3(),uv:new T.Vector2(),bone:indices,weight:[0,0,0,0]});}
  const v=vertices[index];v.count++;v.p.add(point);v.n.add(n);v.uv.x+=uv.getX(i);v.uv.y+=uv.getY(i);for(let j=0;j<4;j++)v.weight[j]+=w[j];remap.push(index);
 }
 const position:number[]=[],normals:number[]=[],uvs:number[]=[],skinIndex:number[]=[],skinWeight:number[]=[],triangles:number[]=[];
 for(const v of vertices){position.push(...v.p.divideScalar(v.count).toArray());normals.push(...v.n.normalize().toArray());uvs.push(v.uv.x/v.count,v.uv.y/v.count);skinIndex.push(...v.bone);const sum=v.weight.reduce((a,b)=>a+b,0)||1;skinWeight.push(...v.weight.map(w=>w/sum));}
 const count=source.index?.count??p.count;for(let i=0;i<count;i+=3){const a=remap[source.index?.getX(i)??i],b=remap[source.index?.getX(i+1)??i+1],c=remap[source.index?.getX(i+2)??i+2];if(a!==b&&b!==c&&a!==c)triangles.push(a,b,c);}
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(position,3));result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));result.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));result.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));result.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));result.setIndex(triangles);return result;
}
