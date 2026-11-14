import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { performance } from 'node:perf_hooks';
import { Server } from 'socket.io';
import { z } from 'zod';
import { MissionSimulation, SIMULATION_STEP, SIMULATION_VERSION } from '../../generated/missionSimulation.mjs';
import { MissionCheckpoint, MissionLife, MissionSession } from './models.js';
import { User } from '../models/User.js';
import { RevokedToken } from '../models/RevokedToken.js';
import { applyVerifiedCombatEvent } from './trustedCombat.js';
import { saveVerifiedCheckpoint } from './trustedCheckpoints.js';
import { settleVerifiedResult } from './trustedResults.js';

const unit = z.number().finite().min(-1).max(1), flag = z.boolean();
export const liveInput = z.object({ seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), x: unit, y: unit,
  aimX: unit, aimY: unit, aim: z.tuple([z.number().finite().min(-1000).max(1000), z.number().finite().min(-100).max(100), z.number().finite().min(-1000).max(1000)]),
  aiming: flag, sprint: flag, dodge: flag, interact: flag, fire: flag, reload: flag, jump: flag, jumpHeld: flag, highJump: flag,
  touchRepeat: flag, throttle: unit, steer: unit, brake: flag, stickX: unit, stickY: unit, cameraYaw: z.number().finite().min(-100000).max(100000),
}).strict();
const liveAction = z.discriminatedUnion('type', [
  ...['vehicle', 'grenade', 'handoff', 'cancelHandoff', 'cancelPickup'].map(type => z.object({ type: z.literal(type) }).strict()),
  z.object({ type: z.literal('weapon'), slot: z.number().int().min(0).max(2) }).strict(),
  z.object({ type: z.literal('pickup'), slot: z.number().int().min(0).max(2) }).strict(),
]);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const FIVE_MINUTES = 300000;
const AUTHORITY_LEASE_MS = 60000;

export class LiveMissionAuthority {
  entries = new Map(); tickets = new Map(); connecting=new Set();
  owner = crypto.randomUUID(); io; timer; lastTick = performance.now();
  constructor({ origins = [], maxSessions = 4, publicOrigin = '', autoTick = true } = {}) {
    this.origins = new Set([...origins, 'https://localhost', 'capacitor://localhost']);
    this.maxSessions = Math.max(1, Math.min(200, Number(maxSessions) || 4)); this.publicOrigin = publicOrigin?new URL(publicOrigin).origin:'';
    if (autoTick) { this.timer = setInterval(() => this.tick(), 50); this.timer.unref(); }
  }
  async ticket(playerId, sessionId,identity={}) {
    const now = Date.now(); for (const [key, ticket] of this.tickets) if (ticket.expires < now) this.tickets.delete(key);
    const mission = await MissionSession.findOne({ _id: sessionId, playerId, authority: true, status: 'active', reconnectDeadline: { $gt: new Date() } }).lean();
    if (!mission) throw Object.assign(new Error('mission_not_active'), { status: 409 });
    if(this.tickets.size>=1000)throw Object.assign(new Error('mission_server_busy'),{status:503});
    if (!this.entries.has(sessionId) && this.entries.size >= this.maxSessions) throw Object.assign(new Error('mission_server_full'), { status: 503 });
    if ([...this.tickets.values()].filter(t => String(t.playerId) === String(playerId)).length >= 3) throw Object.assign(new Error('connection_rate_limited'), { status: 429 });
    const ticket = crypto.randomBytes(32).toString('base64url');
    this.tickets.set(hash(ticket), { playerId: String(playerId), sessionId, expires: now + 30000, jti:identity?.jti??null,sv:identity?.sv??0 });
    return { ticket, origin: this.publicOrigin, expiresAt: new Date(now + 30000), simulationVersion: SIMULATION_VERSION };
  }
  hasCapacity(){return this.entries.size+this.connecting.size<this.maxSessions&&(this.utilisation??0)<.8;}
  attach(httpServer) {
    this.io = new Server(httpServer, { transports: ['websocket'], maxHttpBufferSize: 4096, pingTimeout:60000,
      cors: { origin: [...this.origins], credentials: false },
      allowRequest: (req, callback) => callback(null, !req.headers.origin || this.origins.has(req.headers.origin)),
    });
    this.io.use(async (socket, next) => {
      const value = socket.handshake.auth?.ticket;
      if (typeof value !== 'string' || value.length > 100) return next(new Error('unauthenticated'));
      const key = hash(value), ticket = this.tickets.get(key); this.tickets.delete(key);
      if (!ticket || ticket.expires < Date.now()) return next(new Error('invalid_connection_ticket'));
      try { socket.data.entry = await this.connect(ticket); next(); } catch (error) { next(new Error(error.message)); }
    });
    this.io.on('connection', socket => {
      const entry = socket.data.entry; entry.socket?.disconnect(true); entry.socket = socket;
      socket.emit('mission:state', entry.sim.snapshot());
      socket.on('mission:ready', () => {
        if (entry.socket !== socket || entry.terminal) return;
        entry.ready = true; entry.paused = false; entry.lastInputAt = Date.now();
        if(!entry.started){entry.started=true;entry.work=entry.work.then(()=>MissionSession.updateOne({_id:entry.id,status:'active',startedAt:null},{$set:{startedAt:new Date()}})).catch(error=>this.fault(entry,error));}
      });
      socket.on('mission:pause', paused => { if (typeof paused === 'boolean' && entry.socket === socket && entry.paused!==paused) {
        entry.paused = paused; entry.sim.neutral();socket.emit('mission:state',entry.sim.snapshot());
      } });
      socket.on('mission:input', input => {
        if (entry.socket !== socket || entry.terminal) return;
        if (!this.rate(entry, 60)) { socket.disconnect(true); return; }
        const parsed = liveInput.safeParse(input); if (!parsed.success) { socket.emit('mission:rejected', { reason: 'invalid_input' }); return; }
        entry.sim.input(parsed.data); entry.lastInputAt = Date.now();
      });
      socket.on('mission:action', (input, ack) => {
        if (entry.socket !== socket || entry.terminal || !entry.ready || !this.rate(entry, 60)) return;
        const parsed = liveAction.safeParse(input);
        if (!parsed.success) { if (typeof ack === 'function') ack({ ok: false }); return; }
        if (entry.paused && !['handoff', 'cancelHandoff', 'pickup', 'cancelPickup'].includes(parsed.data.type)) return;
        const ok = entry.sim.action(parsed.data); if (typeof ack === 'function') ack({ ok });
        this.flush(entry); entry.socket?.emit('mission:state', entry.sim.snapshot());
      });
      socket.on('disconnect', () => {
        if (entry.socket !== socket) return;
        entry.socket = null; entry.ready = false; entry.sim.neutral(); entry.disconnectAt = Date.now();
        entry.work = entry.work.then(async () => {
          if (!entry.terminal) await MissionSession.updateOne({ _id: entry.id, status: 'active', authorityOwner: this.owner }, {
            $set: { reconnectDeadline: new Date(Date.now() + FIVE_MINUTES), authorityLeaseUntil: new Date(Date.now() + AUTHORITY_LEASE_MS) },
          });
        }).catch(error => this.fault(entry, error));
      });
    });
    return this;
  }
  rate(entry, maximum) { const now = Math.floor(Date.now() / 1000); if (entry.rateAt !== now) { entry.rateAt = now; entry.rateCount = 0; } return ++entry.rateCount <= maximum; }
  async connect(ticket) {
    if(this.connecting.has(ticket.sessionId))throw new Error('mission_connection_in_progress');
    this.connecting.add(ticket.sessionId);
    try{
    let existing = this.entries.get(ticket.sessionId);
    if (existing) { await existing.work; if (existing.socket) throw new Error('mission_connected_elsewhere'); }
    if (!existing && this.entries.size+this.connecting.size>this.maxSessions) throw new Error('mission_server_full');
    const now = new Date();
    const mission = await MissionSession.findOneAndUpdate({ _id: ticket.sessionId, playerId: ticket.playerId, authority: true,
      status: 'active', reconnectDeadline: { $gt: now }, $or: [{ authorityOwner: this.owner }, { authorityOwner: null }, { authorityLeaseUntil: { $lte: now } }] },
    { $set: { authorityOwner: this.owner, authorityLeaseUntil: new Date(Date.now() + AUTHORITY_LEASE_MS) } }, { new: true }).lean();
    if (!mission) throw new Error('mission_not_available');
    const user = await User.findById(ticket.playerId).select('accountStatus sessionVersion').lean();
    if (!user || user.accountStatus === 'suspended' || (user.sessionVersion??0)!==(ticket.sv??0)) throw new Error('account_unavailable');
    if(ticket.jti&&await RevokedToken.exists({jti:ticket.jti}))throw new Error('session_revoked');
    const sim = new MissionSimulation(mission.missionId, mission.seed, String(mission._id));
    const checkpoint = await MissionCheckpoint.findOne({ sessionId: mission._id }).sort({ ordinal: -1 }).lean();
    if (checkpoint?.simulationState) {
      sim.restore(checkpoint.simulationState, mission.grenadesSpent);
      const restored = await MissionSession.updateOne({ _id: mission._id, status: 'active', authorityOwner: this.owner }, { $set: { health: checkpoint.health } });
      if (!restored.modifiedCount && mission.health !== checkpoint.health) throw new Error('mission_not_active');
    }
    const entry = { id: String(mission._id), playerId: String(mission.playerId), sessionVersion: user.sessionVersion ?? 0,jti:ticket.jti??null,
      sim, socket: null, ready: false, paused: false, terminal: false, work: Promise.resolve(), epoch: crypto.randomUUID(),
      checkpointOrdinal: checkpoint?.ordinal ?? 0, started:Boolean(mission.startedAt), lastInputAt: Date.now(), lastPersist: Date.now(), lastAuth: Date.now(), rateCount: 0, rateAt: 0 };
    this.entries.set(entry.id, entry);
    if (!checkpoint) {
      try { await this.checkpoint(entry, 'insertion'); }
      catch(error){this.entries.delete(entry.id);throw error;}
    }
    return entry;
    }finally{this.connecting.delete(ticket.sessionId);}
  }
  tick() {
    const now = performance.now(), delta = Math.min(.1, Math.max(0, (now - this.lastTick) / 1000)); this.lastTick = now;
    if(!this.measuredAt||now-this.measuredAt>1000){const usage=performance.eventLoopUtilization();this.utilisation=performance.eventLoopUtilization(usage,this.lastUtilisation).utilization;this.lastUtilisation=usage;this.measuredAt=now;}
    for (const entry of this.entries.values()) {
      if (entry.terminal) { if(entry.faulted&&entry.disconnectAt&&Date.now()-entry.disconnectAt>FIVE_MINUTES)this.entries.delete(entry.id);continue; }
      if(mongoose.connection.readyState!==1){this.fault(entry,new Error('database_unavailable'));continue;}
      if (!entry.socket) { if (entry.disconnectAt && Date.now() - entry.disconnectAt > FIVE_MINUTES) { this.entries.delete(entry.id); void MissionSession.updateOne({ _id: entry.id, status: 'active' }, { $set: { status: 'expired', endedAt: new Date() } }); } continue; }
      if (entry.ready && !entry.paused) {
        if (Date.now() - entry.lastInputAt > 300) entry.sim.neutral();
        entry.accumulator = (entry.accumulator ?? 0) + delta;
        let steps = 0; while (entry.accumulator >= SIMULATION_STEP && steps++ < 6) { entry.sim.step(); entry.accumulator -= SIMULATION_STEP; if (entry.sim.mission.state !== 'ACTIVE') break; }
        this.flush(entry);
      }
      if(entry.ready&&!entry.paused&&(!entry.lastSnapshot||Date.now()-entry.lastSnapshot>=100)){entry.lastSnapshot=Date.now();entry.socket.emit('mission:state', entry.sim.snapshot());}
      if (Date.now() - entry.lastPersist > 5000) {
        entry.lastPersist = Date.now(); entry.work = entry.work.then(async () => {
          const result = await MissionSession.updateOne({ _id: entry.id, status: 'active', authorityOwner: this.owner }, {
            $set: { authorityLeaseUntil: new Date(Date.now() + AUTHORITY_LEASE_MS), reconnectDeadline: new Date(Date.now() + FIVE_MINUTES) },
          });
          if (!result.matchedCount && !entry.terminal) throw new Error('mission_ownership_lost');
          if (Date.now() - entry.lastAuth > 60000) {
            entry.lastAuth = Date.now(); const user = await User.findById(entry.playerId).select('accountStatus sessionVersion').lean();
            if (!user || user.accountStatus === 'suspended' || (user.sessionVersion ?? 0) !== entry.sessionVersion) throw new Error('session_revoked');
            if(entry.jti&&await RevokedToken.exists({jti:entry.jti}))throw new Error('session_revoked');
          }
        }).catch(error => this.fault(entry, error));
      }
    }
  }
  flush(entry) {
    const events = entry.sim.drainEvents(), terminal = entry.sim.mission.state !== 'ACTIVE';
    // Capture a milestone now, before the live simulation can advance again.
    const milestone = events.filter(e => e.type === 'checkpoint').at(-1), state = milestone && !terminal ? entry.sim.checkpoint() : null;
    if (terminal) entry.terminal = true;
    entry.work = entry.work.then(async () => {
      for (const event of events) {
        if (event.type === 'health') {
          await applyVerifiedCombatEvent(entry.id, { id: `${entry.epoch}:${event.id}`, kind: event.kind, amount: event.kind === 'firstAid' ? 25 : event.amount },this.owner);
          entry.socket?.emit('mission:health', { health: entry.sim.controller.health });
        } else if (event.type === 'grenade') await MissionSession.updateOne({ _id: entry.id, status: 'active' }, { $inc: { grenadesSpent: 1 } });
        else if (event.type === 'shot') entry.socket?.emit('mission:shot', event);
      }
      if (state) await this.checkpoint(entry, milestone.id, state);
      if (terminal) {
        const sim = entry.sim, success = sim.mission.state === 'SUCCESS';
        const result = await settleVerifiedResult(entry.id, { outcome: success ? 'success' : 'failure', objectivesSatisfied: success,
          elapsedSeconds: sim.mission.elapsed, metrics: { enemiesDefeated: sim.enemies.filter(e => !e.alive).length,
            expectedEnemies: sim.campaign.assignment.security, shotsFired: sim.firearmShots, successfulHits: Math.min(sim.firearmShots, sim.firearmHits),
            optionalCompleted: sim.mission.definition.objectives.filter(o=>o.optional&&sim.mission.completed.has(o.id)).length,
            optionalTotal: sim.mission.definition.objectives.filter(o=>o.optional).length } },this.owner);
        const life=await MissionLife.findOne({playerId:entry.playerId}).select('recoveryUntil').lean();
        entry.socket?.emit('mission:result', { result, state: sim.snapshot(), recoveryUntil: life?.recoveryUntil??null });
        entry.socket?.disconnect(true);
        this.entries.delete(entry.id);
      }
    }).catch(error => this.fault(entry, error));
  }
  async checkpoint(entry, id, state = entry.sim.checkpoint()) {
    const sim = entry.sim;
    await saveVerifiedCheckpoint(entry.id, { ordinal: ++entry.checkpointOrdinal, checkpointId: id,
      completedObjectives: [...state.mission.completed.__set], loadout: state.slots.flatMap((slot, index) => slot ? [{ slot: `slot-${index}`, weaponId: slot.id, magazine: slot.state.ammo, reserve: slot.state.reserve }] : []),
      defeatedEnemies: state.enemies.filter(e => e.state.health.current <= 0).map(e => e.spawn.id),
      consumedPickups: state.field.pickups.filter(p => p.consumed).map(p => p.id),
      stats: { enemiesDefeated: state.enemies.filter(e => e.state.health.current <= 0).length, shotsFired: state.stats.firearmShots, successfulHits: Math.min(state.stats.firearmHits, state.stats.firearmShots) },
      simulationState: state },this.owner);
    entry.socket?.emit('mission:checkpoint', { id, ordinal: entry.checkpointOrdinal, health: sim.controller.health });
  }
  fault(entry, error) {
    if(entry.faulted)return;entry.faulted=true;
    entry.paused = true; entry.ready = false; entry.socket?.emit('mission:error', { error: 'mission_sync_failed' }); entry.socket?.disconnect(true);
    console.error('[mission-authority]', entry.id, error.message);
  }
  async abandon(playerId, sessionId) {
    const entry = this.entries.get(sessionId);
    if (entry && entry.playerId === String(playerId)) { this.flush(entry); await entry.work; if (entry.terminal) return false; entry.ready = false; entry.socket?.disconnect(true); this.entries.delete(sessionId); }
    const result = await MissionSession.updateOne({ _id: sessionId, playerId, status: 'active', $or: [{ authorityOwner: this.owner }, { authorityOwner: null }, { authorityLeaseUntil: { $lte: new Date() } }] }, { $set: { status: 'abandoned', endedAt: new Date() } });
    return result.modifiedCount > 0;
  }
  async close() { clearInterval(this.timer); for (const entry of this.entries.values()) entry.socket?.disconnect(true); await Promise.allSettled([...this.entries.values()].map(e => e.work)); await new Promise(resolve => this.io ? this.io.close(resolve) : resolve()); this.entries.clear(); }
}
