// Isolated visual QA fixture. Not imported by production; no live-session
// transport or production bypass. Uses the actual RaidRuntime, not a mockup.
if(import.meta.env.DEV&&import.meta.env.VITE_RIVALS_3D_SANDBOX==='true'){
 document.querySelector('#start')!.addEventListener('click',async()=>{
  const [{RaidRuntime},{SandboxSession},{createAssignmentOperation}]=await Promise.all([import('../../src/features/rivals/three/RaidRuntime'),import('../../src/features/rivals/three/SandboxSession'),import('../../src/features/rivals/three/Operations')]);
  const quality=new URL(location.href).searchParams.get('quality')==='high'?'high':'balanced';
  const session=new SandboxSession({quality,settings:{muted:true} as never},createAssignmentOperation(0,42));
  session.block(true);
  let latest:unknown;
  const runtime=new RaidRuntime(document.querySelector('#world') as HTMLElement,session,data=>{latest=data;document.querySelector('#state')!.textContent=`${data.quality} / ${data.calls} calls / ${Math.round(data.triangles/1000)}k triangles`;});
  const internal=runtime as unknown as {body:{position:import('three').Vector3};previousPosition:import('three').Vector3;needsDraw:boolean;controller:{aimAngle:number};humanoidFrame:{aiming:boolean};setEnvironmentLighting:(preset:string)=>void};
  const fixture={
   get status(){const state=session.getSnapshot();if(state.status==='error')throw Error(state.error);return state.status;},get diagnostics(){return latest;},
   pose(scene:'street'|'bank'|'player'|'cars'|'night',pov:'third'|'first'|'side'|'tactical'='third'){
    const poses={street:[8,8,-2.35],bank:[44,29,0],player:[8,14,.6],cars:[33,14,0],night:[8,8,-2.35]} as const;
    const [x,z,yaw]=poses[scene];internal.body.position.set(x,0,z);internal.previousPosition.copy(internal.body.position);internal.controller.aimAngle=-yaw-Math.PI/2;
    runtime.setPOV(pov);runtime.rig.yaw=yaw;runtime.rig.pitch=-.08;runtime.rig.setZoom(1);internal.setEnvironmentLighting(scene==='night'?'night':'daylight');internal.needsDraw=true;
   },dispose(){runtime.dispose();session.dispose();},
  };
  Object.assign(window,{__realismAudit:fixture});document.querySelector('#start')!.remove();
 });
}else document.body.textContent='Development graphics fixture disabled';
