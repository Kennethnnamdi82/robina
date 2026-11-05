import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SandboxSession } from './SandboxSession';
import { preloadRaidAssets } from './RaidAssets';
import { defaultHubPreferences } from '../hub/model';

const runtime = vi.hoisted(() => ({ created: 0, disposed: 0, session: undefined as SandboxSession | undefined, pov: '' }));
vi.mock('./RaidAssets', () => ({ preloadRaidAssets: vi.fn() }));
vi.mock('./RaidRuntime', () => ({ RaidRuntime: class {
  rig={sensitivity:1};
  constructor(_host: HTMLElement, private session: SandboxSession) {
    runtime.created++; runtime.session=session; session.update({ status: 'playing' });
  }
  setPOV(pov:string){runtime.pov=pov;}
  dispose() { runtime.disposed++; this.session.dispose(); }
} }));
import RaidApp from './RaidApp';

afterEach(async () => { cleanup(); await act(async () => {}); vi.restoreAllMocks(); runtime.created = runtime.disposed = 0; });
describe('production 3D entry lifecycle', () => {
  it('starts without a development flag and keeps normal route links', () => {
    render(<RaidApp />);
    expect(screen.getByRole('button', { name: 'ENTER 3D RAID' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'RETURN TO BASE' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'PLAY CLASSIC 2D' }).getAttribute('href')).toBe('/gaming?engine=2d');
    expect(screen.queryByText(/sandbox disabled/i)).toBeNull();
  });
  it('survives StrictMode and releases the runtime only on actual unmount', async () => {
    vi.spyOn(SandboxSession.prototype, 'startAudio').mockImplementation(() => {});
    const view = render(<StrictMode><RaidApp /></StrictMode>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'ENTER 3D RAID' })); });
    expect(runtime.created).toBe(1); expect(runtime.disposed).toBe(0);
    expect(screen.getByLabelText('RIVALS 3D raid')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Graphics settings' })).toBeNull();
    await act(async () => { view.unmount(); });
    expect(runtime.disposed).toBe(1);
  });
  it('finishes production downloads before starting the unchanged runtime deadline', async () => {
    vi.spyOn(SandboxSession.prototype, 'startAudio').mockImplementation(() => {});
    let release!: () => void;
    vi.mocked(preloadRaidAssets).mockReturnValueOnce(new Promise<void>(resolve => { release = resolve; }));
    render(<RaidApp />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'ENTER 3D RAID' })); });
    expect(runtime.created).toBe(0);
    expect(screen.getByRole('progressbar', { name: 'Mission loading progress' }).getAttribute('aria-valuenow')).toBe('10');
    await act(async () => { release(); });
    expect(runtime.created).toBe(1);
    expect(screen.getByLabelText('RIVALS 3D raid')).toBeTruthy();
  });
  it('uses the frontend briefing and reports actual completed runs once',async()=>{
    vi.spyOn(SandboxSession.prototype,'startAudio').mockImplementation(()=>{});
    const onResult=vi.fn();
    render(<RaidApp onResult={onResult} preferences={{...defaultHubPreferences(),quality:'low',pov:'first'}} renderWelcome={({enter})=><button onClick={enter}>DEPLOY HEIST</button>}/>);
    expect(screen.queryByRole('button',{name:'LOW graphics'})).toBeNull();
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'DEPLOY HEIST'}));});
    expect(runtime.pov).toBe('first');expect(runtime.session?.getSnapshot().quality).toBe('low');
    await act(async()=>{const session=runtime.session!;session.mission.start();session.mission.step(180);for(const objective of session.mission.definition.objectives)session.mission.event(objective.event);session.publishMission();session.publishMission();});
    expect(onResult).toHaveBeenCalledTimes(1);expect(onResult.mock.calls[0][0]).toMatchObject({state:'SUCCESS',elapsed:180,completed:10});
  });
  it('opens the dedicated settings view without unmounting the paused runtime',async()=>{
    vi.spyOn(SandboxSession.prototype,'startAudio').mockImplementation(()=>{});
    render(<RaidApp preferences={defaultHubPreferences()} renderSettings={back=><button onClick={back}>BACK TO RAID</button>}/>);
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'ENTER 3D RAID'}));});
    await act(async()=>{runtime.session!.pause();});
    expect(screen.queryByLabelText('3D graphics quality')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'SETTINGS'}));expect(screen.getByRole('dialog',{name:'Raid settings'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'BACK TO RAID'}));expect(screen.getByRole('button',{name:'RESUME RAID'})).toBeTruthy();expect(runtime.created).toBe(1);expect(runtime.disposed).toBe(0);
  });
});
