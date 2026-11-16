import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import type {QualityId} from '../core/presentation';
/** High uses HDR, ground-truth ambient occlusion and restrained bloom on both
 * Android and web. Lower presets keep the same art with a single scene pass. */
export class CityPostProcess {
 private composer?:EffectComposer;private scenePass?:RenderPass;private ao?:GTAOPass;
 private qualityId:QualityId='balanced';private width=1;private height=1;private dpr=1;
 private limited=false;
 get budgetLimited(){return this.limited;}
 /** Optional full-screen effects yield to input responsiveness under sustained
  * overload. Keep the composer allocated so recovery cannot recompile shaders. */
 budget(ratio:number){if(!Number.isFinite(ratio))return;if(ratio<.8)this.limited=true;else if(ratio>.95)this.limited=false;}
 constructor(private renderer:T.WebGLRenderer,private scene:T.Scene,_camera:T.Camera){}
 quality(quality:QualityId){this.qualityId=quality;if(quality!=='high')this.releaseComposer();}
 resize(width:number,height:number,dpr:number){this.width=width;this.height=height;this.dpr=dpr;this.composer?.setPixelRatio(dpr);this.composer?.setSize(width,height);}
 render(camera:T.Camera,_time:number){
  if(this.qualityId!=='high'||this.limited){this.renderer.render(this.scene,camera);return;}
  if(!this.composer){
   const hdr=this.renderer.extensions.has('EXT_color_buffer_float');
   const target=new T.WebGLRenderTarget(1,1,{type:hdr?T.HalfFloatType:T.UnsignedByteType});target.samples=Math.min(2,this.renderer.capabilities.maxSamples);this.composer=new EffectComposer(this.renderer,target);
   this.scenePass=new RenderPass(this.scene,camera);const bloom=new UnrealBloomPass(new T.Vector2(256,128),.11,.35,1.4);
   const resize=bloom.setSize.bind(bloom);bloom.setSize=(w,h)=>resize(Math.max(1,w/2),Math.max(1,h/2));
   this.ao=new GTAOPass(this.scene,camera,512,256);this.ao.blendIntensity=.5;this.ao.updateGtaoMaterial({radius:.7,distanceExponent:1.5,thickness:1.1});
   const output=new OutputPass();
   // Grade in the existing output pass, after tone mapping and before sRGB.
   // No extra screen pass or texture allocation on phones.
   output.material.fragmentShader=output.material.fragmentShader.replace('// color space',`float luma=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
     gl_FragColor.rgb=clamp(mix(vec3(luma),gl_FragColor.rgb,1.035)*1.015-.004,0.,1.);
     // color space`);
   this.composer.addPass(this.scenePass);this.composer.addPass(this.ao);this.composer.addPass(bloom);this.composer.addPass(output);this.resize(this.width,this.height,this.dpr);
  }
  this.scenePass!.camera=camera;this.ao!.camera=camera;this.composer.render();
 }
 private releaseComposer(){if(this.composer){this.composer.passes.forEach(p=>p.dispose());this.composer.dispose();this.composer=undefined;this.scenePass=undefined;this.ao=undefined;}}
 dispose(){this.releaseComposer();}
}
