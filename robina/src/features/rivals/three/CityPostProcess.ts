import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import type {QualityId} from '../core/presentation';
/** Low/Medium use ACES, native AA and one scene pass. Only High opts into HDR
 * bloom. No redundant half-float MSAA resolve on the default mobile path. */
export class CityPostProcess {
 private composer?:EffectComposer;private scenePass?:RenderPass;
 private qualityId:QualityId='balanced';private width=1;private height=1;private dpr=1;
 constructor(private renderer:T.WebGLRenderer,private scene:T.Scene,_camera:T.Camera){}
 quality(quality:QualityId){this.qualityId=quality;if(quality!=='high')this.releaseComposer();}
 resize(width:number,height:number,dpr:number){this.width=width;this.height=height;this.dpr=dpr;this.composer?.setPixelRatio(dpr);this.composer?.setSize(width,height);}
 render(camera:T.Camera,_time:number){
  // Mobile High retains the same authored PBR/detail/shadows, but uses native
  // framebuffer AA instead of a full-resolution HDR + multi-pass bloom chain.
  if(this.qualityId!=='high'||navigator.maxTouchPoints>0){this.renderer.render(this.scene,camera);return;}
  if(!this.composer){
   const hdr=this.renderer.extensions.has('EXT_color_buffer_float');
   const mobile=navigator.maxTouchPoints>0;
   const target=new T.WebGLRenderTarget(1,1,{type:hdr?T.HalfFloatType:T.UnsignedByteType});target.samples=mobile?0:Math.min(2,this.renderer.capabilities.maxSamples);this.composer=new EffectComposer(this.renderer,target);
   this.scenePass=new RenderPass(this.scene,camera);const bloom=new UnrealBloomPass(new T.Vector2(256,128),.12,.35,1.5);
   const resize=bloom.setSize.bind(bloom);bloom.setSize=(w,h)=>resize(Math.max(1,w/(mobile?4:2)),Math.max(1,h/(mobile?4:2)));
   const output=new OutputPass();
   // Grade in the existing output pass, after tone mapping and before sRGB.
   // No extra screen pass or texture allocation on phones.
   output.material.fragmentShader=output.material.fragmentShader.replace('// color space',`float luma=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
     gl_FragColor.rgb=clamp(mix(vec3(luma),gl_FragColor.rgb,1.08)*1.045-.012,0.,1.);
     // color space`);
   this.composer.addPass(this.scenePass);this.composer.addPass(bloom);this.composer.addPass(output);this.resize(this.width,this.height,this.dpr);
  }
  this.scenePass!.camera=camera;this.composer.render();
 }
 private releaseComposer(){if(this.composer){this.composer.passes.forEach(p=>p.dispose());this.composer.dispose();this.composer=undefined;this.scenePass=undefined;}}
 dispose(){this.releaseComposer();}
}
