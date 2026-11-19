import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {MissionRewardReceipt} from './CampaignOverlays';
import {SandboxSession} from './SandboxSession';
import {createAssignmentOperation} from './Operations';
import {LocalMission} from '@/services/localMission';
import type {MissionPermit} from '../authority/MissionReplay';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('shows earned points and the mission achievement immediately without claiming server confirmation or minting spendable rewards',()=>{
  const network=vi.spyOn(globalThis,'fetch'),session=new SandboxSession({},createAssignmentOperation(0,42));
  const permit:MissionPermit={id:'0123456789abcdef01234567',missionId:'assignment-reserve',seed:42,issuedAt:Date.now(),simulationVersion:3,maxTicks:432000,token:'test',initial:{grenades:5,ownedIds:[],weapon:null,appearance:{outfit:null,finish:null,emote:null,effect:null,identity:null}}};
  const client=new LocalMission(permit,'owner');session.authority=client;
  // This is a presentation fixture; backend replay tests independently establish real success.
  client.localSimulation.mission.step(49);for(const objective of client.localSimulation.mission.definition.objectives)client.localSimulation.mission.event(objective.event);
  expect(client.localSimulation.mission.state).toBe('SUCCESS');
  const view=render(<MissionRewardReceipt session={session}/>);
  expect(screen.getByText('MISSION ACHIEVED')).toBeTruthy();expect(screen.getByText(/6,000/)).toBeTruthy();expect(screen.getByText(/Achievement:/)).toBeTruthy();expect(screen.getByText(/awaiting server confirmation/)).toBeTruthy();expect(screen.queryByText('MISSION VERIFIED')).toBeNull();
  expect(network).not.toHaveBeenCalled();expect(session.economy.getSnapshot().coins).toBe(0);
  client.result={_id:'verified',outcome:'success',score:6000,durationSeconds:49,firstCompletion:true,rewardEligible:true,verifiedAt:new Date().toISOString()};view.rerender(<MissionRewardReceipt session={session}/>);
  expect(screen.getByText('MISSION VERIFIED')).toBeTruthy();expect(screen.queryByText('MISSION ACHIEVED')).toBeNull();expect(screen.getByText(/6,000/)).toBeTruthy();session.dispose();
});
