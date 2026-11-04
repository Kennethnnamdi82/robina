import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const out='docs/rivals-3d/art-direction';await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:1200,height:700}});page.on('pageerror',e=>console.log(e.message));await page.goto('http://127.0.0.1:8084/tests/rivals3d/index.html');
console.log(await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');document.body.innerHTML='';
 const scene=new T.Scene();scene.background=new T.Color(0x9aadb5);scene.add(new T.HemisphereLight(0xb5cbd5,0x3b3831,.6));const sun=new T.DirectionalLight(0xffdab0,3.7);sun.position.set(-20,35,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-40,right:40,top:35,bottom:-35,near:1,far:100});scene.add(sun);
 const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0x737878,roughness:.8}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const stats=[];for(const [i,id]of ['residence','commerce','headquarters'].entries()){
  const g=await new GLTFLoader().loadAsync('/assets/rivals/city/models/'+id+'.glb');const box=new T.Box3().setFromObject(g.scene),size=box.getSize(new T.Vector3());g.scene.scale.setScalar(12/Math.max(size.x,size.z));g.scene.position.set((i-1)*18,-box.min.y*g.scene.scale.y,0);g.scene.rotation.y=Math.PI/4;g.scene.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material]){if(/glass/i.test(m.name)){m.transparent=false;m.opacity=1;m.color.set(0x45616c);m.roughness=.24;m.metalness=.35;}if(/FakeInterior/i.test(m.name)){m.emissive.copy(m.color);m.emissiveMap=m.map;m.emissiveIntensity=.1;}}}});scene.add(g.scene);stats.push({id,size:size.toArray()});
 }
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,700);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);const camera=new T.PerspectiveCamera(48,1200/700,.1,200);camera.position.set(22,13,46);camera.lookAt(0,6,0);renderer.render(scene,camera);return stats;
}));await page.screenshot({path:out+'/authored-buildings.png'});
}finally{await browser.close();}
