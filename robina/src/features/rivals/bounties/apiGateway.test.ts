import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createApiGateway, exactClientMicros } from './apiGateway';
import type { BountyTask, BountySubmission, BountyWithdrawal, BountyWallet, BountyNotification } from '@/services/bounties';

const task: BountyTask = { _id:'123456789012345678901234', terms:{title:'Server X Contract',description:'Original RIVALS promotion',platform:'x',instructions:['Publish original content with disclosure.'],disclosure:'Clearly disclose the paid promotion.',evidenceRequired:true,minimumEngagement:5000,rewardMicros:'10000000',revision:1},
  status:'active',budgetMicros:'100000000',committedMicros:'0',rewardedMicros:'0',participationLimit:10,participants:0,createdAt:'2026-11-11T12:00:00.000Z',updatedAt:'2026-11-11T12:00:00.000Z' };
let tasks:BountyTask[], submissions:BountySubmission[], withdrawals:BountyWithdrawal[], notifications:BountyNotification[], wallet:BountyWallet;
let lostWithdrawalResponse=false, failWallet=false, failNotifications=false, expireHistorySession=false;
const accepted = new Map<string,BountyWithdrawal>();
const fetcher=vi.fn(async (input:string, init:RequestInit={}) => {
  const url=new URL(input,'https://localhost'),kind=url.pathname.split('/').at(-1),method=init.method||'GET';
  if(method==='GET'){
    if(kind==='wallet'){if(failWallet)throw new TypeError('offline');return new Response(JSON.stringify(wallet));}
    if(kind==='notifications' && failNotifications) return new Response('{"error":"service_unavailable"}', {status:503});
    if(kind==='submissions' && expireHistorySession) return new Response('{"error":"unauthenticated"}', {status:401});
    const items=kind==='tasks'?tasks:kind==='submissions'?submissions:kind==='withdrawals'?withdrawals:kind==='notifications'?notifications:[];
    return new Response(JSON.stringify({items,nextBefore:null}));
  }
  if(url.pathname.endsWith('/submissions')){
    const body=JSON.parse(String(init.body));submissions=[{_id:'223456789012345678901234',playerId:'323456789012345678901234',taskId:task._id,terms:task.terms,postUrl:body.postUrl,evidenceUrl:body.evidenceUrl,evidenceNotes:body.evidenceNotes,status:'pending',createdAt:task.createdAt}];
    wallet.pendingMicros='10000000';return new Response(JSON.stringify(submissions[0]),{status:201});
  }
  if(url.pathname.endsWith('/withdrawals')){
    const key=new Headers(init.headers).get('Idempotency-Key')!,body=JSON.parse(String(init.body));
    if(!accepted.has(key)){
      const row:BountyWithdrawal={_id:'423456789012345678901234',playerId:'323456789012345678901234',requestKey:key,amountMicros:body.amountMicros,address:body.address,status:'pending',createdAt:task.createdAt,updatedAt:task.createdAt};
      accepted.set(key,row);withdrawals.unshift(row);wallet.availableMicros=(BigInt(wallet.availableMicros)-BigInt(row.amountMicros)).toString();wallet.reservedMicros=row.amountMicros;
    }
    if(lostWithdrawalResponse){lostWithdrawalResponse=false;throw new TypeError('response lost after acceptance');}
    return new Response(JSON.stringify(accepted.get(key)),{status:201});
  }
  return new Response('{"ok":true}');
});
beforeEach(()=>{
  tasks=structuredClone([task]);submissions=[];withdrawals=[];notifications=[];accepted.clear();lostWithdrawalResponse=false;failWallet=false;failNotifications=false;expireHistorySession=false;
  wallet={availableMicros:'0',reservedMicros:'0',pendingMicros:'0',earnedMicros:'0',withdrawnMicros:'0',address:'',minimumWithdrawalMicros:'5000000',currency:'USDC',chainId:8453,payoutsEnabled:true};
  localStorage.clear();sessionStorage.clear();fetcher.mockClear();vi.stubGlobal('fetch',fetcher);
});
afterEach(()=>vi.unstubAllGlobals());
describe('live bounty gateway',()=>{
  it('does not hide bounties behind old caps and uses the actual admin-awarded amount',async()=>{
    tasks=[{...task,budgetMicros:'0',committedMicros:'999999999',participationLimit:1,participants:999,terms:{...task.terms,rewardMode:'manual',rewardMicros:'0'}}];
    submissions=[{_id:'223456789012345678901234',playerId:'323456789012345678901234',taskId:task._id,terms:tasks[0].terms,postUrl:'https://x.com/i/web/status/12345',status:'approved',awardedMicros:'7250001',createdAt:task.createdAt}];
    wallet.availableMicros='7250001';wallet.earnedMicros='7250001';wallet.pendingSubmissions=0;
    const state=await createApiGateway('player').load();
    expect(state.tasks[0].status).toBe('active');expect(state.tasks[0].rewardMode).toBe('manual');
    expect(state.submissions[0].rewardMicros).toBe(7250001);expect(state.wallet.availableMicros).toBe(7250001);
  });
  it('uses backend records, never imports device demo balances, and shows empty server state honestly',async()=>{
    localStorage.setItem('rivals_bounties_demo_v1:player','{"wallet":{"availableMicros":999999999}}');
    tasks=[];const state=await createApiGateway('player').load();
    expect(state.mode).toBe('live');expect(state.persistence).toBe('server');expect(state.tasks).toEqual([]);expect(state.wallet.availableMicros).toBe(0);
    expect(fetcher.mock.calls.every(([,init])=>init.credentials==='include')).toBe(true);
  });
  it('keeps campaigns and the authoritative zero wallet visible when optional notifications fail',async()=>{
    tasks=[];failNotifications=true;
    const state=await createApiGateway('player').load();
    expect(state.tasks).toEqual([]);expect(state.wallet.availableMicros).toBe(0);
    expect(state.unavailable).toEqual(['notifications']);
  });
  it('does not disguise an expired session as an empty history',async()=>{
    expireHistorySession=true;
    await expect(createApiGateway('player').load()).rejects.toMatchObject({status:401});
  });
  it('submits with promised revision, remains Pending until server approval and maps credited approval to Completed',async()=>{
    const gateway=createApiGateway('player');
    let state=await gateway.submit({taskId:task._id,postUrl:'https://x.com/rivals/status/12345',evidenceUrl:'https://example.com/analytics',evidenceNotes:'Ownership analytics',confirmed:true,termsRevision:1});
    expect(state.submissions[0].status).toBe('pending_review');expect(state.wallet.availableMicros).toBe(0);expect(state.wallet.pendingMicros).toBe(10000000);
    const mutation=fetcher.mock.calls.find(([,init])=>init.method==='POST');expect(JSON.parse(String(mutation![1].body))).toMatchObject({termsRevision:1});
    submissions[0].status='approved';wallet.availableMicros='10000000';wallet.earnedMicros='10000000';wallet.pendingMicros='0';
    state=await gateway.load();expect(state.submissions[0].status).toBe('completed');expect(state.wallet.pendingMicros).toBe(0);
  });
  it('preserves completed-task eligibility even when its submission is on an older history page',async()=>{
    tasks[0].participation={_id:'223456789012345678901234',taskId:task._id,status:'approved'};
    const state=await createApiGateway('player').load();expect(state.submissions).toEqual([]);expect(state.tasks[0].submitted).toBe(true);expect(state.tasks[0].submissionStatus).toBe('completed');
  });
  it('reuses one withdrawal key across an accepted-but-lost response and gateway recreation',async()=>{
    wallet.availableMicros='10000000';wallet.earnedMicros='10000000';lostWithdrawalResponse=true;
    const input={amountMicros:5000000,address:'0x'+'11'.repeat(20),confirmed:true};
    await expect(createApiGateway('player').requestWithdrawal(input)).rejects.toThrow();
    const state=await createApiGateway('player').requestWithdrawal(input);
    const requests=fetcher.mock.calls.filter(([url,init])=>url.includes('/withdrawals')&&init.method==='POST');
    expect(requests).toHaveLength(2);expect(new Set(requests.map(([,init])=>new Headers(init.headers).get('Idempotency-Key'))).size).toBe(1);
    expect(accepted.size).toBe(1);expect(state.wallet.availableMicros).toBe(5000000);expect(state.withdrawals[0].status).toBe('pending');
  });
  it('does not lose the retry key if acceptance succeeds but the following wallet refresh fails',async()=>{
    wallet.availableMicros='10000000';wallet.earnedMicros='10000000';failWallet=true;
    const input={amountMicros:5000000,address:'0x'+'11'.repeat(20),confirmed:true},gateway=createApiGateway('player');
    await expect(gateway.requestWithdrawal(input)).rejects.toThrow('recorded');failWallet=false;
    await gateway.requestWithdrawal(input);expect(accepted.size).toBe(1);expect(wallet.availableMicros).toBe('5000000');
  });
  it('background refresh cannot turn an uncertain dialog retry into a second withdrawal intent',async()=>{
    wallet.availableMicros='10000000';wallet.earnedMicros='10000000';lostWithdrawalResponse=true;
    const input={amountMicros:5000000,address:'0x'+'11'.repeat(20),confirmed:true},gateway=createApiGateway('player');
    await expect(gateway.requestWithdrawal(input)).rejects.toThrow();
    await gateway.load(); // Poll sees the accepted request, but the original dialog may still be open.
    await gateway.requestWithdrawal(input);expect(accepted.size).toBe(1);expect(wallet.availableMicros).toBe('5000000');
  });
  it('never invents Paid from authorization, preparation or a transaction hash alone',async()=>{
    const row:BountyWithdrawal={_id:'423456789012345678901234',playerId:'323456789012345678901234',amountMicros:'5000000',address:'0x'+'11'.repeat(20),status:'broadcast',createdAt:task.createdAt,updatedAt:task.createdAt,txHash:'0x'+'ab'.repeat(32)};
    withdrawals=[row];const gateway=createApiGateway('player');let state=await gateway.load();expect(state.withdrawals[0].status).toBe('broadcast');expect(state.withdrawals[0].transactionUrl).toContain('basescan.org/tx/');
    row.status='paid';wallet.withdrawnMicros='5000000';state=await gateway.load();expect(state.withdrawals[0].status).toBe('paid');
  });
  it('rejects invalid or out-of-bounds monetary responses instead of rounding them',()=>{
    expect(exactClientMicros('8999999999999999')).toBe(8999999999999999);
    for(const value of ['5.5','1e9','-1','9000000000000001'])expect(()=>exactClientMicros(value)).toThrow();
  });
});
