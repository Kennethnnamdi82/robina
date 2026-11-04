import {describe,it,expect,vi} from 'vitest';
import {Box3,Vector3} from 'three';
import {createOperation,nextOperation} from './Operations';
import {THE_LAUNCH} from '../world/level';
import {SandboxSession} from './SandboxSession';
import {moveKinematic,BODY} from './physics3d';
import {FieldItems,BOMB} from './FieldItems';
import {TacticalEnemy} from './TacticalEnemy';
import {NavigationGrid,clearSight} from '../ai/navigation';
import {districtPlan} from './DistrictPlan';

describe('distinct validated operations',()=>{
  it('generates reproducible independent plans and advances to a different vault and venue',()=>{
    const original=JSON.stringify(THE_LAUNCH);
    for(let seed=0;seed<30;seed++){
      const a=createOperation(seed),b=nextOperation(a,true);
      expect(a.fingerprint).toBe(createOperation(seed).fingerprint);expect(a.venue).not.toBe(b.venue);expect(a.fingerprint).not.toBe(b.fingerprint);
      expect(a.level.objects.find(o=>o.id==='vault')).not.toEqual(b.level.objects.find(o=>o.id==='vault'));
      expect(b.ordinal).toBe(2);expect(nextOperation(a).ordinal).toBe(1);
    }expect(JSON.stringify(THE_LAUNCH)).toBe(original);
  },30000);
  it('completes mandatory real mission events before advancing, without saving account rewards',()=>{
    const s=new SandboxSession({},createOperation(1));s.mission.start();s.update({status:'playing'});
    for(const event of ['compound-entered','sector-console','timed-access','vault-sector-entered','relay-a','relay-b','guardian-defeated','vault','training-core','extraction'])s.mission.event(event);
    s.publishMission();expect(s.mission.snapshot().state).toBe('SUCCESS');expect(s.getSnapshot().status).toBe('finished');
    const next=new SandboxSession({},nextOperation(s.operation,true));expect(next.operation.ordinal).toBe(2);expect(next.mission.snapshot().state).not.toBe('SUCCESS');s.dispose();next.dispose();
  });
  it('keeps a deterministic authored district composition for each valid operation seed',()=>{
    const seen=new Set<string>();
    for(let seed=0;seed<30;seed++){
      const operation=createOperation(seed),first=districtPlan(operation.venue,operation.seed),again=districtPlan(operation.venue,operation.seed);
      expect(first).toEqual(again);expect(first.skyline).toHaveLength(6);expect(first.crossRoads.length).toBeGreaterThan(3);
      expect(first.skyline.every(shell=>shell.x<0||shell.x>44.8||shell.z<0||shell.z>35.2)).toBe(true);
      seen.add(first.id);
    }
    expect(seen).toEqual(new Set(['downtown','industrial','compound']));
  });
});
describe('solid walls, enlarged blast and tactical movement',()=>{
  const wall={id:'wall',kind:'wall' as const,enabled:true,box:new Box3(new Vector3(2,0,-3),new Vector3(3,3.4,3))};
  it('never crosses a wall during diagonal sprint, evade or an elevated jump',()=>{
    for(const height of [0,1,3.6,8])for(const delta of [.12,2,30]){const b={position:new Vector3(0,height,0),vertical:0,grounded:false};moveKinematic(b,delta,.05,1/60,[wall]);expect(b.position.x).toBeLessThanOrEqual(2-BODY.radius+.0001);}
    const b={position:new Vector3(2.05,0,0),vertical:0,grounded:true};moveKinematic(b,-.1,0,1/60,[wall]);expect(b.position.x).toBeLessThan(2-BODY.radius+.001);
  });
  it('damages exposed targets over the wider radius with falloff, but respects walls',()=>{
    const field=new FieldItems(),hit=vi.fn((_event:{amount:number})=>10),blocked=vi.fn((_event:{amount:number})=>10);
    Object.assign(field.bombs[0],{active:true,life:.001,position:new Vector3(0,.1,0),velocity:new Vector3()});
    const make=(id:string,x:number,damage:typeof hit)=>({id,team:'security' as const,box:new Box3(new Vector3(x,0,-.2),new Vector3(x+.3,1.8,.2)),alive:()=>true,damage});
    field.step(.01,[],[make('far',5.5,hit)],()=>{});expect(BOMB.radius).toBe(7);expect(hit).toHaveBeenCalledOnce();expect(hit.mock.calls[0]![0].amount).toBeLessThan(BOMB.damage);
    Object.assign(field.bombs[0],{active:true,life:.001,position:new Vector3(0,.1,0),velocity:new Vector3()});field.step(.01,[wall],[make('protected',4,blocked)],()=>{});expect(blocked).not.toHaveBeenCalled();
  });
  it('patrols, reacts after a human delay, evades without crossing blockers and can find real cover',()=>{
    const blocks=[{id:'cover',x:290,y:200,width:50,height:140,enabled:true}],grid=new NavigationGrid(12,10,64,blocks),enemy=new TacticalEnemy({id:'unit',type:'guard',x:200,y:200,angle:0,patrol:[{x:200,y:200},{x:200,y:350}]},grid);
    const context={player:{x:80,y:200},alive:true,permitted:true};enemy.threat(context.player,{x:1,y:0});enemy.step(.05,context,()=>{});expect(enemy.evasions).toBe(0);
    for(let i=0;i<400;i++)enemy.step(1/60,context,()=>{});
    expect(enemy.evasions).toBeGreaterThan(0);expect(clearSight(enemy,enemy,blocks,grid.radius)).toBe(true);expect(enemy.covers,JSON.stringify({x:enemy.x,y:enemy.y,tactic:enemy.tactic})).toBeGreaterThan(0);
  });
});
