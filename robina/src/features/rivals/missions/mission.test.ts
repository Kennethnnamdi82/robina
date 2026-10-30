import { describe, expect, it } from 'vitest';
import { MissionEngine } from './MissionEngine';
import { launchMission } from './definitions';
import { loadPractice, PRACTICE_KEY, recordPractice } from './progression';
import { WorldState } from '../world/WorldState';

const running = (id = 'run-1') => { const mission = new MissionEngine(launchMission(), id); mission.prepare(); mission.start(); return mission; };
const complete = (m: MissionEngine) => ['compound-entered', 'sector-console', 'vault-sector-entered', 'timed-access', 'relay-a', 'relay-b', 'guardian-defeated', 'vault', 'training-core', 'extraction'].forEach(e => m.event(e));
const storage = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string,v: string) => { map.set(k,v); } }; };
describe('mission orchestration', () => {
  it('checks configured mission unlock prerequisites before preparation', () => {
    const d = launchMission(); d.prerequisites = ['prior-clear']; const m = new MissionEngine(d,'gated');
    expect(m.prepare()).toBe(false); expect(m.state).toBe('NOT_STARTED'); expect(m.prepare(new Set(['prior-clear']))).toBe(true);
  });
  it('validates transitions and seals the first terminal result', () => {
    const m = new MissionEngine(launchMission(),'1');
    expect(m.start()).toBe(false); expect(m.transition('SUCCESS')).toBe(false);
    m.prepare(); m.start(); expect(m.transition('SUCCESS')).toBe(false);
    complete(m); expect(m.state).toBe('SUCCESS');
    expect(m.fail('late death')).toBe(false); expect(m.abandon()).toBe(false); expect(m.event('extraction')).toBe(false);
    expect(m.snapshot().completed).toBe(10);
  });
  it('tracks prerequisites, allows valid latched facts, and rejects early extraction', () => {
    const m = running(); expect(m.event('extraction')).toBe(false); expect(m.event('unknown')).toBe(false);
    m.event('relay-b'); expect(m.completed.has('relay-b')).toBe(false);
    m.event('sector-console'); expect(m.completed.has('breach')).toBe(false);
    m.event('compound-entered'); expect(m.completed.has('breach')).toBe(true);
    m.event('vault-sector-entered'); expect(m.completed.has('relay-b')).toBe(true);
    expect(m.completed.has('extract')).toBe(false);
    expect(m.snapshot().objectives.find(o => o.id === 'guardian')?.state).toBe('LOCKED');
    complete(m); expect(m.state).toBe('SUCCESS');
  });
  it('has no default deadline; timed missions warn, freeze when paused, and expire once', () => {
    const beginner = running(); beginner.step(1000); expect(beginner.state).toBe('ACTIVE'); expect(beginner.snapshot().remaining).toBeNull();
    const m = new MissionEngine(launchMission('timed'),'2','timed'); m.prepare(); m.start();
    m.step(420); expect(m.snapshot().warning).toBe(60);
    m.step(90,true); expect(m.snapshot().remaining).toBe(60);
    m.step(30); expect(m.warning).toBe(30); m.step(20); expect(m.warning).toBe(10);
    m.step(10); expect(m.state).toBe('FAILED'); complete(m); expect(m.state).toBe('FAILED'); expect(m.reason).toContain('timer');
  });
  it('starts configurable objective deadlines only when their prerequisites become active', () => {
    const d = launchMission(); d.objectives = d.objectives.map(o => o.id === 'breach' ? { ...o, seconds: 5 } : o);
    const m = new MissionEngine(d,'3'); m.prepare(); m.start(); m.step(10); expect(m.state).toBe('ACTIVE');
    m.event('compound-entered'); m.step(4); expect(m.state).toBe('ACTIVE'); m.step(1); expect(m.reason).toContain('Objective timer');
  });
  it('records verified local counters, optional completion and non-economic XP', () => {
    const m = running(); m.damage(16); m.damage(NaN); m.sample(30,20,2); m.event('insertion-uplink'); m.step(75); complete(m);
    expect(m.snapshot()).toMatchObject({ elapsed: 75, practiceXP: 125, stats: { damageTaken: 16, shots: 30,hits: 20,enemiesDefeated: 2,bossDefeated: true } });
    m.step(20); m.damage(20); expect(m.snapshot().elapsed).toBe(75); expect(m.snapshot().stats.damageTaken).toBe(16);
  });
  it('rejects cyclic or missing objective dependencies', () => {
    const d = launchMission(); d.objectives = d.objectives.map(o => o.id === 'infiltrate' ? { ...o, prerequisites: ['core'] } : o);
    expect(() => new MissionEngine(d,'x')).toThrow('cycle');
    d.success = ['missing']; expect(() => new MissionEngine(d,'x')).toThrow('references');
  });
  it('cannot physically bypass the Guardian by interacting with a fully authorized vault', () => {
    const w = new WorldState(); ['sector-console','relay-a','relay-b','timed-access'].forEach(id => w.grantFlag(id));
    const vault = w.level.objects.find(o => o.id === 'vault')!;
    expect(w.missing(vault)).toEqual(['guardian-defeated']); expect(w.interact(vault,{ x: 1536,y: 272 })).toBeNull();
    w.grantFlag('guardian-defeated'); expect(w.interact(vault,{ x: 1536,y: 272 })).not.toBeNull();
    expect(w.interact(w.level.objects.find(o => o.id === 'extraction')!,{ x: 288,y: 1152 })).toBeNull();
  });
  it('keeps the sector gate locked during the encounter and restores ordinary interaction afterward', () => {
    const w = new WorldState(), gate = w.level.objects.find(o => o.id === 'vault-gate')!;
    w.grantFlag('sector-console'); const barrier = { id: 'guardian-lockdown',x: 1088,y: 480,width: 128,height: 64,enabled: true }; w.blockers.push(barrier);
    expect(w.description(gate)).toContain('LOCKDOWN'); expect(w.interact(gate,{ x: 1088,y: 400 })).toBeNull();
    barrier.enabled = false; expect(w.interact(gate,{ x: 1088,y: 400 })).not.toBeNull();
  });
});
describe('isolated practice progression', () => {
  it('persists once per run, updates best times separately by mode and preserves unrelated keys', () => {
    const s = storage(); s.setItem('basedrop_balance','123'); const m = running(); m.step(80); complete(m);
    expect(recordPractice(m.snapshot(),s).added).toBe(true); expect(recordPractice(m.snapshot(),s).added).toBe(false);
    const faster = running('faster'); faster.step(60); complete(faster); recordPractice(faster.snapshot(),s);
    const timed = new MissionEngine(launchMission('timed'),'timed','timed'); timed.prepare(); timed.start(); timed.step(70); complete(timed); recordPractice(timed.snapshot(),s);
    expect(loadPractice(s)).toMatchObject({ completions: 3,practiceXP: 300,best: { 'the-launch:standard': 60,'the-launch:timed': 70 },unlocks: ['guardian-cleared'] });
    expect(s.getItem('basedrop_balance')).toBe('123'); expect(loadPractice(s).receipts).toHaveLength(3);
  });
  it('records defeat and abandonment without XP or completion awards', () => {
    const s = storage(), m = running(); m.fail('Operative defeated.'); recordPractice(m.snapshot(),s);
    const abandoned = running('abandoned'); abandoned.abandon(); recordPractice(abandoned.snapshot(),s);
    expect(loadPractice(s)).toMatchObject({ practiceXP: 0,completions: 0 }); expect(loadPractice(s).history).toHaveLength(2);
  });
  it('handles malformed or denied storage without breaking gameplay', () => {
    const s = storage(); s.setItem(PRACTICE_KEY,'{'); expect(loadPractice(s).completions).toBe(0);
    s.setItem(PRACTICE_KEY,JSON.stringify({ version: 1,practiceXP: -1 })); expect(loadPractice(s).practiceXP).toBe(0);
    const m = running(); complete(m);
    const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(recordPractice(m.snapshot(),denied).saved).toBe(false);
  });
});
