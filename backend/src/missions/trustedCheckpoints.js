import mongoose from 'mongoose';
import { z } from 'zod';
import { MissionCheckpoint, MissionSession } from './models.js';

const id = z.string().regex(/^[a-z0-9:-]{1,80}$/);
const checkpointInput = z.object({
  ordinal: z.number().int().min(1).max(100), checkpointId: id,
  completedObjectives: z.array(id).max(32),
  loadout: z.array(z.object({ slot: id, weaponId: id, magazine: z.number().int().min(0).max(1000),
    reserve: z.number().int().min(0).max(10000) }).strict()).max(4),
  defeatedEnemies: z.array(id).max(1000), consumedPickups: z.array(id).max(1000),
  stats: z.object({ enemiesDefeated: z.number().int().min(0).max(10000),
    shotsFired: z.number().int().min(0).max(1000000),
    successfulHits: z.number().int().min(0).max(1000000) }).strict(),
  simulationState: z.record(z.string(), z.unknown()).optional(),
}).strict().superRefine((value, context) => {
  for (const key of ['completedObjectives', 'defeatedEnemies', 'consumedPickups']) {
    if (new Set(value[key]).size !== value[key].length) context.addIssue({ code: 'custom', message: 'duplicate_' + key });
  }
  if (new Set(value.loadout.map(slot => slot.slot)).size !== value.loadout.length) context.addIssue({ code: 'custom', message: 'duplicate_slot' });
  if (value.stats.successfulHits > value.stats.shotsFired) context.addIssue({ code: 'custom', message: 'invalid_accuracy' });
});

/** Internal-only checkpoint from authoritative mission state; no client route. */
export async function saveVerifiedCheckpoint(sessionId, snapshot,owner) {
  if (!mongoose.isValidObjectId(sessionId)) throw new Error('invalid_session');
  const parsed = checkpointInput.safeParse(snapshot);
  if (!parsed.success) throw new Error('invalid_checkpoint');
  if (Buffer.byteLength(JSON.stringify(parsed.data)) > 1048576) throw new Error('checkpoint_too_large');
  const transaction = await mongoose.startSession();
  try {
    let saved;
    await transaction.withTransaction(async () => {
      const mission = await MissionSession.findById(sessionId).session(transaction);
      if(owner&&mission&&(mission.authorityOwner!==owner||mission.authorityLeaseUntil<=new Date()))throw new Error('mission_ownership_lost');
      if (!mission || mission.status !== 'active' || mission.health <= 0) throw new Error('mission_not_active');
      const previous = await MissionCheckpoint.findOne({ sessionId }).sort({ ordinal: -1 }).session(transaction);
      if (parsed.data.ordinal !== (previous?.ordinal ?? 0) + 1 ||
          previous && !previous.completedObjectives.every(objective => parsed.data.completedObjectives.includes(objective))) {
        throw new Error('checkpoint_out_of_order');
      }
      const [row] = await MissionCheckpoint.create([{
        ...parsed.data, sessionId: mission._id, playerId: mission.playerId,
        missionId: mission.missionId, configVersion: mission.configVersion,
        health: mission.health, savedAt: new Date(),
      }], { session: transaction });
      saved = row;
    });
    return saved;
  } finally {
    await transaction.endSession();
  }
}
