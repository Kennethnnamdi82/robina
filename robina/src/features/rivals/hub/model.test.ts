import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MissionEngine } from '../missions/MissionEngine';
import { launchMission } from '../missions/definitions';
import { addRecord, cleanPreferences, dossierStats, emptyDossier, readDossier, readPreferences, runScore, saveDossier, savePreferences, type Dossier } from './model';

export function completedMission(id='run-one',seconds=180) {
  const engine=new MissionEngine(launchMission(),id);engine.prepare();engine.start();engine.step(seconds);engine.sample(100,65,8);
  for(const objective of engine.definition.objectives)engine.event(objective.event);
  return engine.snapshot();
}
beforeEach(()=>{localStorage.clear();vi.restoreAllMocks();});
describe('browser-only heist dossier',()=>{
  it('records actual completed objectives, mission venue, time and combat stats once',()=>{
    const mission=completedMission(),dossier=addRecord(emptyDossier(),mission,0);
    expect(dossier.records).toHaveLength(1);expect(dossier.records[0]).toMatchObject({venue:0,state:'SUCCESS',seconds:180,completed:10,hits:65,shots:100});
    expect(dossier.records[0].objectives).toContain('Open the central vault');
    expect(addRecord(dossier,mission,0)).toBe(dossier);
    expect(dossierStats(dossier)).toMatchObject({wins:1,best:180,hits:65,shots:100,score:1620});
  });
  it('does not record unstarted cleanup or loading-screen abandonment',()=>{
    const engine=new MissionEngine(launchMission(),'not-started');engine.prepare();engine.abandon();
    expect(addRecord(emptyDossier(),engine.snapshot(),0).records).toEqual([]);
  });
  it('retains melee-only results without misrepresenting melee hits as firearm accuracy',()=>{
    const result=completedMission();result.stats.shots=0;result.stats.hits=80;
    const dossier=addRecord(emptyDossier(),result,0);
    expect(dossier.records).toHaveLength(1);expect(dossierStats(dossier)).toMatchObject({shots:0,hits:80,wins:1});
  });
  it('records a failed run without granting completion points or rank progress',()=>{
    const engine=new MissionEngine(launchMission(),'failed');engine.prepare();engine.start();engine.step(45);engine.event('compound-entered');engine.fail('Operative defeated');
    const dossier=addRecord(emptyDossier(),engine.snapshot(),1);
    expect(dossier.records[0].state).toBe('FAILED');expect(runScore(dossier.records[0])).toBe(0);expect(dossierStats(dossier)).toMatchObject({wins:0,score:0,best:null});
  });
  it('isolates local data by the current signed-in identity',()=>{
    const dossier={...addRecord(emptyDossier(),completedMission(),2),callsign:'ALPHA'};
    expect(saveDossier('player-a',dossier)).toBe(true);expect(readDossier('player-a')).toEqual(dossier);expect(readDossier('player-b')).toEqual(emptyDossier());
  });
  it('ignores malformed storage, invalid records and unsupported data versions',()=>{
    localStorage.setItem('rivals_heist_dossier_v1:player','bad JSON');expect(readDossier('player')).toEqual(emptyDossier());
    saveDossier('player',{...emptyDossier(),records:[{...addRecord(emptyDossier(),completedMission(),0).records[0],seconds:-1}]} as Dossier);
    expect(readDossier('player').records).toEqual([]);
  });
  it('calculates promotion from actual local completion scores',()=>{
    const dossier=addRecord(emptyDossier(),completedMission(),0),stats=dossierStats(dossier);
    expect(stats.rank.name).toBe('RUNNER');expect(stats.next?.name).toBe('ENFORCER');
  });
  it('degrades gracefully when browser storage is unavailable',()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('Denied');});
    expect(saveDossier('player',emptyDossier())).toBe(false);expect(savePreferences(readPreferences())).toBe(false);
  });
});
describe('frontend settings',()=>{
  it('saves all supported options and restores them without an API',()=>{
    const prefs={...readPreferences(),quality:'low' as const,pov:'first' as const,sensitivity:1.7,lighting:'night' as const,musicVolume:.12,monitor:true};
    expect(savePreferences(prefs)).toBe(true);expect(readPreferences()).toEqual(prefs);
    expect(localStorage.getItem('rivals_3d_graphics_v1')).toBe('low');
  });
  it('clamps unsafe ranges and rejects invalid enum values',()=>{
    expect(cleanPreferences({sensitivity:100,quality:'ultra',pov:'orbital',lighting:'moon',masterVolume:-20})).toMatchObject({sensitivity:2,pov:'third',lighting:'mission',masterVolume:0});
  });
});
