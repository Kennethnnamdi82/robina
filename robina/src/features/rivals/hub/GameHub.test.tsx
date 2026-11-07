import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addRecord, emptyDossier, readDossier, readPreferences, saveDossier } from './model';
import { MissionEngine } from '../missions/MissionEngine';
import { launchMission } from '../missions/definitions';
const auth=vi.hoisted(()=>({baseUser:{wallet:'local-test-player'},signOut:vi.fn()}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('./PlayPage',()=>({default:()=> <h1>3D deployment</h1>}));
import GameHub from './GameHub';
function at(path='/'){return render(<MemoryRouter initialEntries={[path]}><GameHub/></MemoryRouter>);}
beforeEach(()=>{localStorage.clear();auth.baseUser.wallet='local-test-player';vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('frontend-only game hub',()=>{
  it('matches the requested navigation and keeps graphics controls out of the lobby',()=>{
    const network=vi.spyOn(globalThis,'fetch');at();
    expect(screen.getByRole('link',{name:'PLAY'})).toBeTruthy();
    for(const name of ['MISSIONS','CHARACTER CUSTOMIZATION','PLAYER PROFILE','LEADERBOARDS','RANK','SETTINGS'])expect(screen.getByRole('link',{name:new RegExp('^'+name)})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'LOW graphics'})).toBeNull();expect(screen.queryByText('BaseDrop')).toBeNull();expect(network).not.toHaveBeenCalled();
  });
  it('opens settings as a real page, saves quality and exposes audio and input settings there',()=>{
    at();fireEvent.click(screen.getByRole('link',{name:'SETTINGS'}));
    expect(screen.getByRole('heading',{name:'SETTINGS'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'LOW graphics'}));expect(readPreferences().quality).toBe('low');
    fireEvent.click(screen.getByRole('tab',{name:'Audio'}));fireEvent.change(screen.getByRole('slider',{name:'Music volume'}),{target:{value:'.2'}});expect(readPreferences().musicVolume).toBe(.2);
    fireEvent.click(screen.getByRole('tab',{name:'Controls'}));fireEvent.change(screen.getByLabelText('Default camera'),{target:{value:'first'}});expect(readPreferences().pov).toBe('first');
  });
  it('opens each dedicated menu page',()=>{
    const view=at('/missions');expect(screen.getByRole('heading',{name:'OPERATIONS'})).toBeTruthy();expect(screen.getAllByRole('link',{name:'VIEW BRIEFING'})).toHaveLength(7);expect(screen.queryAllByRole('link',{name:'REVIEW UNLOCK REQUIREMENT'})).toHaveLength(0);
    fireEvent.click(screen.getByRole('link',{name:'PLAYER PROFILE'}));expect(screen.getByRole('heading',{name:'PLAYER DOSSIER'})).toBeTruthy();
    fireEvent.click(screen.getByRole('link',{name:'RANK'}));expect(screen.getByRole('heading',{name:'EARN YOUR NAME'})).toBeTruthy();view.unmount();
  });
  it('labels fictional leaderboard fixtures clearly and keeps them out of personal records',()=>{
    const network=vi.spyOn(globalThis,'fetch');at('/leaderboards');
    expect(screen.getByText('EXHIBITION BOARD')).toBeTruthy();expect(screen.getByText(/Exhibition players/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'MY RECORDED RUNS'}));expect(screen.getByText('NO FINISHED HEISTS YET')).toBeTruthy();expect(screen.queryByText('NIGHTFALL')).toBeNull();expect(readDossier('local-test-player').records).toEqual([]);expect(network).not.toHaveBeenCalled();
  });
  it('persists callsign and calling card cosmetics without altering the player model',()=>{
    at('/customization');fireEvent.change(screen.getByLabelText('Callsign'),{target:{value:'night runner'}});fireEvent.click(screen.getByRole('button',{name:'ice calling card'}));fireEvent.click(screen.getByRole('button',{name:'SAVE IDENTITY'}));
    expect(readDossier('local-test-player')).toMatchObject({callsign:'NIGHT RUNNER',emblem:'ice'});expect(screen.getByText('Dossier updated')).toBeTruthy();
  });
  it('shows real completed missions and their objective/time breakdown',()=>{
    const engine=new MissionEngine(launchMission(),'real-local-run');engine.prepare();engine.start();engine.step(190);for(const objective of engine.definition.objectives)engine.event(objective.event);
    saveDossier('local-test-player',addRecord(emptyDossier(),engine.snapshot(),0));at('/missions');
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0);expect(screen.getAllByText('03:10').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button',{name:/THE RESERVE.*COMPLETED/}));expect(screen.getByText('Open the central vault')).toBeTruthy();
  });
  it('does not fetch or mount the 3D runtime before Play is selected',async()=>{
    at();expect(screen.queryByText('3D deployment')).toBeNull();fireEvent.click(screen.getByRole('link',{name:'PLAY'}));expect(await screen.findByText('3D deployment')).toBeTruthy();
  });
  it('opens the lazy store and inventory without mounting the game or changing the dossier',async()=>{
    const network=vi.spyOn(globalThis,'fetch');at();
    fireEvent.click(screen.getByRole('link',{name:'STORE'}));
    expect(await screen.findByRole('heading',{name:'THE EXCHANGE'}, {timeout:10000})).toBeTruthy();
    fireEvent.click(screen.getByRole('link',{name:'My inventory'}));
    expect(screen.getByText('YOUR COLLECTION IS EMPTY')).toBeTruthy();
    expect(screen.queryByText('3D deployment')).toBeNull();expect(readDossier('local-test-player').records).toEqual([]);expect(network).not.toHaveBeenCalled();
  });
});
