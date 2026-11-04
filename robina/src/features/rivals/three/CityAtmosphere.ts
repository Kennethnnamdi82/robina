import * as T from 'three';
import type { CityWeather } from './LivingCityPlan';
import type { POV } from './CameraRig';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import type { QualityId } from '../core/presentation';
export const CITY_LIGHTING = {
  golden: { sky:0xa39b91, sun:0xffd0a0, power:3.7, fill:0xbacddd, ambient:1.6, ground:0x777469, exposure:1.12, night:0, elevation:.27 },
  daylight: { sky:0xa8c8d8, sun:0xfff0d5, power:3.1, fill:0xc9e4ff, ambient:.85, ground:0x596159, exposure:1.03, night:0, elevation:.65 },
  night: { sky:0x263447, sun:0x99b5dc, power:.48, fill:0x879bc2, ambient:.85, ground:0x555c6c, exposure:1.2, night:1, elevation:.35 },
} as const;
/** A finite, softly graded sky, rendered behind the city without an 85MB HDR.
 * Street lamps use emissive lenses; only the sun casts a shadow map. */
export class CityAtmosphere {
  readonly root=new T.Group();private sky:T.Mesh;private material:T.ShaderMaterial;private sun:T.DirectionalLight;private hemi:T.HemisphereLight;private fill:T.DirectionalLight;
  preset:CityWeather='golden';
  private skyTexture:T.Texture;
  private reflection?:T.WebGLRenderTarget;private released=false;
  constructor(private scene:T.Scene,private renderer:T.WebGLRenderer,preset:CityWeather) {
    this.material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,depthTest:false,uniforms:{uNight:{value:0},uElevation:{value:.19},uDay:{value:0},uSky:{value:null},uReady:{value:0}},vertexShader:`varying vec3 vSky; void main(){vSky=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,fragmentShader:`
      varying vec3 vSky;uniform float uNight;uniform float uDay;uniform float uReady;uniform sampler2D uSky;
      void main(){vec3 d=normalize(vSky);float h=max(0.,d.y);
        vec2 uv=vec2(atan(d.z,d.x)*.15915494+.5,asin(clamp(h,0.,1.))*.63661977);
        vec3 photo=texture2D(uSky,uv).rgb;
        vec3 dusk=mix(vec3(.75,.37,.12),vec3(.08,.14,.22),pow(h,.55));
        vec3 color=mix(dusk,photo,uReady);
        vec3 day=mix(vec3(.62,.76,.86),vec3(.12,.35,.65),pow(h,.55));color=mix(color,day,uDay*.82);
        vec3 night=mix(vec3(.055,.085,.14),vec3(.008,.017,.043),pow(h,.5));color=mix(color,night,uNight);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    this.skyTexture=new T.TextureLoader().load('/assets/rivals/city/sunset-sky.webp',texture=>{if(this.released){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;texture.wrapS=T.RepeatWrapping;this.material.uniforms.uReady.value=1;});this.skyTexture.colorSpace=T.SRGBColorSpace;this.material.uniforms.uSky.value=this.skyTexture;
    new RGBELoader().load('/assets/rivals/city/premium/evening-reflections.hdr',texture=>{if(this.released){texture.dispose();return;}const generator=new T.PMREMGenerator(renderer);try{this.reflection=generator.fromEquirectangular(texture);scene.environment=this.reflection.texture;}finally{generator.dispose();texture.dispose();}});
    this.sky=new T.Mesh(new T.SphereGeometry(220,24,16),this.material);this.sky.position.set(42,0,42);this.sky.frustumCulled=false;this.sky.renderOrder=-100;this.root.add(this.sky);
    this.hemi=new T.HemisphereLight();this.fill=new T.DirectionalLight(0x94b6d5,.18);this.fill.position.set(30,18,70);
    this.sun=new T.DirectionalLight();this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-25;this.sun.shadow.camera.right=25;this.sun.shadow.camera.top=25;this.sun.shadow.camera.bottom=-25;this.sun.shadow.camera.far=130;this.sun.shadow.normalBias=.04;this.sun.shadow.bias=-.00015;this.sun.shadow.radius=2;
    this.root.add(this.sun,this.sun.target,this.hemi,this.fill);scene.add(this.root);this.set(preset);
  }
  set(preset:CityWeather) {
    this.preset=preset;const p=CITY_LIGHTING[preset];this.scene.background=new T.Color(p.sky);this.scene.fog=new T.FogExp2(p.sky,preset==='night'?.010:.0055);
    this.hemi.color.set(p.fill);this.hemi.groundColor.set(p.ground);this.hemi.intensity=p.ambient;this.sun.color.set(p.sun);this.sun.intensity=p.power;this.fill.intensity=preset==='night'?.32:.8;
    this.renderer.toneMappingExposure=p.exposure;this.material.uniforms.uNight.value=p.night;this.material.uniforms.uDay.value=preset==='daylight'?1:0;this.material.uniforms.uElevation.value=p.elevation;
    this.scene.environmentIntensity=preset==='night'?.26:preset==='daylight'?.8:1;
  }
  quality(quality:QualityId){const size=quality==='high'?2048:quality==='balanced'?768:512;if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(size,size);}this.sun.shadow.normalBias=.025;}
  follow(player:T.Vector3,pov:POV='third') {
    // An orthographic eye is deliberately outside the district. Its distance
    // is not the viewer's distance to the street; using it for exponential fog
    // washed out the entire playfield. Perspective retains physical depth fog.
    if(this.scene.fog instanceof T.FogExp2)this.scene.fog.density=pov==='side'||pov==='tactical'?0:this.preset==='night'?.010:.0055;
    const elevation=CITY_LIGHTING[this.preset].elevation,x=Math.round(player.x*2)/2,z=Math.round(player.z*2)/2;this.sun.target.position.set(x,0,z);this.sun.position.set(x-55,Math.max(22,elevation*90),z-42);
  }
  dispose(){this.released=true;if(this.scene.environment===this.reflection?.texture)this.scene.environment=null;this.reflection?.dispose();this.skyTexture.dispose();this.sky.geometry.dispose();this.material.dispose();this.sun.shadow.map?.dispose();this.root.removeFromParent();}
}
