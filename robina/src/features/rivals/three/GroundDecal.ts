import {Color,ShaderMaterial} from 'three';
/** Feathered, irregular residue instead of opaque, perfectly round discs. */
export function groundDecal(color:number,seed:number){
  return new ShaderMaterial({uniforms:{tint:{value:new Color(color)},fade:{value:0},seed:{value:seed}},transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform vec3 tint;uniform float fade;uniform float seed;
      void main(){vec2 p=vUv-.5;float a=atan(p.y,p.x);float edge=.44+sin(a*7.+seed)*.035+sin(a*13.-seed)*.02;
        float grain=.72+.28*sin(p.x*87.+seed)*sin(p.y*73.-seed);float alpha=(1.-smoothstep(edge-.13,edge,length(p)))*grain*fade;
        gl_FragColor=vec4(tint,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
}
