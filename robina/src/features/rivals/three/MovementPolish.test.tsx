import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {Vector3} from 'three';
import {PresentationCorrection,HeadingCorrection} from './PresentationCorrection';
import {CameraRig,POVS} from './CameraRig';
import {CombatAudio} from './CombatAudio';
import {CampaignStatus} from './CampaignStatus';
import {DrivingControls} from './SoldierHUD';
import {createAssignmentOperation} from './Operations';
import type {RaidRuntime,Diagnostics3D} from './RaidRuntime';

afterEach(cleanup);
describe('focused movement and HUD regressions',()=>{
  it.each([30,60,120])('never reverses forward progress during repeated small rewinds at %s FPS',fps=>{
    const correction=new PresentationCorrection(),body=new Vector3(),shown=new Vector3(),direction=new Vector3(1,0,0);
    correction.present(body,0,shown);
    for(let frame=1;frame<=fps*4;frame++){
      // Direction changes exercise both axes, not only a straight corridor.
      if(frame%fps===0)direction.applyAxisAngle(new Vector3(0,1,0),Math.PI/2);
      const before=shown.clone();
      if(frame%Math.max(1,Math.round(fps/10))===0){
        const old=body.clone();body.addScaledVector(direction,-.16);correction.correct(old,body);
      }
      body.addScaledVector(direction,2/fps);correction.present(body,1/fps,shown);
      expect(shown.clone().sub(before).dot(direction)).toBeGreaterThanOrEqual(-1e-7);
    }
    const physical=body.clone();for(let i=0;i<fps*2;i++)correction.present(body,1/fps,shown);
    expect(body.equals(physical)).toBe(true);expect(shown.distanceTo(body)).toBeLessThan(.0001);
    correction.correct(body,new Vector3(100,0,0),true);correction.present(new Vector3(100,0,0),1/fps,shown);
    expect(shown.x).toBe(100);
  });
  it('settles vehicle heading across north without a snap or long-way spin',()=>{
    const correction=new HeadingCorrection(),before=179*Math.PI/180,after=-179*Math.PI/180;
    correction.correct(before,after);
    const shown=correction.present(after,1/60);
    expect(Math.abs(Math.atan2(Math.sin(shown-before),Math.cos(shown-before)))).toBeLessThan(.01);
    let last=shown;for(let i=0;i<120;i++){const next=correction.present(after,1/60);expect(Math.abs(next-last)).toBeLessThan(.01);last=next;}
    expect(last).toBeCloseTo(after,6);correction.correct(before,after,true);expect(correction.present(after,0)).toBe(after);
  });
  it('plays a confirmed death vocal once, never for duplicate or restored state',()=>{
    const audio=new CombatAudio({muted:true} as ConstructorParameters<typeof CombatAudio>[0]);
    const death=vi.spyOn(audio,'death').mockImplementation(()=>{}),hurt=vi.spyOn(audio,'hurt').mockImplementation(()=>{});
    audio.enemyHealth(100,50,8,.2);audio.enemyHealth(50,0,8,.2);audio.enemyHealth(0,0);audio.enemyHealth(100,0,0,0,true);
    expect(hurt).toHaveBeenCalledTimes(1);expect(death).toHaveBeenCalledExactlyOnceWith(8,.2);audio.dispose();
  });
  it('removes the repeated mission title while retaining pursuit feedback',()=>{
    const operation=createAssignmentOperation(0,42);
    render(<CampaignStatus operation={operation} metrics={{pursuit:{level:2,active:true}} as Diagnostics3D}/>);
    expect(screen.queryByText(operation.mission.name)).toBeNull();expect(screen.getByLabelText('Police response level 2')).toBeTruthy();
  });
  it('keeps an accessible compact exit action instead of a large vehicle banner',()=>{
    const vehicleInteract=vi.fn();
    const runtime={vehicles:{snapshot:{speed:10,kind:'sedan',health:200}},vehicleInteract,setDriving:vi.fn()} as unknown as RaidRuntime;
    render(<DrivingControls runtime={runtime} disabled={false}/>);
    const button=screen.getByRole('button',{name:'Exit vehicle'});
    expect(button.textContent).toBe('');expect(button.querySelector('svg[aria-hidden=true]')).not.toBeNull();
    button.click();expect(vehicleInteract).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/KM\/H|POINT TO DRIVE/)).toBeNull();
  });
  it.each(POVS)('avoids redundant projection rebuilds while following in %s',pov=>{
    const rig=new CameraRig(),player=new Vector3();rig.setPOV(pov);rig.resize(640,360);
    for(let i=0;i<120;i++)rig.update(player,[],1/60);
    const perspective=vi.spyOn(rig.perspective,'updateProjectionMatrix'),orthographic=vi.spyOn(rig.orthographic,'updateProjectionMatrix');
    for(let i=0;i<60;i++){player.z+=.05;rig.update(player,[],1/60);}
    expect(perspective).not.toHaveBeenCalled();expect(orthographic).not.toHaveBeenCalled();
    const before=rig.camera.projectionMatrix.clone(),distance=rig.camera.position.distanceTo(player);rig.cycleZoom();for(let i=0;i<60;i++)rig.update(player,[],1/60);
    if(pov==='third')expect(Math.abs(rig.camera.position.distanceTo(player)-distance)).toBeGreaterThan(.1);
    else expect(rig.camera.projectionMatrix.equals(before)).toBe(false);
  });
});
