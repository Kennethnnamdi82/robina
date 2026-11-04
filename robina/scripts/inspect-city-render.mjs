import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
await fs.mkdir('docs/rivals-3d/city-revision',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:900,height:600}});page.on('console',m=>console.log(m.text()));page.on('pageerror',e=>console.log(e.message));
await page.goto('http://127.0.0.1:8084/tests/rivals3d/index.html');
const stats=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{CityAssets}=await import('/src/features/rivals/three/CityAssets.ts');
 const assets=new CityAssets();await assets.load();document.body.innerHTML='';
 const scene=new T.Scene();scene.background=new T.Color(0x8dabc1);scene.add(new T.HemisphereLight(0xd7eaff,0x6a655a,2));const sun=new T.DirectionalLight(0xffefdc,2.5);sun.position.set(3,6,10);scene.add(sun);
 const root=assets.models.get('commerce');root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());root.scale.setScalar(18/size.y);scene.add(root);root.position.y=-box.min.y*root.scale.x;
 const camera=new T.PerspectiveCamera(50,1.5,.1,200);camera.position.set(24,10,30);camera.lookAt(0,8,0);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,600);document.body.append(renderer.domElement);renderer.render(scene,camera);
 window.preview={scene,camera,renderer};
 return root.children.map(n=>({name:n.name,attributes:Object.keys(n.geometry.attributes),material:n.material.name,map:n.material.map?.image?.width}));
});console.log(JSON.stringify(stats));await page.screenshot({path:'docs/rivals-3d/city-revision/building-preview.png'});
}finally{await browser.close();}
