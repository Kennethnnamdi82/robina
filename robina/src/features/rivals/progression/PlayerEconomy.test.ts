import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createPlayerEconomy,economyKey,missionReward,reviveCost} from './PlayerEconomy';
beforeEach(()=>localStorage.clear());
describe('fictional campaign economy',()=>{
  it('awards each completed run once, persists per profile and never calls financial APIs',()=>{
    const fetch=vi.spyOn(globalThis,'fetch'),store=createPlayerEconomy('one');
    expect(store.award('first',0)).toMatchObject({cash:20000,coins:1500});store.award('first',0);
    expect(store.getSnapshot().cash).toBe(20000);expect(createPlayerEconomy('one').getSnapshot().coins).toBe(1500);
    expect(createPlayerEconomy('two').getSnapshot().cash).toBe(0);expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();
  });
  it('separates cash-only social purchases from coin-only revives and prevents duplicate spending',()=>{
    const store=createPlayerEconomy('spend');store.award('heist',6);
    const before=store.getSnapshot();expect(store.purchase('dinner','meal-1').heal).toBe(35);
    expect(store.getSnapshot().cash).toBe(before.cash-900);expect(store.getSnapshot().coins).toBe(before.coins);
    expect(()=>store.purchase('dinner','meal-1')).toThrow('already');
    expect(store.revive('down-1',6)).toBe(true);expect(store.revive('down-1',6)).toBe(false);
    expect(store.getSnapshot().coins).toBe(5000);expect(store.getSnapshot().cash).toBe(before.cash-900);
    expect(store.getSnapshot().earnedCoins).toBe(10000);
  });
  it('rejects insufficient funds and invalid contracts without making a balance negative',()=>{
    const store=createPlayerEconomy(null);expect(()=>store.purchase('wine','order')).toThrow('Not enough');
    expect(store.revive('down',0)).toBe(false);expect(()=>store.award('bad',99)).toThrow();expect(store.getSnapshot().cash).toBe(0);
  });
  it('handles blocked and corrupt storage as a stable session-only economy',()=>{
    const broken={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
    const store=createPlayerEconomy('blocked',broken);store.award('one',3);store.award('one',3);
    expect(store.getSnapshot()).toMatchObject({cash:42500,coins:5000,persisted:false});
    localStorage.setItem(economyKey('corrupt'),'broken');expect(createPlayerEconomy('corrupt').getSnapshot().persisted).toBe(false);
  });
  it('publishes balance changes, honours idempotency across instances and scales harder rewards',()=>{
    const store=createPlayerEconomy('shared'),other=createPlayerEconomy('shared'),listener=vi.fn(),stop=store.subscribe(listener);
    store.award('same',0);other.award('same',0);expect(other.getSnapshot().cash).toBe(20000);expect(listener).toHaveBeenCalledTimes(1);stop();
    store.purchase('coffee','cup');expect(listener).toHaveBeenCalledTimes(1);
    expect(missionReward(3).coins).toBe(5000);expect(missionReward(6).coins).toBe(10000);expect(missionReward(8).coins).toBe(15000);expect(reviveCost(8)).toBe(5000);
  });
});
