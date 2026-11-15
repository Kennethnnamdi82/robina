import {afterEach,describe,expect,it,vi} from 'vitest';
const fakes=vi.hoisted(()=>({handlers:new Map<string,(...args:unknown[])=>void>(),emit:vi.fn(),connectApi:vi.fn(),inspect:vi.fn(),io:vi.fn()}));
vi.mock('./missions',()=>({missionsApi:{connect:fakes.connectApi,inspect:fakes.inspect}}));
vi.mock('socket.io-client',()=>({io:fakes.io}));
import {MissionAuthorityClient} from './missionAuthority';
import {emptyCommand} from '@/features/rivals/input/InputBuffer';
import type {AuthorityInput} from '@/features/rivals/authority/MissionSimulation';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();fakes.handlers.clear();fakes.emit.mockClear();fakes.io.mockClear();fakes.connectApi.mockReset();fakes.inspect.mockReset();});
function transport(){
  const socket={on:vi.fn(),once:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),removeAllListeners:vi.fn(),emit:fakes.emit};
  socket.on.mockImplementation((name,handler)=>{fakes.handlers.set(name,handler);return socket;});
  socket.once.mockImplementation((name,handler)=>{fakes.handlers.set(name,handler);return socket;});
  socket.connect.mockImplementation(()=>{fakes.handlers.get('connect')?.();return socket;});
  fakes.io.mockReturnValue(socket);fakes.connectApi.mockResolvedValue({origin:'https://api.example.com',ticket:'one-use-ticket'});return socket;
}
describe('live mission client',()=>{
  it('recovers an already persisted result after a lost terminal packet with a fresh render snapshot',async()=>{
    vi.useFakeTimers();transport();const client=new MissionAuthorityClient('session');await client.connect();
    fakes.handlers.get('mission:state')?.({health:80,mission:{state:'ACTIVE',elapsed:30}});const previous=client.latest;
    fakes.connectApi.mockRejectedValue(new Error('mission_not_active'));fakes.inspect.mockResolvedValue({result:{outcome:'failure',durationSeconds:60,remainingHealth:70},recoveryUntil:null});
    fakes.handlers.get('disconnect')?.();await vi.advanceTimersByTimeAsync(1000);
    expect(client.latest).not.toBe(previous);expect(client.latest?.mission.state).toBe('FAILED');expect(client.latest?.health).toBe(70);client.dispose();
  });
  it('coalesces snapshots so slow renderers cannot build up a network-rate HUD backlog',async()=>{
    transport();let frame:FrameRequestCallback|undefined;
    vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{frame=callback;return 1;});vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
    const client=new MissionAuthorityClient('session');await client.connect();const listener=vi.fn();client.subscribe(listener);
    for(let i=0;i<100;i++)fakes.handlers.get('mission:state')?.({health:100-i});expect(listener).not.toHaveBeenCalled();expect(client.latest?.health).toBe(1);
    frame?.(100);expect(listener).toHaveBeenCalledTimes(1);client.dispose();
  });
  it('uses a one-use ticket and sends bounded input without health or result claims',async()=>{
    transport();const client=new MissionAuthorityClient('session');await client.connect();client.ready();
    expect(fakes.io).toHaveBeenCalledWith('https://api.example.com',expect.objectContaining({transports:['websocket'],auth:{ticket:'one-use-ticket'},reconnection:false}));vi.spyOn(performance,'now').mockReturnValue(100);
    const input:Omit<AuthorityInput,'seq'>={x:1,y:0,aimX:1,aimY:0,aim:[20,1,30],aiming:true,sprint:false,dodge:false,interact:false,fire:true,reload:false,jump:false,jumpHeld:false,highJump:false,touchRepeat:false,throttle:0,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0};
    for(let i=0;i<100;i++)client.submit(input);const frames=fakes.emit.mock.calls.filter(([event])=>event==='mission:input');expect(frames).toHaveLength(1);
    expect(frames[0][1]).toMatchObject({seq:1,x:1,fire:true});expect(frames[0][1]).not.toHaveProperty('health');expect(frames[0][1]).not.toHaveProperty('outcome');client.dispose();
  });
  it('receives verified terminal state and the persisted cooldown',async()=>{
    transport();const client=new MissionAuthorityClient('session');await client.connect();const listener=vi.fn();client.subscribe(listener);
    fakes.handlers.get('mission:result')?.({result:{_id:'result',outcome:'failure',score:0,durationSeconds:60,firstCompletion:false,rewardEligible:false},state:{health:0,mission:{state:'FAILED',elapsed:59}},recoveryUntil:'2026-11-14T12:00:00.000Z'});
    expect(client.result?.outcome).toBe('failure');expect(client.latest?.health).toBe(0);expect(client.latest?.mission.elapsed).toBe(60);expect(client.recoveryUntil).toBe('2026-11-14T12:00:00.000Z');expect(listener).toHaveBeenCalled();client.dispose();
  });
});
describe('FPS trigger transport',()=>{
  it('does not lose a short trigger tap between network frames or repeat it after release',()=>{
    const client=new MissionAuthorityClient('isolated'),emit=vi.fn();Object.assign(client,{socket:{emit},connection:'connected'});
    let now=100;vi.spyOn(performance,'now').mockImplementation(()=>now);
    const frame={...emptyCommand(),aim:[0,1,-10],jump:false,jumpHeld:false,highJump:false,touchRepeat:false,throttle:0,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0} as Omit<AuthorityInput,'seq'>;
    client.submit(frame);now=110;client.submit({...frame,fire:true});now=120;client.submit(frame);expect(emit).toHaveBeenCalledTimes(1);
    now=160;client.submit(frame);expect(emit.mock.lastCall?.[1].fire).toBe(true);
    now=220;client.submit(frame);expect(emit.mock.lastCall?.[1].fire).toBe(false);
  });
  it('does not resume a trigger tap queued before pausing',()=>{
    const client=new MissionAuthorityClient('isolated'),emit=vi.fn();Object.assign(client,{socket:{emit},connection:'connected'});
    let now=10;vi.spyOn(performance,'now').mockImplementation(()=>now);
    const frame={...emptyCommand(),aim:[0,1,-10],jump:false,jumpHeld:false,highJump:false,touchRepeat:false,throttle:0,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0} as Omit<AuthorityInput,'seq'>;
    client.submit({...frame,fire:true});client.pause(true);client.pause(false);now=100;client.submit(frame);expect(emit.mock.lastCall?.[1].fire).toBe(false);
  });
});
