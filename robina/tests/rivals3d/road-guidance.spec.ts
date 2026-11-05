import {test,expect} from '@playwright/test';

test('red road arrows survive road rendering but remain occluded by real walls',async({page},info)=>{
  await page.route('**/tests/rivals3d/entry.tsx',route=>route.abort());
  await page.goto('/tests/rivals3d/index.html');
  const result=await page.evaluate(async()=>{
    const threePath='/node_modules/three/build/three.module.js',guidePath='/src/features/rivals/three/RoadGuide.ts';
    const T=await import(threePath),{RoadGuide}=await import(guidePath);
    const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,256);document.body.replaceChildren(renderer.domElement);
    const scene=new T.Scene();scene.background=new T.Color(0x555555);const camera=new T.PerspectiveCamera(50,1,.1,100);camera.position.set(0,10,10);camera.lookAt(0,0,0);
    const guide=new RoadGuide();scene.add(guide.root);guide.update(new T.Vector3(),[{x:0,y:-400}],{x:0,y:-400},0,true);
    const ground=new T.Mesh(new T.PlaneGeometry(50,50),new T.MeshStandardMaterial({color:0x555555}));ground.rotation.x=-Math.PI/2;scene.add(ground,new T.HemisphereLight(0xffffff,0x555555,2));
    const redPixels=()=>{const gl=renderer.getContext(),data=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,data);let count=0;for(let i=0;i<data.length;i+=4)if(data[i]>180&&data[i+1]<110&&data[i+2]<110)count++;return count;};
    renderer.render(scene,camera);const visible=redPixels();
    const wall=new T.Mesh(new T.BoxGeometry(30,12,1),new T.MeshBasicMaterial({color:0x555555}));wall.position.set(0,6,5);scene.add(wall);renderer.render(scene,camera);const occluded=redPixels();
    wall.visible=false;renderer.render(scene,camera);
    // The buffer remains available for the accompanying visual artifact.
    return {visible,occluded};
  });
  expect(result.visible).toBeGreaterThan(100);expect(result.occluded).toBe(0);
  await page.screenshot({path:info.outputPath('road-arrow-render.png')});
});
