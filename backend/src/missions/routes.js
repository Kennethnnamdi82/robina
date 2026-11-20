import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { web3Middleware } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { MissionLife, MissionSession, VerifiedMissionResult } from './models.js';
import { MissionCompletions } from './completions.js';
import { COLLISION_SIMULATION_VERSION } from '../../generated/missionSimulation.mjs';

// Exact existing assignment identifiers from the 3D game's assignments.ts.
// This is an allowlist, not a second mission configuration or gameplay engine.
const missionIds = ['reserve', 'reactor', 'archive', 'convoy', 'hostage', 'cargo', 'military', 'bridge', 'bridge-night'];
const startInput = z.object({ missionId: z.enum(missionIds.map(id => `assignment-${id}`)), seed: z.number().int().min(0).max(4294967295).optional() }).strict();
const permitInput = startInput.extend({simulationVersion:z.literal(COLLISION_SIMULATION_VERSION).optional()});
const idInput = z.string().regex(/^[a-f\d]{24}$/i);
const reportInput = z.object({ outcome: z.enum(['success', 'failure']) }).strict();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const leaseMs = 5 * 60 * 1000;
async function expireInterrupted(playerId, now = new Date()) {
  await MissionSession.updateMany(
    { playerId, status: 'active', reconnectDeadline: { $lte: now } },
    { $set: { status: 'expired', endedAt: now } },
  );
}

export function createMissionRoutes(authority = null, { allowUnverified = false, completions = new MissionCompletions() } = {}) {
const missionRoutes = Router();
const missionWrites=rateLimit({windowMs:60000,limit:30,keyGenerator:req=>String(req.missionPlayerId),standardHeaders:'draft-7',legacyHeaders:false,message:{error:'mission_rate_limited'}});
missionRoutes.use(web3Middleware, asyncRoute(async (req, res, next) => {
  const player = await User.findOne({ wallet: req.wallet }).select('_id');
  if (!player) return res.status(401).json({ error: 'unauthenticated' });
  req.missionPlayerId = player._id;
  res.set('Cache-Control', 'no-store');
  next();
}));

missionRoutes.post('/permits',missionWrites,asyncRoute(async(req,res)=>{
  const parsed=permitInput.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'invalid_mission'});
  res.json({permit:await completions.permit(req.missionPlayerId,parsed.data)});
}));
const uploads=rateLimit({windowMs:60000,limit:600,keyGenerator:req=>String(req.missionPlayerId),standardHeaders:'draft-7',legacyHeaders:false});
missionRoutes.post('/completions',uploads,asyncRoute(async(req,res)=>{
  const parsed=z.object({permit:z.string().min(1).max(16000),index:z.number().int(),count:z.number().int(),chunk:z.string().max(40000)}).strict().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'invalid_mission_replay'});
  const state=await completions.receive(req.missionPlayerId,parsed.data);res.status(state.status==='verified'?200:202).json(state);
}));
missionRoutes.get('/completions/:id',asyncRoute(async(req,res)=>{
  if(!idInput.safeParse(req.params.id).success)return res.status(400).json({error:'invalid_request'});
  res.json(await completions.status(req.missionPlayerId,req.params.id));
}));

missionRoutes.get('/sessions/current', asyncRoute(async (req, res) => {
  await expireInterrupted(req.missionPlayerId);
  const session = await MissionSession.findOne({ playerId: req.missionPlayerId, status: 'active' }).lean();
  res.json({ session });
}));

missionRoutes.get('/eligibility', asyncRoute(async (req, res) => {
  const now = new Date();
  await expireInterrupted(req.missionPlayerId, now);
  const session = await MissionSession.findOne({ playerId: req.missionPlayerId, status: 'active' }).lean();
  // Keep the response shape for installed apps. Legacy recovery dates no
  // longer prevent deployment; an existing active mission still does.
  res.json({ eligible: !session, recoveryUntil: null, activeSession: session, serverTime: now });
}));

missionRoutes.get('/sessions', asyncRoute(async (req, res) => {
  const sessions = await MissionSession.find({ playerId: req.missionPlayerId }).sort({ _id: -1 }).limit(50).lean();
  res.json({ sessions });
}));

missionRoutes.get('/results', asyncRoute(async (req, res) => {
  const items = await VerifiedMissionResult.find({ playerId: req.missionPlayerId })
    .sort({ verifiedAt: -1, _id: -1 }).limit(50).lean();
  res.json({ items });
}));

missionRoutes.get('/sessions/:id', asyncRoute(async (req, res) => {
  if (!idInput.safeParse(req.params.id).success) return res.status(400).json({ error: 'invalid_request' });
  const session = await MissionSession.findOne({ _id: req.params.id, playerId: req.missionPlayerId }).lean();
  if (!session) return res.status(404).json({ error: 'mission_not_found' });
  const result = await VerifiedMissionResult.findOne({ sessionId: session._id }).lean();
  res.json({ session, result, recoveryUntil: null });
}));

// Public standings contain verified successful results only. A player cannot
// submit or promote a local report into this collection through this API.
missionRoutes.get('/leaderboard', asyncRoute(async (req, res) => {
  const missionId = req.query.missionId;
  if (missionId !== undefined && !startInput.safeParse({ missionId }).success) return res.status(400).json({ error: 'invalid_mission' });
  const filter = { outcome: 'success', ...(missionId ? { missionId } : {}) };
  const results = await VerifiedMissionResult.find(filter).sort({ score: -1, durationSeconds: 1, _id: 1 }).limit(50)
    .populate('playerId', 'wallet').lean();
  res.json({ items: results.map(row => ({ missionId: row.missionId, score: row.score,
    durationSeconds: row.durationSeconds, verifiedAt: row.verifiedAt,
    player: row.playerId?.wallet ? `${String(row.playerId.wallet).slice(0, 6)}…${String(row.playerId.wallet).slice(-4)}` : 'Operative' })) });
}));

missionRoutes.post('/sessions', missionWrites, asyncRoute(async (req, res) => {
  const parsed = startInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_mission' });
  if (!authority && !allowUnverified) return res.status(503).json({ error: 'mission_authority_unavailable' });
  if(authority&&!authority.hasCapacity())return res.status(503).json({error:'mission_server_full'});
  const now = new Date();
  await expireInterrupted(req.missionPlayerId, now);
  const transaction = await mongoose.startSession();
  try {
    let created;
    await transaction.withTransaction(async () => {
      await MissionLife.findOneAndUpdate({ playerId: req.missionPlayerId }, {
        $inc: { admissionVersion: 1 }, $set: { recoveryUntil: null },
      }, { upsert: true, new: true, session: transaction });
      [created] = await MissionSession.create([{ playerId: req.missionPlayerId, missionId: parsed.data.missionId,
        seed: parsed.data.seed ?? crypto.randomInt(0, 4294967296), authority: Boolean(authority),
        configVersion: authority ? 3 : 2, reconnectDeadline: new Date(now.getTime() + leaseMs) }], { session: transaction });
    });
    res.status(201).json({ session: created });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'mission_already_active' });
    throw error;
  } finally { await transaction.endSession(); }
}));

missionRoutes.post('/sessions/:id/connect', missionWrites, asyncRoute(async (req, res) => {
  if (!idInput.safeParse(req.params.id).success || Object.keys(req.body ?? {}).length) return res.status(400).json({ error: 'invalid_request' });
  if (!authority) return res.status(503).json({ error: 'mission_authority_unavailable' });
  const credentials = await authority.ticket(req.missionPlayerId, req.params.id,req.authSession);
  // The relay sends this response from Render; the socket connects directly.
  if (!credentials.origin) {
    const origin = `${req.protocol}://${req.get('host')}`;
    credentials.origin = origin;
  }
  res.json(credentials);
}));

missionRoutes.post('/sessions/:id/heartbeat', asyncRoute(async (req, res) => {
  const parsed = idInput.safeParse(req.params.id);
  if (!parsed.success || req.body && Object.keys(req.body).length) return res.status(400).json({ error: 'invalid_request' });
  const now = new Date();
  const session = await MissionSession.findOneAndUpdate(
    { _id: parsed.data, playerId: req.missionPlayerId, authority: { $ne: true }, status: 'active', reconnectDeadline: { $gt: now } },
    { $set: { reconnectDeadline: new Date(now.getTime() + leaseMs) } }, { new: true });
  if (!session) {
    await expireInterrupted(req.missionPlayerId, now);
    return res.status(409).json({ error: 'mission_not_active' });
  }
  res.json({ reconnectDeadline: session.reconnectDeadline });
}));

// Legacy unverified sessions only. Authoritative sessions reject this route;
// liveAuthority is their only result writer.
missionRoutes.post('/sessions/:id/report', asyncRoute(async (req, res) => {
  const id = idInput.safeParse(req.params.id), input = reportInput.safeParse(req.body);
  if (!id.success || !input.success) return res.status(400).json({ error: 'invalid_request' });
  const session = await MissionSession.findOneAndUpdate(
    { _id: id.data, playerId: req.missionPlayerId, authority: { $ne: true }, status: 'active', reconnectDeadline: { $gt: new Date() } },
    { $set: { status: 'reported', localOutcome: input.data.outcome, endedAt: new Date() } }, { new: true });
  if (!session) {
    await expireInterrupted(req.missionPlayerId);
    return res.status(409).json({ error: 'mission_not_active' });
  }
  res.json({ session, rewardEligible: false, integrity: 'unverified' });
}));

missionRoutes.post('/sessions/:id/abandon', asyncRoute(async (req, res) => {
  const parsed = idInput.safeParse(req.params.id);
  if (!parsed.success || req.body && Object.keys(req.body).length) return res.status(400).json({ error: 'invalid_request' });
  if (authority) {
    const owned = await MissionSession.findOne({ _id: parsed.data, playerId: req.missionPlayerId }).select('authority');
    if (owned?.authority) return res.status(await authority.abandon(req.missionPlayerId, parsed.data) ? 200 : 409).json({ ok: true });
  }
  const session = await MissionSession.findOneAndUpdate(
    { _id: parsed.data, playerId: req.missionPlayerId, status: 'active', reconnectDeadline: { $gt: new Date() } },
    { $set: { status: 'abandoned', endedAt: new Date() } }, { new: true });
  if (!session) {
    await expireInterrupted(req.missionPlayerId);
    return res.status(409).json({ error: 'mission_not_active' });
  }
  res.json({ session });
}));
return missionRoutes;
}
