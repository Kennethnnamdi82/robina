// Isolated visual QA fixture. Not imported by production; no live-session
// transport or production bypass. Uses the actual RaidRuntime, not a mockup.
if(import.meta.env.DEV&&import.meta.env.VITE_RIVALS_3D_SANDBOX==='true'){
 document.querySelector('#start')!.addEventListener('click',async()=>{
  const [{RaidRuntime},{SandboxSession},{createAssignmentOperation}]=await Promise.all([import('../../src/features/rivals/three/RaidRuntime'),import('../../src/features/rivals/three/SandboxSession'),import('../../src/features/rivals/three/Operations')]);
  const requestedQuality=new URL(location.href).searchParams.get('quality');
  const quality=requestedQuality==='high'?'high':requestedQuality==='low'?'low':'balanced';
  const session=new SandboxSession({quality,settings:{muted:true} as never},createAssignmentOperation(0,42));
  session.block(true);
  let latest:unknown;
  const runtime=new RaidRuntime(document.querySelector('#world') as HTMLElement,session,data=>{latest=data;document.querySelector('#state')!.textContent=`${data.quality} / ${data.calls} calls / ${Math.round(data.triangles/1000)}k triangles`;});
  const internal=runtime as unknown as {body:{position:import('three').Vector3};previousPosition:import('three').Vector3;needsDraw:boolean;controller:{aimAngle:number};humanoidFrame:{aiming:boolean};setEnvironmentLighting:(preset:string)=>void;vehicles:import('../../src/features/rivals/three/VehicleController').VehicleController;solids:import('../../src/features/rivals/three/world3d').Solid3D[];cameraMotion:import('../../src/features/rivals/three/SmartCameraFollow').CameraMotion};
  const fixture={
   get status(){const state=session.getSnapshot();if(state.status==='error')throw Error(state.error);return state.status;},get diagnostics(){return latest;},
   pose(scene:'street'|'bank'|'player'|'cars'|'night',pov:'third'|'first'|'side'|'tactical'='third'){
    const poses={street:[8,8,-2.35],bank:[44,29,0],player:[8,14,.6],cars:[33,14,0],night:[8,8,-2.35]} as const;
    const [x,z,yaw]=poses[scene];internal.body.position.set(x,0,z);internal.previousPosition.copy(internal.body.position);internal.controller.aimAngle=-yaw-Math.PI/2;
    runtime.setPOV(pov);runtime.rig.yaw=yaw;runtime.rig.pitch=-.08;runtime.rig.setZoom(1);internal.setEnvironmentLighting(scene==='night'?'night':'daylight');internal.needsDraw=true;
   },
   camera:{
    get state(){const car=internal.vehicles.current;return{pov:runtime.rig.pov,yaw:runtime.rig.yaw,pitch:runtime.rig.pitch,fov:runtime.rig.perspective.fov,position:runtime.rig.camera.position.toArray(),zoom:runtime.rig.zoom[runtime.rig.pov],settling:runtime.rig.settling,driving:Boolean(car),speed:car?.speed??0,status:session.getSnapshot().status,blocked:session.blocked,elapsed:session.mission.snapshot().elapsed,motion:{...internal.cameraMotion}};},
    walk(x:number,y:number){session.block(false);session.input.setMovement(x,y);},
    aim(x:number,y:number){session.input.setAim(x,y);},
    orbit(x:number,y:number){runtime.rig.rotate(x,y);internal.needsDraw=true;},
    freeze(){session.input.setMovement(0,0);session.input.setAim(0,0);runtime.setDriving({throttle:0,steer:0,brake:true,stickX:0,stickY:0});session.block(true);},
    pov(value:'third'|'first'|'side'|'tactical'){runtime.setPOV(value);},
    enterVehicle(){
     session.block(false);session.input.setMovement(0,0);session.input.setAim(0,0);
     const car=internal.vehicles.cars.find(car=>car.mode==='parked'&&(car.health??0)>0);if(!car)throw Error('No parked fixture vehicle');
     internal.body.position.set(car.x+car.dz*1.65,0,car.z-car.dx*1.65);internal.previousPosition.copy(internal.body.position);
     internal.vehicles.scan(internal.body.position,28);runtime.vehicleInteract();
     if(!internal.vehicles.current)throw Error('Fixture vehicle entry failed: '+internal.vehicles.message);
    },
    drive(throttle:number,steer=0,brake=false){runtime.setDriving({throttle,steer,brake,stickX:0,stickY:0});},
    exitVehicle(){runtime.vehicleInteract();},
   },dispose(){runtime.dispose();session.dispose();},
  };
  Object.assign(window,{__realismAudit:fixture});document.querySelector('#start')!.remove();
 });
}else document.body.textContent='Development graphics fixture disabled';
