import mongoose from 'mongoose';

const missionSessionSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  missionId: { type: String, required: true },
  configVersion: { type: Number, required: true },
  seed: { type: Number, min: 0, max: 4294967295, default: 0 },
  authority: { type: Boolean, default: false },
  startedAt: { type: Date, default: null },
  authorityOwner: { type: String, default: null },
  authorityLeaseUntil: { type: Date, default: null },
  grenadesSpent: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['active', 'abandoned', 'expired', 'reported', 'failed', 'verified_success', 'verified_failure'], required: true, default: 'active' },
  localOutcome: { type: String, enum: ['success', 'failure'], default: null },
  verifiedOutcome: { type: String, enum: ['success', 'failure'], default: null },
  integrity: { type: String, enum: ['unverified', 'verified'], default: 'unverified' },
  // The lease is extended only by an authenticated heartbeat. A crashed client
  // loses its session after five minutes, without a death penalty.
  reconnectDeadline: { type: Date, required: true, default: () => new Date(Date.now() + 300000) },
  // Only a trusted server-side combat processor may change these fields.
  // Browser reports and heartbeats are never allowed to write them.
  health: { type: Number, required: true, min: 0, max: 500, default: 100 },
  maxHealth: { type: Number, required: true, min: 100, max: 500, default: 100 },
  endedAt: { type: Date, default: null },
}, { timestamps: true });

// The database, not a request-time check, enforces one active session per player.
missionSessionSchema.index({ playerId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
missionSessionSchema.index({ playerId: 1, _id: -1 });

export const MissionSession = mongoose.model('MissionSession', missionSessionSchema);

const lifeSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  recoveryUntil: { type: Date, default: null },
  deaths: { type: Number, default: 0, min: 0 },
  admissionVersion: { type: Number, default: 0 },
}, { timestamps: true });

export const MissionLife = mongoose.model('MissionLife', lifeSchema);

// Phase 6 may create a verified entitlement after payment verification. This
// phase exposes no client API for minting or consuming payment claims.
const recoveryEntitlementSchema=new mongoose.Schema({
  playerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  providerReference:{type:String,required:true,unique:true},
  status:{type:String,enum:['verified','consumed'],default:'verified',required:true},
  expiresAt:{type:Date,required:true},verifiedAt:{type:Date,required:true},consumedAt:{type:Date,default:null},
},{timestamps:true});
export const MissionRecoveryEntitlement=mongoose.model('MissionRecoveryEntitlement',recoveryEntitlementSchema);

// An internal event ledger makes trusted combat transitions idempotent. There
// is deliberately no HTTP endpoint that accepts these events from a client.
const combatEventSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MissionSession', required: true },
  eventId: { type: String, required: true, maxlength: 120 },
  kind: { type: String, enum: ['damage', 'firstAid'], required: true },
  amount: { type: Number, required: true, min: 0, max: 200 },
}, { timestamps: true });
combatEventSchema.index({ sessionId: 1, eventId: 1 }, { unique: true });
export const MissionCombatEvent = mongoose.model('MissionCombatEvent', combatEventSchema);

// Checkpoints are snapshots from server-owned simulation state. There is no
// public write route, because a browser snapshot would be forgeable.
const checkpointSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MissionSession', required: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  missionId: { type: String, required: true },
  configVersion: { type: Number, required: true },
  ordinal: { type: Number, required: true, min: 0, max: 100 },
  checkpointId: { type: String, required: true, maxlength: 80 },
  completedObjectives: { type: [String], default: [] },
  health: { type: Number, required: true, min: 1, max: 500 },
  loadout: { type: [{ slot: String, weaponId: String, magazine: Number, reserve: Number }], default: [] },
  defeatedEnemies: { type: [String], default: [] },
  consumedPickups: { type: [String], default: [] },
  stats: { type: mongoose.Schema.Types.Mixed, default: {} },
  simulationState: { type: mongoose.Schema.Types.Mixed, default: null },
  savedAt: { type: Date, required: true },
}, { timestamps: true });
checkpointSchema.index({ sessionId: 1, ordinal: 1 }, { unique: true });
export const MissionCheckpoint = mongoose.model('MissionCheckpoint', checkpointSchema);

// Only the server-owned simulation may write these. The public mission
// routes intentionally expose reads only; client reports stay unverified.
const verifiedResultSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MissionSession', required: true, unique: true },
  missionId: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 10000 },
  integrity: { type: String, enum: ['verified'], required: true, default: 'verified' },
  scoreVersion: { type: Number, required: true },
  durationSeconds: { type: Number, required: true, min: 1, max: 172800 },
  outcome: { type: String, enum: ['success', 'failure'], required: true },
  enemiesDefeated: { type: Number, required: true, min: 0, max: 10000 },
  shotsFired: { type: Number, required: true, min: 0, max: 1000000 },
  successfulHits: { type: Number, required: true, min: 0, max: 1000000 },
  remainingHealth: { type: Number, required: true, min: 0, max: 500 },
  optionalCompleted: { type: Number, required: true, min: 0, max: 32 },
  firstCompletion: { type: Boolean, required: true, default: false },
  rewardEligible: { type: Boolean, required: true, default: false },
  verifiedAt: { type: Date, required: true },
}, { timestamps: true });
verifiedResultSchema.index({ missionId: 1, score: -1, durationSeconds: 1 });
verifiedResultSchema.index({ playerId: 1, missionId: 1 }, { unique: true, partialFilterExpression: { firstCompletion: true } });
export const VerifiedMissionResult = mongoose.model('VerifiedMissionResult', verifiedResultSchema);
