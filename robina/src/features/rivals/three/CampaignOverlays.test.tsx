import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {CampaignOverlays,MissionRewardReceipt} from './CampaignOverlays';
import {SandboxSession} from './SandboxSession';
import {createAssignmentOperation} from './Operations';
import {createPlayerEconomy} from '../progression/PlayerEconomy';
import type {Diagnostics3D,RaidRuntime} from './RaidRuntime';
afterEach(cleanup);
const fixture=()=>new SandboxSession({},createAssignmentOperation(0,43),createPlayerEconomy(null));
describe('campaign choices and receipts',()=>{
  it('offers no free revive and ends the run through the runtime',()=>{
    const session=fixture(),declineRevive=vi.fn();session.revivePending=true;
    render(<CampaignOverlays session={session} runtime={{declineRevive} as unknown as RaidRuntime} guideOpen={false} onCloseGuide={()=>{}}/>);
    expect(screen.getByRole('button',{name:/SPEND.*REVIVE/})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'END THIS RUN'}));expect(declineRevive).toHaveBeenCalledOnce();
  });
  it('spends achievement coins through the revive flow, not mission cash',()=>{
    const session=fixture(),revive=vi.fn(()=>true);session.economy.award('previous',3);session.revivePending=true;
    render(<CampaignOverlays session={session} runtime={{revive} as unknown as RaidRuntime} guideOpen={false} onCloseGuide={()=>{}}/>);
    fireEvent.click(screen.getByRole('button',{name:/SPEND.*REVIVE/}));expect(revive).toHaveBeenCalledOnce();
  });
  it('requires explicit handover and shows the exact contract share',()=>{
    const session=fixture(),confirmHandoff=vi.fn(()=>true),metrics={campaign:{handoff:'waiting'}} as Diagnostics3D;
    render(<CampaignOverlays session={session} runtime={{confirmHandoff} as unknown as RaidRuntime} metrics={metrics} guideOpen={false} onCloseGuide={()=>{}}/>);
    expect(screen.getByText('$20,000')).toBeInTheDocument();expect(Object.keys(session.economy.getSnapshot().rewards)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:/HAND OVER THE BAG/}));expect(confirmHandoff).toHaveBeenCalledOnce();
  });
  it('offers only the current venue menu and disables orders without cash',()=>{
    const session=fixture(),metrics={social:{venue:'restaurant'}} as Diagnostics3D;
    render(<CampaignOverlays session={session} runtime={{} as RaidRuntime} metrics={metrics} guideOpen={false} onCloseGuide={()=>{}}/>);
    expect(screen.getByText('ESPRESSO')).toBeInTheDocument();expect(screen.queryByText('HOUSE RED')).not.toBeInTheDocument();
    for(const button of screen.getAllByRole('button',{name:/ORDER/}))expect(button).toBeDisabled();
  });
  it('routes a city detour and resumes the same mission',()=>{
    const session=fixture(),routeToVenue=vi.fn(),onCloseGuide=vi.fn(),resume=vi.spyOn(session,'resume');
    render(<CampaignOverlays session={session} runtime={{routeToVenue} as unknown as RaidRuntime} guideOpen onCloseGuide={onCloseGuide}/>);
    fireEvent.click(screen.getAllByRole('button',{name:/SET GPS DETOUR/})[0]);expect(routeToVenue).toHaveBeenCalledWith('bar');expect(onCloseGuide).toHaveBeenCalledOnce();expect(resume).toHaveBeenCalledOnce();
  });
  it('shows only a real run receipt and labels cash and achievement coins separately',()=>{
    const session=fixture(),view=render(<MissionRewardReceipt session={session}/>);expect(screen.queryByRole('status')).not.toBeInTheDocument();
    session.economy.award(session.mission.runId,0);view.rerender(<MissionRewardReceipt session={session}/>);
    expect(screen.getByText('THE BOSS PAID YOUR SHARE')).toBeInTheDocument();expect(screen.getByText('ACHIEVEMENT COINS')).toBeInTheDocument();
  });
});
