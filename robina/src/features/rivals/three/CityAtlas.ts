import * as T from 'three';

/** Material atlasing without flattening façades or losing repeated brick UVs.
 * Tile coordinates are constant over each triangle; the original UV still
 * repeats inside its padded tile. Camera distance never changes the geometry. */
export function installCityAtlas(root:T.Object3D) {
 const seen=new Set<T.Material>();
 root.traverse(node=>{
  if(!(node instanceof T.Mesh))return;
  const tile=node.geometry.getAttribute('_citytile');if(tile)node.geometry.setAttribute('cityTile',tile);
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   if(seen.has(material)||!material.userData.cityAtlas)continue;seen.add(material);
   const {grid,tile:tileSize,gutter}=material.userData.cityAtlas;
   material.customProgramCacheKey=()=>`city-pbr-atlas-${grid}-${tileSize}-${gutter}`;
   material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 cityTile;varying vec2 vCityTile;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCityTile=cityTile;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec2 vCityTile;vec2 cityAtlasUv(vec2 uv){return (vCityTile+${gutter/tileSize}+fract(uv)*${1-2*gutter/tileSize})/${grid.toFixed(1)};}`);
    for(const chunk of ['map_fragment','normal_fragment_maps','roughnessmap_fragment','metalnessmap_fragment','aomap_fragment','emissivemap_fragment'] as const){
     const source=T.ShaderChunk[chunk].replace(/texture2D\( (\w+), (v\w+Uv) \)/g,'texture2D( $1, cityAtlasUv($2) )');
     shader.fragmentShader=shader.fragmentShader.replace(`#include <${chunk}>`,source);
    }
   };
  }
 });
}
