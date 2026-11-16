import { io, type Socket } from 'socket.io-client';
import { missionsApi } from './missions';
import type { AuthorityAction, AuthorityInput, AuthoritySnapshot, SimulationEvent,PresentationEvent } from '@/features/rivals/authority/MissionSimulation';

export interface VerifiedGameResult { _id: string; outcome: 'success' | 'failure'; score: number; durationSeconds: number;
  firstCompletion: boolean; rewardEligible: boolean; verifiedAt: string; remainingHealth?: number }
export class MissionAuthorityClient {
  latest: AuthoritySnapshot | null = null;
  result: VerifiedGameResult | null = null;
  recoveryUntil: string | null = null;
  connection: 'connecting' | 'connected' | 'reconnecting' | 'closed' = 'connecting';
  onShot?: (shot: Extract<SimulationEvent, { type: 'shot' }>) => void;
  onEffect?:(event:PresentationEvent)=>void;
  onDamage?:(amount:number,angle:number)=>void;
  private socket?: Socket; private listeners = new Set<() => void>(); private closed = false;
  private requestedReady = false; private paused = false; private retry?: ReturnType<typeof setTimeout>;
  private lastSent = 0; private sequence = 0; private pending: Partial<AuthorityInput> = {}; private reconnectStarted = 0;
  private stateFrame?: number;
  /** Network sequence is not the movement acknowledgement; the server may
   * receive a packet just before publishing an older simulated position. */
  constructor(readonly sessionId: string) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify() { this.listeners.forEach(listener => listener()); }
  async connect() {
    const credentials = await missionsApi.connect(this.sessionId);
    const origin = new URL(credentials.origin);
    if (origin.origin !== credentials.origin || origin.username || origin.password ||
      origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Invalid mission connection origin.');
    if (this.closed) return;
    await new Promise<void>((resolve, reject) => {
      const socket = io(origin.origin, { transports: ['websocket'], forceNew:true, reconnection: false, autoConnect: false,
        auth: { ticket: credentials.ticket }, timeout: 10000 });
      this.socket = socket;
      socket.on('mission:state', (state: AuthoritySnapshot) => {
        if(this.result||this.closed)return;
        this.latest = state;
        // Coalesce owner snapshots to the renderer's actual cadence. A slow
        // phone must not accumulate expensive HUD/scene updates at network rate.
        if(this.stateFrame===undefined)this.stateFrame=requestAnimationFrame(()=>{this.stateFrame=undefined;this.notify();});
      });
      socket.on('mission:shot', shot => this.onShot?.(shot));
      socket.on('mission:effect',(event:PresentationEvent)=>{if(!this.closed)this.onEffect?.(event);});
      socket.on('mission:health',event=>{if(!this.closed&&event.kind==='damage')this.onDamage?.(event.amount,event.angle??0);});
      socket.on('mission:result', ({ result, state, recoveryUntil }) => {
        state.mission.elapsed=result.durationSeconds;
        this.result = result; this.latest = state; this.recoveryUntil = recoveryUntil; this.notify();
      });
      socket.on('mission:error', () => socket.disconnect());
      socket.once('connect_error', error => { socket.disconnect(); reject(error); });
      socket.once('connect', () => {
        this.connection = 'connected'; this.reconnectStarted = 0;
        if (this.requestedReady) { socket.emit('mission:ready'); socket.emit('mission:pause', this.paused); }
        this.notify(); resolve();
      });
      socket.on('disconnect', () => {
        this.pending={};
        if (this.closed || this.result) return;
        this.connection = 'reconnecting'; this.notify(); this.scheduleReconnect();
      });
      socket.connect();
    });
  }
  private scheduleReconnect() {
    if (this.closed || this.retry || this.result) return;
    this.reconnectStarted ||= Date.now();
    this.retry = setTimeout(() => {
      this.retry = undefined;
      if (Date.now() - this.reconnectStarted >= 300000) { this.connection = 'closed'; this.notify(); return; }
      void this.connect().catch(async () => {
        try {
          const status = await missionsApi.inspect(this.sessionId);
          if (status.result) {
            this.result = status.result; this.recoveryUntil = status.recoveryUntil;
            if (this.latest) this.latest={...this.latest,mission:{...this.latest.mission,state:status.result.outcome==='success'?'SUCCESS':'FAILED',elapsed:status.result.durationSeconds},health:status.result.remainingHealth??this.latest.health};
            this.notify(); return;
          }
          if (status.session.status !== 'active') { this.connection = 'closed'; this.notify(); return; }
        } catch { /* A temporary outage retains the original recovery deadline. */ }
        this.scheduleReconnect();
      });
    }, 1000);
  }
  ready() { this.requestedReady = true; this.socket?.emit('mission:ready'); this.socket?.emit('mission:pause', this.paused); }
  pause(value: boolean) { if(this.paused===value)return;this.paused = value;if(value)this.pending={}; this.socket?.emit('mission:pause', value); }
  submit(frame: Omit<AuthorityInput, 'seq'>) {
    for (const key of ['dodge', 'interact', 'reload', 'jump', 'highJump','fire'] as const) this.pending[key] = Boolean(this.pending[key] || frame[key]);
    if (performance.now() - this.lastSent < 50 || this.connection !== 'connected') return;
    this.lastSent = performance.now();
    const {tick,...legacy}=frame;
    this.socket?.emit('mission:input', { ...legacy, ...this.pending,
      ...(this.latest?.prediction&&tick!==undefined?{tick}:{}),seq: ++this.sequence }); this.pending = {};
  }
  action(action: AuthorityAction) { if (this.connection === 'connected') this.socket?.emit('mission:action', action); }
  dispose() { this.closed = true; this.connection = 'closed'; clearTimeout(this.retry); if(this.stateFrame!==undefined)cancelAnimationFrame(this.stateFrame);this.socket?.disconnect();this.socket?.removeAllListeners();this.onShot=this.onEffect=this.onDamage=undefined;this.pending={}; this.listeners.clear(); }
}
